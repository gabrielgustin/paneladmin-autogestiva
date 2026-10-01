import { getToken } from '@vercel/connect'
import { NextResponse } from 'next/server'

const CONNECTOR = 'neon/neon-account-usage-dashboard'
const API = 'https://console.neon.tech/api/v2'

async function neon(path: string, token: string) {
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Neon API error ${response.status}`)
  return response.json()
}

export async function GET() {
  try {
    const token = await getToken(CONNECTOR, { subject: { type: 'app' } })
    const projectsResponse = await neon('/projects', token)
    const projects = (projectsResponse.projects ?? []).map((project: Record<string, unknown>) => ({
      id: project.id,
      orgId: project.org_id,
      name: project.name,
      region: project.region_id,
      plan: (project.owner as Record<string, unknown> | undefined)?.subscription_type ?? 'unknown',
      computeHours: typeof project.compute_time_seconds === 'number' ? Number(project.compute_time_seconds) / 3600 : null,
      storageGbHours: typeof project.data_storage_bytes_hour === 'number' ? Number(project.data_storage_bytes_hour) / 1024 ** 3 : null,
      transferGb: typeof project.data_transfer_bytes === 'number' ? Number(project.data_transfer_bytes) / 1024 ** 3 : null,
      updatedAt: project.updated_at,
    }))
    return NextResponse.json({
      organizations: [...new Set(projects.map((project: { orgId?: string }) => project.orgId).filter(Boolean))].map((id) => ({ id })),
      projects,
      period: projectsResponse.projects?.[0]?.consumption_period_end ? { end: projectsResponse.projects[0].consumption_period_end } : null,
      syncedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[v0] Neon account usage error:', error)
    return NextResponse.json({ error: 'No se pudieron cargar los datos de Neon.' }, { status: 502 })
  }
}

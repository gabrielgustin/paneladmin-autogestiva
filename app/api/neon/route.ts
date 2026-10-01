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
    const rawProjects = (projectsResponse.projects ?? []) as Record<string, unknown>[]
    const orgIds = [...new Set(rawProjects.map((project) => project.org_id).filter((id): id is string => typeof id === 'string'))]
    const now = new Date()
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
    const to = now.toISOString()
    const usageByProject = new Map<string, { compute: number; storage: number; transfer: number }>()

    await Promise.all(orgIds.map(async (orgId) => {
      const query = new URLSearchParams({
        org_id: orgId,
        from,
        to,
        granularity: 'daily',
        metrics: 'compute_unit_seconds,root_branch_bytes_month',
      })
      try {
        const history = await neon(`/consumption_history/v2/projects?${query.toString()}`, token)
        const rows = Array.isArray(history) ? history : history.projects ?? history.data ?? []
        for (const row of rows as Record<string, unknown>[]) {
          const projectId = String(row.project_id ?? row.projectId ?? '')
          if (!projectId) continue
          const current = usageByProject.get(projectId) ?? { compute: 0, storage: 0, transfer: 0 }
          current.compute += Number(row.compute_unit_seconds ?? 0) / 3600
          current.storage += Number(row.root_branch_bytes_month ?? 0) / 1024 ** 3
          current.storage += Number(row.child_branch_bytes_month ?? 0) / 1024 ** 3
          current.transfer += (Number(row.public_network_transfer_bytes ?? 0) + Number(row.private_network_transfer_bytes ?? 0)) / 1024 ** 3
          usageByProject.set(projectId, current)
        }
      } catch (error) {
        console.error('[v0] Neon consumption history error:', error)
      }
    }))

    const projects = rawProjects.map((project: Record<string, unknown>) => ({
      id: project.id,
      orgId: project.org_id,
      name: project.name,
      region: project.region_id,
      plan: (project.owner as Record<string, unknown> | undefined)?.subscription_type ?? 'unknown',
      computeHours: usageByProject.get(String(project.id))?.compute ?? null,
      storageGbHours: usageByProject.get(String(project.id))?.storage ?? null,
      transferGb: usageByProject.get(String(project.id))?.transfer ?? null,
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

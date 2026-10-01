import { getToken } from '@vercel/connect'
import { NextResponse } from 'next/server'

const CONNECTOR = 'neon/neon-account-usage-dashboard'
const API = 'https://console.neon.tech/api/v2'

async function neon(path: string, token: string) {
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Neon API error ${response.status}: ${detail.slice(0, 240)}`)
  }
  return response.json()
}

export async function GET() {
  try {
    const token = await getToken(CONNECTOR, { subject: { type: 'app' } })
    const projectsResponse = await neon('/projects', token)
    const rawProjects = (projectsResponse.projects ?? []) as Record<string, unknown>[]
    const orgIds = [...new Set(rawProjects.map((project) => project.org_id).filter((id): id is string => typeof id === 'string'))]
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    // Neon truncates dates to the day, so on the 1st of a month the current-month range collapses to zero length.
    const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    const from = (startOfToday > monthStart.getTime()
      ? monthStart
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))).toISOString()
    const to = now.toISOString()
    const usageByProject = new Map<string, { compute: number; storage: number; transfer: number }>()

    const planByProject = new Map<string, string>()
    const diagnostics: string[] = []
    const metrics = 'compute_unit_seconds,root_branch_bytes_month,child_branch_bytes_month,public_network_transfer_bytes,private_network_transfer_bytes'

    await Promise.all(orgIds.map(async (orgId) => {
      let cursor: string | undefined
      try {
        for (let page = 0; page < 20; page++) {
          const query = new URLSearchParams({ org_id: orgId, from, to, granularity: 'daily', metrics, limit: '100' })
          if (cursor) query.set('cursor', cursor)
          const history = await neon(`/consumption_history/v2/projects?${query.toString()}`, token)
          const rows = (history.projects ?? []) as {
            project_id?: string
            periods?: { period_plan?: string; consumption?: { metrics?: { metric_name: string; value: number }[] }[] }[]
          }[]
          for (const row of rows) {
            if (!row.project_id) continue
            const current = usageByProject.get(row.project_id) ?? { compute: 0, storage: 0, transfer: 0 }
            for (const period of row.periods ?? []) {
              if (period.period_plan) planByProject.set(row.project_id, period.period_plan)
              for (const day of period.consumption ?? []) {
                let dayStorage = 0
                for (const { metric_name, value } of day.metrics ?? []) {
                  const amount = Number(value ?? 0)
                  if (metric_name === 'compute_unit_seconds') current.compute += amount / 3600
                  else if (metric_name === 'root_branch_bytes_month' || metric_name === 'child_branch_bytes_month') dayStorage += amount / 1024 ** 3
                  else if (metric_name === 'public_network_transfer_bytes' || metric_name === 'private_network_transfer_bytes') current.transfer += amount / 1024 ** 3
                }
                if (dayStorage > 0) current.storage = dayStorage
              }
            }
            usageByProject.set(row.project_id, current)
          }
          cursor = history.pagination?.cursor
          if (!cursor || rows.length === 0) break
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        diagnostics.push(`${orgId}: ${message}`)
        console.error('[v0] Neon consumption history error:', message)
      }
    }))

    const projects = rawProjects.map((project: Record<string, unknown>) => ({
      id: project.id,
      orgId: project.org_id,
      name: project.name,
      region: project.region_id,
      plan: planByProject.get(String(project.id)) ?? (project.owner as Record<string, unknown> | undefined)?.subscription_type ?? 'unknown',
      computeHours: usageByProject.get(String(project.id))?.compute ?? null,
      storageGbHours: usageByProject.get(String(project.id))?.storage ?? null,
      transferGb: usageByProject.get(String(project.id))?.transfer ?? null,
      updatedAt: project.updated_at,
    }))
    return NextResponse.json({
      organizations: [...new Set(projects.map((project: { orgId?: string }) => project.orgId).filter(Boolean))].map((id) => ({ id })),
      projects,
      period: projectsResponse.projects?.[0]?.consumption_period_end ? { end: projectsResponse.projects[0].consumption_period_end } : null,
      diagnostics,
      syncedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[v0] Neon account usage error:', error)
    return NextResponse.json({ error: 'No se pudieron cargar los datos de Neon.' }, { status: 502 })
  }
}

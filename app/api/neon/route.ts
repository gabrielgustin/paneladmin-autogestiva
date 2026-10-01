import { getToken } from '@vercel/connect'
import { NextResponse } from 'next/server'

const CONNECTOR = 'neon/neon-account-usage-dashboard'
const API = 'https://console.neon.tech/api/v2'

// Neon Launch plan rates (USD). Compute and transfer overage are Neon's published Launch prices.
const RATES = {
  computePerCuHour: 0.106,
  storagePerGbMonth: 0.35,
  restorePerGbMonth: 0.2,
  transferIncludedGb: 500,
  transferPerGb: 0.1,
}
const SPIKE_FACTOR = 2
const SPIKE_MIN_USD = 0.5

type DayCost = { date: string; cost: number }
type Usage = {
  compute: number
  storage: number
  storageGbMonth: number
  restoreGbMonth: number
  transfer: number
  days: Map<string, number>
}

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

const round = (value: number) => Math.round(value * 100) / 100

export async function GET(request: Request) {
  try {
    const token = await getToken(CONNECTOR, { subject: { type: 'app' } })
    const requestedMonth = new URL(request.url).searchParams.get('month')
    const monthMatch = requestedMonth?.match(/^(\d{4})-(\d{2})$/)
    const now = new Date()
    const year = monthMatch ? Number(monthMatch[1]) : now.getUTCFullYear()
    const month = monthMatch ? Number(monthMatch[2]) - 1 : now.getUTCMonth()
    const monthStart = new Date(Date.UTC(year, month, 1))
    const nextMonthStart = new Date(Date.UTC(year, month + 1, 1))
    const selectedMonth = `${year}-${String(month + 1).padStart(2, '0')}`
    const daysInMonth = Math.round((nextMonthStart.getTime() - monthStart.getTime()) / 86_400_000)
    const isCurrentMonth = now >= monthStart && now < nextMonthStart
    const elapsedDays = isCurrentMonth ? Math.max(1, now.getUTCDate()) : daysInMonth

    const projectsResponse = await neon('/projects', token)
    const rawProjects = (projectsResponse.projects ?? []) as Record<string, unknown>[]
    const orgIds = [...new Set(rawProjects.map((project) => project.org_id).filter((id): id is string => typeof id === 'string'))]
    const from = monthStart.toISOString()
    const to = nextMonthStart.toISOString()
    const usageByProject = new Map<string, Usage>()
    const planByProject = new Map<string, string>()
    const diagnostics: string[] = []
    const metrics =
      'compute_unit_seconds,root_branch_bytes_month,child_branch_bytes_month,instant_restore_bytes_month,public_network_transfer_bytes,private_network_transfer_bytes'

    await Promise.all(
      orgIds.map(async (orgId) => {
        let cursor: string | undefined
        try {
          for (let page = 0; page < 20; page++) {
            const query = new URLSearchParams({ org_id: orgId, from, to, granularity: 'daily', metrics, limit: '100' })
            if (cursor) query.set('cursor', cursor)
            const history = await neon(`/consumption_history/v2/projects?${query.toString()}`, token)
            const rows = (history.projects ?? []) as {
              project_id?: string
              periods?: {
                period_plan?: string
                consumption?: { timeframe_start?: string; metrics?: { metric_name: string; value: number }[] }[]
              }[]
            }[]
            for (const row of rows) {
              if (!row.project_id) continue
              const current: Usage = usageByProject.get(row.project_id) ?? {
                compute: 0,
                storage: 0,
                storageGbMonth: 0,
                restoreGbMonth: 0,
                transfer: 0,
                days: new Map(),
              }
              for (const period of row.periods ?? []) {
                if (period.period_plan) planByProject.set(row.project_id, period.period_plan)
                for (const day of period.consumption ?? []) {
                  let dayCompute = 0
                  let dayStorage = 0
                  let dayRestore = 0
                  for (const { metric_name, value } of day.metrics ?? []) {
                    const amount = Number(value ?? 0)
                    if (metric_name === 'compute_unit_seconds') dayCompute += amount / 3600
                    else if (metric_name === 'root_branch_bytes_month' || metric_name === 'child_branch_bytes_month') dayStorage += amount / 1024 ** 3
                    else if (metric_name === 'instant_restore_bytes_month') dayRestore += amount / 1024 ** 3
                    else if (metric_name === 'public_network_transfer_bytes' || metric_name === 'private_network_transfer_bytes') current.transfer += amount / 1024 ** 3
                  }
                  current.compute += dayCompute
                  current.storageGbMonth += dayStorage
                  current.restoreGbMonth += dayRestore
                  if (dayStorage > 0) current.storage = dayStorage
                  const date = (day.timeframe_start ?? '').slice(0, 10)
                  if (date) {
                    const dayCost =
                      dayCompute * RATES.computePerCuHour +
                      dayStorage * RATES.storagePerGbMonth +
                      dayRestore * RATES.restorePerGbMonth
                    current.days.set(date, (current.days.get(date) ?? 0) + dayCost)
                  }
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
      }),
    )

    const projects = rawProjects.map((project: Record<string, unknown>) => {
      const id = String(project.id)
      const usage = usageByProject.get(id)
      const compute = usage ? usage.compute * RATES.computePerCuHour : 0
      const storage = usage ? usage.storageGbMonth * RATES.storagePerGbMonth : 0
      const restore = usage ? usage.restoreGbMonth * RATES.restorePerGbMonth : 0
      const transfer = usage ? Math.max(0, usage.transfer - RATES.transferIncludedGb) * RATES.transferPerGb : 0
      const total = compute + storage + restore + transfer
      const dailyCosts: DayCost[] = usage
        ? [...usage.days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, cost]) => ({ date, cost: round(cost) }))
        : []

      let spike: { date: string; cost: number; average: number } | null = null
      if (dailyCosts.length >= 3) {
        const last = dailyCosts[dailyCosts.length - 1]
        const previous = dailyCosts.slice(0, -1)
        const average = previous.reduce((sum, day) => sum + day.cost, 0) / previous.length
        if (last.cost >= SPIKE_MIN_USD && last.cost > average * SPIKE_FACTOR) spike = { date: last.date, cost: last.cost, average: round(average) }
      }

      return {
        id,
        orgId: project.org_id,
        name: project.name,
        region: project.region_id,
        plan: planByProject.get(id) ?? (project.owner as Record<string, unknown> | undefined)?.subscription_type ?? 'unknown',
        computeHours: usage ? usage.compute : null,
        storageGbHours: usage ? usage.storage : null,
        transferGb: usage ? usage.transfer : null,
        cost: { compute: round(compute), storage: round(storage), restore: round(restore), transfer: round(transfer), total: round(total) },
        projectedTotal: round((total / elapsedDays) * daysInMonth),
        dailyCosts,
        spike,
        updatedAt: project.updated_at,
      }
    })

    const totalCost = projects.reduce((sum, project) => sum + project.cost.total, 0)
    return NextResponse.json({
      organizations: [...new Set(projects.map((project: { orgId?: unknown }) => project.orgId).filter(Boolean))].map((id) => ({ id })),
      projects,
      cost: {
        total: round(totalCost),
        projected: round((totalCost / elapsedDays) * daysInMonth),
        elapsedDays,
        daysInMonth,
        currency: 'USD',
        rates: RATES,
      },
      period: { month: selectedMonth, from, to },
      diagnostics,
      syncedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[v0] Neon account usage error:', error)
    return NextResponse.json({ error: 'No se pudieron cargar los datos de Neon.' }, { status: 502 })
  }
}

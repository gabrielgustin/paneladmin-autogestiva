import { getNeonToken } from '@/lib/neon-token'
import { NextResponse } from 'next/server'
import { mapLimit, neon, neonErrorMessage } from '@/lib/neon-api'
import { requireAdmin } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60


// Neon Launch plan rates (USD). Compute and transfer overage are Neon's published Launch prices.
const RATES = {
  computePerCuHour: 0.106,
  storagePerGbMonth: 0.35,
  restorePerGbMonth: 0.2,
  snapshotPerGbMonth: 0.09,
  extraBranchPerMonth: 1.5,
  freeChildBranches: 9,
  transferIncludedGb: 500,
  transferPerGb: 0.1,
}
const SPIKE_FACTOR = 2
const SPIKE_MIN_USD = 0.5
const BILLING_HOURS = 744
const GB = 1_000_000_000
const TRANSFER_WARN_RATIO = 0.8
const DAILY_LIMIT_DAYS = 60

type DayCost = { date: string; cost: number }
type Usage = {
  compute: number
  storage: number
  storageGbMonth: number
  restoreGbMonth: number
  snapshotGbMonth: number
  extraBranchMonths: number
  maxChildBranches: number
  transfer: number
  days: Map<string, number>
}

const round = (value: number) => Math.round(value * 100) / 100

export async function GET(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied
  try {
    const token = await getNeonToken()
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

    const diagnostics: string[] = []
    const projectsResponse = await neon('/projects?limit=400', token)
    const rawProjects = (projectsResponse.projects ?? []) as Record<string, unknown>[]
    const orgIds = [...new Set(rawProjects.map((project) => project.org_id).filter((id): id is string => typeof id === 'string'))]
    const endpointsByProject = new Map<string, { id: string; current_state?: string }>()
    await mapLimit(rawProjects, 4, async (project) => {
      const projectId = typeof project.id === 'string' ? project.id : ''
      if (!projectId) return
      try {
        const response = await neon(`/projects/${projectId}/endpoints`, token)
        const endpoint = Array.isArray(response.endpoints) ? response.endpoints[0] : null
        if (endpoint?.id) endpointsByProject.set(projectId, { id: String(endpoint.id), current_state: typeof endpoint.current_state === 'string' ? endpoint.current_state : undefined })
      } catch (error) {
        console.error('[v0] Neon endpoint lookup error:', error)
        diagnostics.push(`Endpoint de ${String(project.name ?? projectId)}: ${neonErrorMessage(error)}`)
      }
    })
    const from = monthStart.toISOString()
    const to = nextMonthStart.toISOString()
    const consumptionFailed = new Set<string>()
    const usageByProject = new Map<string, Usage>()
    const planByProject = new Map<string, string>()
    const metrics =
      'compute_unit_seconds,root_branch_bytes_month,child_branch_bytes_month,instant_restore_bytes_month,snapshot_storage_bytes_month,extra_branches_month,public_network_transfer_bytes'
    const useDaily = monthStart.getTime() >= now.getTime() - DAILY_LIMIT_DAYS * 86_400_000
    const granularity = useDaily ? 'daily' : 'monthly'
    const bucketHours = useDaily ? 24 : daysInMonth * 24

    await Promise.all(
      orgIds.map(async (orgId) => {
        let cursor: string | undefined
        try {
          for (let page = 0; page < 20; page++) {
            const query = new URLSearchParams({ org_id: orgId, from, to, granularity, metrics, limit: '100' })
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
                snapshotGbMonth: 0,
                extraBranchMonths: 0,
                maxChildBranches: 0,
                transfer: 0,
                days: new Map(),
              }
              for (const period of row.periods ?? []) {
                if (period.period_plan) planByProject.set(row.project_id, period.period_plan)
                for (const day of period.consumption ?? []) {
                  let dayCompute = 0
                  let dayStorage = 0
                  let dayRestore = 0
                  let daySnapshot = 0
                  let dayBranchMonths = 0
                  let dayStorageAvgGb = 0
                  for (const { metric_name, value } of day.metrics ?? []) {
                    const amount = Number(value ?? 0)
                    if (metric_name === 'compute_unit_seconds') dayCompute += amount / 3600
                    else if (metric_name === 'root_branch_bytes_month' || metric_name === 'child_branch_bytes_month') {
                      dayStorage += amount / BILLING_HOURS / GB
                      dayStorageAvgGb += amount / bucketHours / GB
                    } else if (metric_name === 'instant_restore_bytes_month') dayRestore += amount / BILLING_HOURS / GB
                    else if (metric_name === 'snapshot_storage_bytes_month') daySnapshot += amount / BILLING_HOURS / GB
                    else if (metric_name === 'extra_branches_month') {
                      const freeHours = RATES.freeChildBranches * bucketHours
                      dayBranchMonths += Math.max(0, amount - freeHours) / BILLING_HOURS
                      current.maxChildBranches = Math.max(current.maxChildBranches, amount / bucketHours)
                    } else if (metric_name === 'public_network_transfer_bytes') current.transfer += amount / GB
                  }
                  current.compute += dayCompute
                  current.storageGbMonth += dayStorage
                  current.restoreGbMonth += dayRestore
                  current.snapshotGbMonth += daySnapshot
                  current.extraBranchMonths += dayBranchMonths
                  if (dayStorageAvgGb > 0) current.storage = dayStorageAvgGb
                  const date = (day.timeframe_start ?? '').slice(0, 10)
                  if (date && useDaily) {
                    const dayCost =
                      dayCompute * RATES.computePerCuHour +
                      dayStorage * RATES.storagePerGbMonth +
                      dayRestore * RATES.restorePerGbMonth +
                      daySnapshot * RATES.snapshotPerGbMonth +
                      dayBranchMonths * RATES.extraBranchPerMonth
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
          diagnostics.push(`Consumo (${orgId}): ${neonErrorMessage(error)}`)
          consumptionFailed.add(orgId)
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
      const snapshots = usage ? usage.snapshotGbMonth * RATES.snapshotPerGbMonth : 0
      const branches = usage ? usage.extraBranchMonths * RATES.extraBranchPerMonth : 0
      const transfer = usage ? Math.max(0, usage.transfer - RATES.transferIncludedGb) * RATES.transferPerGb : 0
      const total = compute + storage + restore + snapshots + branches + transfer
      const alerts: { type: 'transfer' | 'branches'; message: string }[] = []
      if (usage && usage.transfer >= RATES.transferIncludedGb * TRANSFER_WARN_RATIO) {
        alerts.push({
          type: 'transfer',
          message: `Transferencia pública en ${round(usage.transfer)} GB de ${RATES.transferIncludedGb} GB incluidos`,
        })
      }
      if (usage && usage.maxChildBranches > RATES.freeChildBranches) {
        alerts.push({
          type: 'branches',
          message: `${Math.ceil(usage.maxChildBranches)} branches hijos (incluidos: ${RATES.freeChildBranches})`,
        })
      }
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
        endpointId: endpointsByProject.get(id)?.id ?? null,
        endpointStatus: endpointsByProject.get(id)?.current_state ?? 'unknown',
        region: project.region_id,
        plan: planByProject.get(id) ?? (project.owner as Record<string, unknown> | undefined)?.subscription_type ?? 'unknown',
        computeHours: usage ? usage.compute : null,
        storageGbHours: usage ? usage.storage : null,
        transferGb: usage ? usage.transfer : null,
        storageBytes: typeof project.synthetic_storage_size === 'number' ? project.synthetic_storage_size : null,
        cost: {
          compute: round(compute),
          storage: round(storage),
          restore: round(restore),
          snapshots: round(snapshots),
          branches: round(branches),
          transfer: round(transfer),
          total: round(total),
        },
        alerts,
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
      consumptionAvailable: consumptionFailed.size === 0,
      syncedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[v0] Neon account usage error:', error)
    return NextResponse.json({ error: neonErrorMessage(error) }, { status: 502 })
  }
}

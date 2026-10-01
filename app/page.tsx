'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowUpRight, Database, RefreshCw, Server, Wallet } from 'lucide-react'

type Cost = { compute: number; storage: number; restore: number; snapshots: number; branches: number; transfer: number; total: number }
type Spike = { date: string; cost: number; average: number }
type ProjectAlert = { type: 'transfer' | 'branches'; message: string }
type Project = { id: string; name: string; region: string; plan: string; computeHours: number | null; storageGbHours: number | null; transferGb: number | null; storageBytes: number | null; cost: Cost; projectedTotal: number; spike: Spike | null; alerts: ProjectAlert[] }
type Data = { projects: Project[]; organizations: { id: string; name: string }[]; cost: { total: number; projected: number; elapsedDays: number; daysInMonth: number }; period?: { month?: string; from?: string; to?: string } | null; diagnostics?: string[]; syncedAt: string }

const number = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 })
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
const unavailable = 'No disponible'

function formatBytes(bytes: number | null) {
  if (bytes === null) return unavailable
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let index = 0
  while (value >= 1000 && index < units.length - 1) { value /= 1000; index++ }
  return `${number.format(value)} ${units[index]}`
}

function usage(value: number | null, unit: string) {
  if (value === null) return unavailable
  if (unit === 'GB') return formatBytes(value * 1e9)
  return `${number.format(value)} ${unit}`
}

export default function Page() {
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [month, setMonth] = useState(currentMonth)
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load(selectedMonth = month) {
    setLoading(true); setError('')
    try { const response = await fetch(`/api/neon?month=${selectedMonth}`); if (!response.ok) throw new Error(); setData(await response.json()) }
    catch { setError('No se pudieron sincronizar los proyectos. Revisa la conexión de Neon.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const totals = useMemo(() => {
    const projects = data?.projects ?? []
    const sum = (key: 'computeHours' | 'storageBytes' | 'transferGb') => {
      const values = projects.map((project) => project[key]).filter((value): value is number => value !== null)
      return values.length ? values.reduce((total, value) => total + value, 0) : null
    }
    return { compute: sum('computeHours'), storage: sum('storageBytes'), transfer: sum('transferGb') }
  }, [data])

  const sortedProjects = useMemo(() => [...(data?.projects ?? [])].sort((a, b) => b.cost.total - a.cost.total), [data])
  const spikes = sortedProjects.filter((project) => project.spike)
  const limitAlerts = sortedProjects.flatMap((project) => project.alerts.map((alert) => ({ ...alert, project: project.name, id: `${project.id}-${alert.type}` })))

  return <main className="min-h-screen bg-brand text-brand-foreground">
    <div className="relative overflow-hidden bg-brand text-brand-foreground">
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.7) 1px, transparent 1px)', backgroundSize: '42px 42px' }} />
      <div className="relative mx-auto max-w-7xl px-6 py-12 md:px-10 md:py-16">
        <button onClick={load} className="absolute right-6 top-6 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-orange px-5 text-sm font-semibold text-orange-foreground shadow-sm transition-transform hover:-translate-y-0.5 disabled:opacity-50 md:right-10" disabled={loading}><RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />{loading ? 'Sincronizando' : 'Actualizar'}</button>
        <div className="max-w-3xl"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-foreground/20 bg-brand-foreground/10 px-3 py-1.5 text-xs font-semibold text-brand-foreground"><span className="size-2 rounded-full bg-orange" />Monitoreo de cuenta</div><h1 className="max-w-2xl text-4xl font-black tracking-tight text-balance md:text-6xl">Tu infraestructura, <span className="text-orange">bajo control.</span></h1><p className="mt-5 max-w-xl text-base leading-7 text-brand-foreground/75">Una vista consolidada de todos tus proyectos Neon, recursos utilizados y actividad de tu cuenta.</p></div>
      </div>
    </div>
    <div className="mx-auto max-w-7xl bg-brand px-4 py-6 text-brand-foreground md:px-6 md:py-8">
      {error ? <div className="mt-8 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div> : <>
        <section className="mb-6 flex flex-col gap-4 rounded-xl border border-brand-foreground/15 bg-brand-foreground/10 p-5 md:flex-row md:items-end md:justify-between">
          <div><div className="text-xs font-bold uppercase tracking-[0.16em] text-orange">Histórico mensual de cuenta</div><h2 className="mt-2 text-xl font-bold">Consumo de {month}</h2><p className="mt-1 text-sm text-brand-foreground/70">Suma de los registros diarios de todos tus proyectos Neon, incluyendo los proyectos sin actividad.</p></div>
          <div className="flex items-end gap-3"><label className="text-xs font-semibold text-brand-foreground/70"><span className="mb-2 block">Mes a consultar</span><input type="month" value={month} max={currentMonth} onChange={(event) => setMonth(event.target.value)} className="h-10 rounded-lg border border-brand-foreground/20 bg-brand px-3 text-sm text-brand-foreground outline-none focus:border-orange" /></label><button onClick={() => load()} disabled={loading} className="h-10 rounded-lg bg-orange px-4 text-sm font-bold text-orange-foreground disabled:opacity-50">Consultar</button></div>
        </section>
        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Metric icon={<Wallet />} label="Gasto del mes" value={loading ? '—' : money.format(data?.cost.total ?? 0)} detail={`Acumulado al día ${data?.cost.elapsedDays ?? 0} de ${data?.cost.daysInMonth ?? 0}`} />
          <Metric icon={<Activity />} label="Proyección a fin de mes" value={loading ? '—' : money.format(data?.cost.projected ?? 0)} detail="Según el ritmo de gasto actual" />
        </section>
        {limitAlerts.length > 0 && <section className="mb-6 rounded-xl border border-orange/50 bg-orange/15 p-5" role="alert">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-orange">Límites del plan · {limitAlerts.length} {limitAlerts.length === 1 ? 'aviso' : 'avisos'}</div>
          <ul className="mt-3 flex flex-col gap-2 text-sm">{limitAlerts.map(alert => <li key={alert.id}><span className="font-semibold">{alert.project}</span>: {alert.message}.</li>)}</ul>
        </section>}
        {spikes.length > 0 && <section className="mb-6 rounded-xl border border-orange/50 bg-orange/15 p-5" role="alert">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-orange">Alerta de costos · {spikes.length} {spikes.length === 1 ? 'proyecto' : 'proyectos'} con pico</div>
          <ul className="mt-3 flex flex-col gap-2 text-sm">{spikes.map(project => <li key={project.id}><span className="font-semibold">{project.name}</span>: {money.format(project.spike!.cost)} el {project.spike!.date}, contra un promedio diario de {money.format(project.spike!.average)}.</li>)}</ul>
        </section>}
        <section className="grid gap-4 border-b border-border pb-8 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={<Wallet />} label="Proyectos" value={loading ? '—' : number.format(data?.projects.length ?? 0)} detail={`${data?.organizations.length ?? 0} organizaciones`} />
          <Metric icon={<Activity />} label="Compute utilizado" value={loading ? '—' : usage(totals.compute, 'h')} detail={`Total mensual · ${month}`} />
          <Metric icon={<Database />} label="Almacenamiento" value={loading ? '—' : formatBytes(totals.storage)} detail="Tamaño actual de todos los proyectos" />
          <Metric icon={<ArrowUpRight />} label="Transferencia" value={loading ? '—' : usage(totals.transfer, 'GB')} detail="Total mensual" />
        </section>
        <section className="mt-8 overflow-hidden rounded-lg border border-resource-panel-border bg-resource-panel shadow-sm">
          <div className="flex flex-col gap-3 border-b border-resource-panel-border bg-resource-panel-header px-5 py-5 md:flex-row md:items-center md:justify-between"><div><div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-orange"><span className="size-2 rounded-full bg-orange" />Panel de recursos</div><h2 className="text-lg font-bold tracking-tight text-brand-foreground">Todos los proyectos</h2><p className="mt-1 text-sm text-brand-foreground/70">Lectura en tiempo real desde la API de Neon</p></div><span className="rounded-full border border-orange/35 bg-orange/15 px-3 py-1 text-xs font-bold text-orange">{loading ? 'Cargando' : `${data?.projects.length ?? 0} activos`}</span></div>
          <div className="divide-y divide-border">{loading ? [1,2,3].map(i => <div className="h-20 animate-pulse bg-muted/40" key={i} />) : sortedProjects.map(project => <div className="flex flex-col gap-4 px-5 py-5 transition-colors hover:bg-secondary/30 md:flex-row md:items-center md:justify-between" key={project.id}><div className="flex items-center gap-4"><div className="flex size-10 items-center justify-center rounded-md border border-brand/20 bg-brand text-brand-foreground"><Server className="size-5" /></div><div><div className="flex items-center gap-2 font-semibold">{project.name}{project.spike && <span className="rounded-full bg-orange px-2 py-0.5 text-[10px] font-bold uppercase text-orange-foreground">Pico</span>}</div><div className="mt-1 text-xs text-muted-foreground">{project.region} · {project.plan}</div></div></div><div className="grid grid-cols-2 gap-x-6 gap-y-3 text-right text-sm sm:grid-cols-4 md:min-w-[560px]"><div><div className="font-bold text-orange">{money.format(project.cost.total)}</div><div className="text-xs text-muted-foreground">Gasto · proy. {money.format(project.projectedTotal)}</div><div className="mt-1 text-[11px] text-muted-foreground">Compute {money.format(project.cost.compute)} · Storage {money.format(project.cost.storage + project.cost.restore + project.cost.snapshots)} · Branches {money.format(project.cost.branches)} · Transfer {money.format(project.cost.transfer)}</div></div><div><div className="font-semibold">{usage(project.computeHours, 'h')}</div><div className="text-xs text-muted-foreground">Compute</div></div><div><div className="font-semibold">{formatBytes(project.storageBytes)}</div><div className="text-xs text-muted-foreground">Storage</div></div><div><div className="font-semibold">{usage(project.transferGb, 'GB')}</div><div className="text-xs text-muted-foreground">Transfer</div></div></div></div>)}</div>
        </section>
        <p className="mt-5 text-xs text-muted-foreground">{data?.syncedAt ? `Última sincronización: ${new Date(data.syncedAt).toLocaleString('es-ES')}` : 'Conectando con Neon...'}</p>
      </>}
    </div>
  </main>
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) { return <div className="rounded-xl border border-brand-foreground/15 bg-brand-foreground/10 p-5 shadow-sm"><div className="mb-5 flex size-9 items-center justify-center rounded-lg bg-brand text-brand-foreground">{icon}</div><div className="text-sm text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div><div className="mt-2 text-xs text-muted-foreground">{detail}</div></div> }

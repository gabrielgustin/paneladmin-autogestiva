'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { LogoutButton } from '@/components/session-guard'
import { Activity, ArrowUpRight, Database, RefreshCw, Server, Wallet } from 'lucide-react'

type Cost = { compute: number; storage: number; restore: number; snapshots: number; branches: number; transfer: number; total: number }
type Spike = { date: string; cost: number; average: number }
type ProjectAlert = { type: 'transfer' | 'branches'; message: string }
type Project = { id: string; name: string; region: string; plan: string; endpointId: string | null; endpointStatus: string; computeHours: number | null; storageGbHours: number | null; transferGb: number | null; storageBytes: number | null; cost: Cost; projectedTotal: number; spike: Spike | null; alerts: ProjectAlert[] }
type Data = { projects: Project[]; organizations: { id: string; name: string }[]; cost: { total: number; projected: number; elapsedDays: number; daysInMonth: number }; period?: { month?: string; from?: string; to?: string } | null; diagnostics?: string[]; consumptionAvailable?: boolean; syncedAt: string }

const number = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })
const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
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
  const [loadedMonth, setLoadedMonth] = useState(currentMonth)
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [controlling, setControlling] = useState<string | null>(null)
  const [hasScrolled, setHasScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setHasScrolled(window.scrollY > 140)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  async function controlCompute(project: Project, action: 'suspend' | 'start') {
    if (!project.endpointId) return
    const verb = action === 'suspend' ? 'suspender' : 'reactivar'
    if (!window.confirm(`¿Querés ${verb} el compute de ${project.name}? No se eliminan datos; solo cambia el estado del endpoint.`)) return
    setControlling(project.id)
    try {
      const response = await fetch('/api/neon/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: project.id, endpointId: project.endpointId, action }) })
      if (!response.ok) throw new Error()
      await load()
    } catch { setError(`No se pudo ${verb} el compute de ${project.name}.`) }
    finally { setControlling(null) }
  }

  const requestId = useRef(0)
  const load = useCallback(async (selectedMonth = month) => {
    const id = ++requestId.current
    const valid = /^\d{4}-\d{2}$/.test(selectedMonth) ? selectedMonth : currentMonth
    if (valid !== selectedMonth) setMonth(valid)
    setLoading(true); setError('')
    try {
      const response = await fetch(`/api/neon?month=${valid}`, { cache: 'no-store' })
      if (response.status === 401) { window.location.replace('/login'); return }
      const body = await response.json().catch(() => null)
      if (id !== requestId.current) return
      if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : 'No se pudo conectar con Neon.')
      setData(body)
      setLoadedMonth(valid)
    } catch (caught) {
      if (id !== requestId.current) return
      setError(caught instanceof Error && caught.message ? caught.message : 'No se pudieron sincronizar los proyectos.')
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [month, currentMonth])
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

  return <main className="min-h-screen overflow-x-hidden bg-brand text-brand-foreground" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px)', backgroundSize: '42px 42px' }}>
    <div className="relative overflow-visible bg-transparent text-brand-foreground">
      <div className="relative mx-auto max-w-7xl px-4 pb-4 pt-6 sm:px-6 md:px-10 md:pb-6 md:pt-16">
        <div className="flex w-full items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-brand-foreground/20 bg-brand-foreground/10 px-3 py-1.5 text-xs font-semibold text-brand-foreground">Infraestructura</span>
            <Link href="/clientes" className="rounded-full border border-brand-foreground/20 bg-brand-foreground/10 px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-brand-foreground/15">Clientes</Link>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => load()} aria-label={loading ? 'Sincronizando' : 'Actualizar datos'} className={`${hasScrolled ? 'fixed right-3 top-3 z-50 !h-10 !w-10 !min-w-0 !flex-none !p-0' : 'px-2 sm:px-5'} inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-orange text-[11px] font-semibold sm:h-10 sm:flex-none sm:gap-2 sm:text-sm text-orange-foreground transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50`} disabled={loading}><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /><span className={hasScrolled ? 'sr-only' : ''}>{loading ? 'Sincronizando' : 'Actualizar'}</span></button>
            <LogoutButton className="h-9 px-2 text-[11px] sm:h-10 sm:px-4" />
          </div>
        </div>
      </div>
    </div>
    <div className="mx-auto max-w-7xl px-3 py-4 text-brand-foreground sm:px-4 sm:py-6 md:px-6 md:py-8">
      {error && <div role="alert" className="mb-6 flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"><span>{error}{data ? ' Se muestran los últimos datos cargados.' : ''}</span><button onClick={() => load()} disabled={loading} className="shrink-0 rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-bold hover:bg-destructive/10 disabled:opacity-50">{loading ? 'Reintentando…' : 'Reintentar'}</button></div>}
      {(data || !error) && <>
        <section className="mb-6 flex flex-col gap-4 rounded-xl border border-brand-foreground/15 bg-brand-foreground/10 p-5 md:flex-row md:items-end md:justify-between">
          <div><div className="text-xs font-bold uppercase tracking-[0.16em] text-orange">Histórico mensual de cuenta</div><h2 className="mt-2 text-xl font-bold">Consumo de {loadedMonth}</h2><p className="mt-1 text-sm text-brand-foreground/70">Suma de los registros diarios de todos tus proyectos Neon, incluyendo los proyectos sin actividad.</p></div>
          <div className="flex items-end gap-3"><label className="text-xs font-semibold text-brand-foreground/70"><span className="mb-2 block">Mes a consultar</span><input type="month" value={month} max={currentMonth} onChange={(event) => setMonth(event.target.value)} className="h-10 rounded-lg border border-brand-foreground/20 bg-brand px-3 text-sm text-brand-foreground outline-none focus:border-orange" /></label><button onClick={() => load()} disabled={loading} className="h-10 rounded-lg bg-orange px-4 text-sm font-bold text-orange-foreground disabled:opacity-50">Consultar</button></div>
        </section>
        {data && ((data.diagnostics?.length ?? 0) > 0 || data.consumptionAvailable === false) && <section className="mb-6 rounded-xl border border-orange/50 bg-orange/15 p-5 text-sm" role="status"><div className="text-xs font-bold uppercase tracking-[0.16em] text-orange">Datos incompletos</div><p className="mt-2">{data.consumptionAvailable === false ? 'No se pudo leer el consumo desde Neon: los gastos y proyecciones no son confiables. ' : ''}Probá actualizar en unos minutos.</p><ul className="mt-2 list-disc pl-5 text-brand-foreground/75">{data.diagnostics?.map((item) => <li key={item}>{item}</li>)}</ul></section>}
        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Metric icon={<Wallet />} label="Gasto del mes" value={loading ? '—' : data?.consumptionAvailable === false ? unavailable : money.format(data?.cost.total ?? 0)} detail={`Acumulado al día ${data?.cost.elapsedDays ?? 0} de ${data?.cost.daysInMonth ?? 0}`} />
          <Metric icon={<Activity />} label="Proyección a fin de mes" value={loading ? '—' : data?.consumptionAvailable === false ? unavailable : money.format(data?.cost.projected ?? 0)} detail="Según el ritmo de gasto actual" />
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
          <Metric icon={<Wallet />} label="Proyectos" value={loading ? '—' : number.format(data?.projects.length ?? 0)} detail={`${data?.organizations.length ?? 0} ${data?.organizations.length === 1 ? 'organización' : 'organizaciones'}`} />
          <Metric icon={<Activity />} label="Compute utilizado" value={loading ? '—' : usage(totals.compute, 'h')} detail={`Total mensual · ${loadedMonth}`} />
          <Metric icon={<Database />} label="Almacenamiento" value={loading ? '—' : formatBytes(totals.storage)} detail="Tamaño actual de todos los proyectos" />
          <Metric icon={<ArrowUpRight />} label="Transferencia" value={loading ? '—' : usage(totals.transfer, 'GB')} detail="Total mensual" />
        </section>
        <section className="mb-6 overflow-hidden rounded-xl border border-brand-foreground/15 bg-brand-foreground/10 shadow-sm"><div className="border-b border-brand-foreground/10 px-5 py-4"><div className="text-xs font-bold uppercase tracking-[0.16em] text-orange">Control de compute</div><p className="mt-1 text-sm text-brand-foreground/65">Suspende o reactiva el compute sin eliminar las bases ni los datos.</p></div><div className="grid gap-3 p-4 md:grid-cols-2">{sortedProjects.map((project) => { const isSuspended = project.endpointStatus.toLowerCase().includes('idle') || project.endpointStatus.toLowerCase().includes('suspend'); const busy = controlling === project.id; return <div key={project.id} className="flex items-center justify-between gap-4 rounded-lg border border-brand-foreground/10 bg-brand-foreground/5 px-4 py-3"><div className="min-w-0"><div className="truncate text-sm font-semibold">{project.name}</div><div className="mt-1 text-xs text-brand-foreground/55">{isSuspended ? 'En reposo' : project.endpointStatus === 'unknown' ? 'Estado no disponible' : 'Activo'} · {project.plan}</div></div>{project.endpointId ? <button onClick={() => controlCompute(project, isSuspended ? 'start' : 'suspend')} disabled={busy} className="shrink-0 rounded-md border border-orange/40 px-3 py-2 text-xs font-bold text-orange transition-colors hover:bg-orange/15 disabled:opacity-50">{busy ? 'Procesando…' : isSuspended ? 'Reactivar' : 'Suspender'}</button> : <span className="text-xs text-brand-foreground/45">Sin endpoint</span>}</div> })}</div></section>
        <section className="mt-8 overflow-hidden rounded-lg border border-resource-panel-border bg-resource-panel shadow-sm">
          <div className="flex flex-col gap-3 border-b border-resource-panel-border bg-resource-panel-header px-5 py-5 md:flex-row md:items-center md:justify-between"><div><div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-orange"><span className="size-2 rounded-full bg-orange" />Panel de recursos</div><h2 className="text-lg font-bold tracking-tight text-brand-foreground">Todos los proyectos</h2><p className="mt-1 text-sm text-brand-foreground/70">Lectura en tiempo real desde la API de Neon</p></div><span className="rounded-full border border-orange/35 bg-orange/15 px-3 py-1 text-xs font-bold text-orange">{loading ? 'Cargando' : `${data?.projects.length ?? 0} ${data?.projects.length === 1 ? 'proyecto' : 'proyectos'}`}</span></div>
          <div className="divide-y divide-resource-panel-border">{loading ? [1,2,3].map(i => <div className="h-20 animate-pulse bg-resource-panel-header" key={i} />) : <><div className="hidden grid-cols-[minmax(220px,1.4fr)_minmax(150px,1fr)_repeat(4,minmax(100px,1fr))] items-center gap-5 border-b border-resource-panel-border bg-resource-panel-header px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-foreground/55 md:grid"><div>Proyecto</div><div>Gasto mensual</div><div className="text-right">Compute</div><div className="text-right">Storage</div><div className="text-right">Transfer</div><div className="text-right">Estado</div></div>{sortedProjects.map(project => <div className="grid gap-4 px-5 py-5 transition-colors hover:bg-brand-foreground/5 md:grid-cols-[minmax(220px,1.4fr)_minmax(150px,1fr)_repeat(4,minmax(100px,1fr))] md:items-center md:gap-5" key={project.id}><div className="flex items-center gap-4"><div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-brand/20 bg-brand text-brand-foreground"><Server className="size-5" /></div><div className="min-w-0"><Link href={`/proyectos/${encodeURIComponent(project.id)}`} className="block rounded-md outline-none hover:text-orange focus-visible:ring-2 focus-visible:ring-orange"><div className="flex flex-wrap items-center gap-2 font-semibold">{project.name}{project.spike && <span className="rounded-full bg-orange px-2 py-0.5 text-[10px] font-bold uppercase text-orange-foreground">Pico</span>}</div><div className="mt-1 truncate text-xs text-brand-foreground/60">{project.region} · {project.plan}</div></Link></div></div><div><div className="font-bold text-orange">{money.format(project.cost.total)}</div><div className="text-xs text-brand-foreground/60">Proy. {money.format(project.projectedTotal)}</div></div><div className="flex justify-between border-t border-brand-foreground/10 pt-3 text-sm md:block md:border-0 md:pt-0 md:text-right"><span className="text-xs text-brand-foreground/60 md:hidden">Compute</span><span className="font-semibold">{usage(project.computeHours, 'h')}</span></div><div className="flex justify-between text-sm md:block md:text-right"><span className="text-xs text-brand-foreground/60 md:hidden">Storage</span><span className="font-semibold">{formatBytes(project.storageBytes)}</span></div><div className="flex justify-between text-sm md:block md:text-right"><span className="text-xs text-brand-foreground/60 md:hidden">Transfer</span><span className="font-semibold">{usage(project.transferGb, 'GB')}</span></div><div className="flex justify-between text-sm md:block md:text-right"><span className="text-xs text-brand-foreground/60 md:hidden">Detalle</span><span className="text-[11px] leading-5 text-brand-foreground/60">C {money.format(project.cost.compute)} · S {money.format(project.cost.storage + project.cost.restore + project.cost.snapshots)}<br />B {money.format(project.cost.branches)} · T {money.format(project.cost.transfer)}</span></div></div>)}</>}</div>
        </section>
        <p className="mt-5 text-xs text-muted-foreground">{data?.syncedAt ? `Última sincronización: ${new Date(data.syncedAt).toLocaleString('es-AR')}` : 'Conectando con Neon...'}</p>
      </>}
    </div>
  </main>
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) { return <div className="rounded-xl border border-brand-foreground/15 bg-brand-foreground/10 p-5 shadow-sm"><div className="mb-5 flex size-9 items-center justify-center rounded-lg bg-brand text-brand-foreground">{icon}</div><div className="text-sm text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div><div className="mt-2 text-xs text-muted-foreground">{detail}</div></div> }

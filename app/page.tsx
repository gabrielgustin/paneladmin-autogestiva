'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowUpRight, Database, RefreshCw, Server, Wallet } from 'lucide-react'

type Project = { id: string; name: string; region: string; plan: string; computeHours: number; storageGbHours: number; transferGb: number }
type Data = { projects: Project[]; organizations: { id: string; name: string }[]; syncedAt: string }

const number = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 })

export default function Page() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try { const response = await fetch('/api/neon'); if (!response.ok) throw new Error(); setData(await response.json()) }
    catch { setError('No se pudieron sincronizar los proyectos. Revisa la conexión de Neon.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const totals = useMemo(() => data?.projects.reduce((a, p) => ({ compute: a.compute + p.computeHours, storage: a.storage + p.storageGbHours, transfer: a.transfer + p.transferGb }), { compute: 0, storage: 0, transfer: 0 }) ?? { compute: 0, storage: 0, transfer: 0 }, [data])

  return <main className="min-h-screen bg-brand text-brand-foreground">
    <div className="border-b border-brand-foreground/10 bg-brand">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10">
        <div className="flex items-center gap-4"><img src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Logo%20Autogestiva%20ultimo-jvfYcg0UFHOXhCTcfbqPO2beeBMSGD.png" alt="Autogestiva" className="h-12 w-auto object-contain" /><div className="hidden border-l border-brand-foreground/20 pl-4 text-[10px] font-medium uppercase tracking-[0.18em] text-brand-foreground/65 sm:block">Control de infraestructura</div></div>
        <button onClick={load} className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-orange px-5 text-sm font-semibold text-orange-foreground shadow-sm transition-transform hover:-translate-y-0.5 disabled:opacity-50" disabled={loading}><RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />{loading ? 'Sincronizando' : 'Actualizar'}</button>
      </div>
    </div>
    <div className="relative overflow-hidden bg-brand text-brand-foreground">
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.7) 1px, transparent 1px)', backgroundSize: '42px 42px' }} />
      <div className="relative mx-auto max-w-7xl px-6 py-12 md:px-10 md:py-16"><div className="max-w-3xl"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-foreground/20 bg-brand-foreground/10 px-3 py-1.5 text-xs font-semibold text-brand-foreground"><span className="size-2 rounded-full bg-orange" />Monitoreo de cuenta</div><h1 className="max-w-2xl text-4xl font-black tracking-tight text-balance md:text-6xl">Tu infraestructura, <span className="text-orange">bajo control.</span></h1><p className="mt-5 max-w-xl text-base leading-7 text-brand-foreground/75">Una vista consolidada de todos tus proyectos Neon, recursos utilizados y actividad de tu cuenta.</p></div></div>
    </div>
    <div className="mx-auto max-w-7xl bg-brand px-4 py-6 text-brand-foreground md:px-6 md:py-8">
      {error ? <div className="mt-8 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div> : <>
        <section className="grid gap-4 border-b border-border pb-8 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={<Wallet />} label="Proyectos" value={loading ? '—' : number.format(data?.projects.length ?? 0)} detail={`${data?.organizations.length ?? 0} organizaciones`} />
          <Metric icon={<Activity />} label="Compute utilizado" value={loading ? '—' : `${number.format(totals.compute)} h`} detail="Periodo actual" />
          <Metric icon={<Database />} label="Almacenamiento" value={loading ? '—' : `${number.format(totals.storage)} GB·h`} detail="Media acumulada" />
          <Metric icon={<ArrowUpRight />} label="Transferencia" value={loading ? '—' : `${number.format(totals.transfer)} GB`} detail="Datos transferidos" />
        </section>
        <section className="mt-8 overflow-hidden rounded-lg border border-resource-panel-border bg-resource-panel shadow-sm">
          <div className="flex flex-col gap-3 border-b border-resource-panel-border bg-resource-panel-header px-5 py-5 md:flex-row md:items-center md:justify-between"><div><div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-brand"><span className="size-2 rounded-full bg-orange" />Panel de recursos</div><h2 className="text-lg font-bold tracking-tight">Todos los proyectos</h2><p className="mt-1 text-sm text-muted-foreground">Lectura en tiempo real desde la API de Neon</p></div><span className="rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">{loading ? 'Cargando' : `${data?.projects.length ?? 0} activos`}</span></div>
          <div className="divide-y divide-border">{loading ? [1,2,3].map(i => <div className="h-20 animate-pulse bg-muted/40" key={i} />) : data?.projects.map(project => <div className="flex flex-col gap-4 px-5 py-5 transition-colors hover:bg-secondary/30 md:flex-row md:items-center md:justify-between" key={project.id}><div className="flex items-center gap-4"><div className="flex size-10 items-center justify-center rounded-md border border-brand/20 bg-brand text-brand-foreground"><Server className="size-5" /></div><div><div className="font-semibold">{project.name}</div><div className="mt-1 text-xs text-muted-foreground">{project.region} · {project.plan}</div></div></div><div className="grid grid-cols-3 gap-6 text-right text-sm"><div><div className="font-semibold">{number.format(project.computeHours)} h</div><div className="text-xs text-muted-foreground">Compute</div></div><div><div className="font-semibold">{number.format(project.storageGbHours)} GB·h</div><div className="text-xs text-muted-foreground">Storage</div></div><div><div className="font-semibold">{number.format(project.transferGb)} GB</div><div className="text-xs text-muted-foreground">Transfer</div></div></div></div>)}</div>
        </section>
        <p className="mt-5 text-xs text-muted-foreground">{data?.syncedAt ? `Última sincronización: ${new Date(data.syncedAt).toLocaleString('es-ES')}` : 'Conectando con Neon...'}</p>
      </>}
    </div>
  </main>
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) { return <div className="rounded-xl border border-brand-foreground/15 bg-brand-foreground/10 p-5 shadow-sm"><div className="mb-5 flex size-9 items-center justify-center rounded-lg bg-brand text-brand-foreground">{icon}</div><div className="text-sm text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div><div className="mt-2 text-xs text-muted-foreground">{detail}</div></div> }

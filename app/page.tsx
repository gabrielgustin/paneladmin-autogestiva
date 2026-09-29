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

  return <main className="min-h-screen bg-background text-foreground">
    <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">
      <header className="flex flex-col gap-6 border-b border-border pb-8 md:flex-row md:items-end md:justify-between">
        <div><div className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-wide text-primary"><span className="h-2 w-2 rounded-full bg-primary" />NEON CONTROL</div><h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">Consumo de tu cuenta</h1><p className="mt-3 max-w-xl text-muted-foreground leading-6">Una vista consolidada de todos tus proyectos Neon y sus recursos utilizados.</p></div>
        <button onClick={load} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50" disabled={loading}><RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />{loading ? 'Sincronizando' : 'Actualizar datos'}</button>
      </header>
      {error ? <div className="mt-8 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div> : <>
        <section className="grid gap-4 py-8 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={<Wallet />} label="Proyectos" value={loading ? '—' : number.format(data?.projects.length ?? 0)} detail={`${data?.organizations.length ?? 0} organizaciones`} />
          <Metric icon={<Activity />} label="Compute utilizado" value={loading ? '—' : `${number.format(totals.compute)} h`} detail="Periodo actual" />
          <Metric icon={<Database />} label="Almacenamiento" value={loading ? '—' : `${number.format(totals.storage)} GB·h`} detail="Media acumulada" />
          <Metric icon={<ArrowUpRight />} label="Transferencia" value={loading ? '—' : `${number.format(totals.transfer)} GB`} detail="Datos transferidos" />
        </section>
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-semibold">Todos los proyectos</h2><p className="mt-1 text-sm text-muted-foreground">Lectura en tiempo real desde la API de Neon</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">{loading ? 'Cargando' : `${data?.projects.length ?? 0} activos`}</span></div>
          <div className="divide-y divide-border">{loading ? [1,2,3].map(i => <div className="h-20 animate-pulse bg-muted/40" key={i} />) : data?.projects.map(project => <div className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between" key={project.id}><div className="flex items-center gap-4"><div className="flex size-10 items-center justify-center rounded-lg bg-secondary"><Server className="size-5" /></div><div><div className="font-medium">{project.name}</div><div className="mt-1 text-xs text-muted-foreground">{project.region} · {project.plan}</div></div></div><div className="grid grid-cols-3 gap-6 text-right text-sm"><div><div className="font-medium">{number.format(project.computeHours)} h</div><div className="text-xs text-muted-foreground">Compute</div></div><div><div className="font-medium">{number.format(project.storageGbHours)} GB·h</div><div className="text-xs text-muted-foreground">Storage</div></div><div><div className="font-medium">{number.format(project.transferGb)} GB</div><div className="text-xs text-muted-foreground">Transfer</div></div></div></div>)}</div>
        </section>
        <p className="mt-5 text-xs text-muted-foreground">{data?.syncedAt ? `Última sincronización: ${new Date(data.syncedAt).toLocaleString('es-ES')}` : 'Conectando con Neon...'}</p>
      </>}
    </div>
  </main>
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) { return <div className="rounded-xl border border-border bg-card p-5"><div className="mb-5 flex size-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">{icon}</div><div className="text-sm text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div><div className="mt-2 text-xs text-muted-foreground">{detail}</div></div> }

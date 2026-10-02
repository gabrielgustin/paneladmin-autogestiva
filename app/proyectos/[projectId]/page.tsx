'use client'

import Link from 'next/link'
import { ArrowLeft, Database, RefreshCw } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

type Column = { name?: string; type?: string; data_type?: string; nullable?: boolean; is_nullable?: boolean }
type Table = { name?: string; table_name?: string; schema?: string; columns?: Column[] }

export default function ProjectSchemaPage() {
  const params = useParams<{ projectId: string }>()
  const [data, setData] = useState<{ name?: string; database?: string; branch?: string; tables: Table[]; error?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  async function load() {
    setLoading(true)
    try {
      const response = await fetch(`/api/neon/schema?projectId=${encodeURIComponent(params.projectId)}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setData(result)
    } catch (error) { setData({ tables: [], error: error instanceof Error ? error.message : 'Error al cargar el esquema' }) }
    finally { setLoading(false) }
  }
  useEffect(() => { if (params.projectId) load() }, [params.projectId])
  return <main className="min-h-screen bg-brand px-5 py-8 text-brand-foreground md:px-10" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px)', backgroundSize: '42px 42px' }}>
    <div className="mx-auto max-w-7xl"><Link href="/" className="inline-flex items-center gap-2 text-sm text-brand-foreground/65 hover:text-orange"><ArrowLeft className="size-4" />Volver al panel</Link><div className="mt-8 flex flex-col justify-between gap-5 border-b border-brand-foreground/15 pb-7 md:flex-row md:items-end"><div><div className="flex items-center gap-3 text-orange"><Database className="size-5" /><span className="text-xs font-bold uppercase tracking-[0.16em]">Estructura de base</span></div><h1 className="mt-3 text-4xl font-black tracking-tight">{data?.database ?? 'Base de datos'}</h1><p className="mt-2 text-sm text-brand-foreground/60">Proyecto Neon: {data?.name ?? params.projectId} · Solo tablas, columnas y tipos. No se consultan registros.</p></div><button onClick={load} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-orange px-5 text-sm font-bold text-orange-foreground disabled:opacity-50"><RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />Actualizar esquema</button></div>{data?.error && <div className="mt-6 rounded-lg border border-orange/40 bg-orange/10 p-4 text-sm text-orange">{data.error}</div>}{loading ? <div className="mt-8 grid gap-4 md:grid-cols-2"><div className="h-40 animate-pulse rounded-xl bg-brand-foreground/10" /><div className="h-40 animate-pulse rounded-xl bg-brand-foreground/10" /></div> : <><div className="mt-6 flex flex-wrap gap-3 text-xs text-brand-foreground/60"><span className="rounded-full border border-brand-foreground/15 px-3 py-2">Base: {data?.database ?? '—'}</span><span className="rounded-full border border-brand-foreground/15 px-3 py-2">Branch: {data?.branch ?? '—'}</span><span className="rounded-full border border-brand-foreground/15 px-3 py-2">{data?.tables.length ?? 0} tablas</span></div><section className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{data?.tables.map((table, index) => <article key={`${table.schema}-${table.name}-${index}`} className="overflow-hidden rounded-xl border border-brand-foreground/15 bg-brand-foreground/10"><div className="border-b border-brand-foreground/10 px-5 py-4"><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange">{table.schema ?? 'public'}</div><h2 className="mt-1 font-bold">{table.name ?? table.table_name}</h2></div><div className="divide-y divide-brand-foreground/10">{(table.columns ?? []).map((column, columnIndex) => <div key={`${column.name}-${columnIndex}`} className="flex items-center justify-between gap-4 px-5 py-3 text-sm"><span className="truncate">{column.name}</span><span className="shrink-0 text-xs text-brand-foreground/55">{column.type ?? column.data_type ?? '—'}{column.nullable === false || column.is_nullable === false ? ' · requerido' : ''}</span></div>)}</div></article>)}{data?.tables.length === 0 && <div className="rounded-xl border border-dashed border-brand-foreground/20 p-8 text-sm text-brand-foreground/60">No se encontraron tablas en este esquema.</div>}</section></>}</div>
  </main>
}

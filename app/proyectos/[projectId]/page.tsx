'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import useSWR from 'swr'
import { ArrowLeft, Database, RefreshCw } from 'lucide-react'
import { DataGrid } from '@/components/data-grid'

type Column = { name?: string; type?: string; data_type?: string; nullable?: boolean; is_nullable?: boolean }
type Table = { name?: string; table_name?: string; schema?: string; columns?: Column[] }
type SchemaResponse = { name?: string; database?: string; branch?: string; tables: Table[] }

const fetcher = async (url: string): Promise<SchemaResponse> => {
  const response = await fetch(url)
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? 'Error al cargar el esquema')
  return result
}

export default function ProjectPage() {
  const params = useParams<{ projectId: string }>()
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    params.projectId ? `/api/neon/schema?projectId=${encodeURIComponent(params.projectId)}` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false },
  )

  const tables = (data?.tables ?? []).map((table) => ({
    name: table.name ?? table.table_name ?? 'tabla',
    schema: table.schema ?? 'public',
    columns: table.columns ?? [],
  }))

  return (
    <main
      className="min-h-screen bg-brand px-5 py-8 text-brand-foreground md:px-10"
      style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px)', backgroundSize: '42px 42px' }}
    >
      <div className="mx-auto max-w-7xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-brand-foreground/65 hover:text-orange">
          <ArrowLeft className="size-4" />
          Volver al panel
        </Link>

        <div className="mt-8 flex flex-col justify-between gap-5 border-b border-brand-foreground/15 pb-7 md:flex-row md:items-end">
          <div>
            <div className="flex items-center gap-3 text-orange">
              <Database className="size-5" />
              <span className="text-xs font-bold tracking-[0.16em] uppercase">Base de datos</span>
            </div>
            <h1 className="mt-3 text-4xl font-black tracking-tight">{data?.name ?? 'Cargando…'}</h1>
            <p className="mt-2 text-sm text-brand-foreground/60">
              Base: {data?.database ?? '—'} · Branch: {data?.branch ?? '—'} · {tables.length} tablas
            </p>
          </div>
          <button onClick={() => mutate()} disabled={isValidating} className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-orange px-5 text-sm font-bold text-orange-foreground disabled:opacity-50">
            <RefreshCw className={isValidating ? 'size-4 animate-spin' : 'size-4'} />
            Actualizar esquema
          </button>
        </div>

        {error && <div className="mt-6 rounded-lg border border-orange/40 bg-orange/10 p-4 text-sm text-orange">{error.message}</div>}

        {isLoading ? (
          <div className="mt-8 h-72 animate-pulse rounded-xl bg-brand-foreground/10" />
        ) : (
          <>
            <h2 className="mt-8 mb-3 text-xs font-bold tracking-[0.16em] text-brand-foreground/60 uppercase">Registros</h2>
            <DataGrid key={params.projectId + tables.length} projectId={params.projectId} tables={tables.map(({ name, schema }) => ({ name, schema }))} />

            <h2 className="mt-10 mb-3 text-xs font-bold tracking-[0.16em] text-brand-foreground/60 uppercase">Estructura</h2>
            {tables.length === 0 ? (
              <p className="rounded-xl border border-brand-foreground/15 p-6 text-sm text-brand-foreground/60">No se encontraron tablas en este esquema.</p>
            ) : (
              <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {tables.map((table) => (
                  <article key={`${table.schema}.${table.name}`} className="rounded-xl border border-brand-foreground/15 bg-brand-foreground/5 p-5">
                    <p className="text-xs text-brand-foreground/50">{table.schema}</p>
                    <h3 className="font-mono text-lg font-bold">{table.name}</h3>
                    <ul className="mt-4 flex flex-col gap-2 text-sm">
                      {table.columns.map((column) => (
                        <li key={column.name} className="flex items-center justify-between gap-3 border-t border-brand-foreground/10 pt-2">
                          <span className="font-mono">{column.name}</span>
                          <span className="font-mono text-xs text-brand-foreground/55">
                            {column.type ?? column.data_type}
                            {(column.nullable ?? column.is_nullable) === false ? ' · not null' : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}

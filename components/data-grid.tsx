'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpDown, Check, ChevronDown, Copy, KeyRound, RefreshCw, Search } from 'lucide-react'

type TableRef = { name: string; schema: string }
type GridColumn = { name: string; type: string; nullable: boolean; primary_key: boolean }
type RowsResponse = { columns: GridColumn[]; rows: Record<string, string | null>[]; total: number; page: number; pageSize: number; error?: string }

const fetcher = async (url: string): Promise<RowsResponse> => {
  const response = await fetch(url)
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? 'No se pudieron leer los registros')
  return result
}

export function DataGrid({ projectId, tables }: { projectId: string; tables: TableRef[] }) {
  const [tableKey, setTableKey] = useState(() => (tables[0] ? `${tables[0].schema}.${tables[0].name}` : ''))
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sort, setSort] = useState<{ column: string; dir: 'asc' | 'desc' } | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState(false)

  const selected = tables.find((table) => `${table.schema}.${table.name}` === tableKey)
  const url = selected
    ? `/api/neon/rows?${new URLSearchParams({
        projectId,
        schema: selected.schema,
        table: selected.name,
        page: String(page),
        pageSize: String(pageSize),
        ...(sort ? { sort: sort.column, dir: sort.dir } : {}),
        ...(search ? { q: search } : {}),
      })}`
    : null

  const { data, error, isLoading, isValidating, mutate } = useSWR(url, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  })

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const from = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0
  const to = data ? Math.min(data.total, data.page * data.pageSize) : 0

  function changeTable(key: string) {
    setTableKey(key)
    setPage(1)
    setSort(null)
    setSearch('')
    setSearchInput('')
  }

  function toggleSort(column: string) {
    setPage(1)
    setSort((current) => {
      if (current?.column !== column) return { column, dir: 'asc' }
      if (current.dir === 'asc') return { column, dir: 'desc' }
      return null
    })
  }

  async function copyData() {
    if (!data) return
    const header = data.columns.map((column) => column.name).join('\t')
    const body = data.rows.map((row) => data.columns.map((column) => row[column.name] ?? '').join('\t')).join('\n')
    await navigator.clipboard.writeText(`${header}\n${body}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  if (tables.length === 0) {
    return <div className="rounded-xl border border-brand-foreground/15 p-6 text-sm text-brand-foreground/60">Esta base no tiene tablas para mostrar.</div>
  }

  return (
    <section aria-label="Registros de la tabla" className="overflow-hidden rounded-xl border border-brand-foreground/15 bg-brand">
      <div className="flex flex-col gap-3 border-b border-brand-foreground/15 p-3 md:flex-row md:items-center">
        <div className="relative md:w-72">
          <select
            aria-label="Tabla"
            value={tableKey}
            onChange={(event) => changeTable(event.target.value)}
            className="h-11 w-full appearance-none rounded-lg border border-brand-foreground/20 bg-brand-foreground/10 pr-10 pl-4 font-mono text-sm text-brand-foreground outline-none focus:border-orange"
          >
            {tables.map((table) => (
              <option key={`${table.schema}.${table.name}`} value={`${table.schema}.${table.name}`} className="bg-brand text-brand-foreground">
                {table.schema === 'public' ? table.name : `${table.schema}.${table.name}`}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-brand-foreground/60" aria-hidden />
        </div>
        <form
          className="relative flex-1 md:max-w-sm"
          onSubmit={(event) => {
            event.preventDefault()
            setPage(1)
            setSearch(searchInput.trim())
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-brand-foreground/50" aria-hidden />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Buscar en todas las columnas (Enter)"
            aria-label="Buscar en la tabla"
            className="h-11 w-full rounded-lg border border-brand-foreground/15 bg-brand-foreground/10 pr-3 pl-9 text-sm text-brand-foreground outline-none placeholder:text-brand-foreground/40 focus:border-orange"
          />
        </form>
        <p className="text-xs text-brand-foreground/50 md:ml-auto">Solo lectura</p>
      </div>

      {error && <div className="m-3 rounded-lg border border-orange/40 bg-orange/10 p-4 text-sm text-orange">{error.message}</div>}

      <div className="max-h-[60vh] overflow-auto">
        {isLoading && !data ? (
          <div className="space-y-px p-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded bg-brand-foreground/10" />
            ))}
          </div>
        ) : data ? (
          <table className="w-full min-w-max border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-brand">
              <tr>
                {data.columns.map((column) => {
                  const active = sort?.column === column.name
                  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
                  return (
                    <th key={column.name} scope="col" className="border-r border-b border-brand-foreground/15 p-0 last:border-r-0" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" onClick={() => toggleSort(column.name)} className="flex w-full min-w-44 items-start justify-between gap-3 px-4 py-3 text-left hover:bg-brand-foreground/5">
                        <span>
                          <span className="block font-mono text-sm font-semibold text-brand-foreground">{column.name}</span>
                          <span className="mt-1 flex items-center gap-1.5 font-mono text-xs font-normal text-brand-foreground/50">
                            {column.primary_key && <KeyRound className="size-3 text-orange" aria-label="Clave primaria" />}
                            {!column.nullable && <span aria-label="No nulo">*</span>}
                            {column.type}
                          </span>
                        </span>
                        <Icon className={active ? 'mt-0.5 size-4 text-orange' : 'mt-0.5 size-4 text-brand-foreground/40'} aria-hidden />
                      </button>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className={isValidating ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={data.columns.length} className="px-4 py-10 text-center text-sm text-brand-foreground/50">
                    {search ? 'Ningún registro coincide con la búsqueda.' : 'La tabla está vacía.'}
                  </td>
                </tr>
              ) : (
                data.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-brand-foreground/5">
                    {data.columns.map((column) => {
                      const value = row[column.name]
                      return (
                        <td key={column.name} className="max-w-xs truncate border-r border-b border-brand-foreground/10 px-4 py-3 font-mono text-sm last:border-r-0" title={value ?? 'NULL'}>
                          {value === null ? <span className="text-brand-foreground/30">NULL</span> : value}
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-brand-foreground/15 p-3 text-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => mutate()} disabled={isValidating} aria-label="Recargar registros" className="inline-flex size-10 items-center justify-center rounded-lg border border-brand-foreground/20 hover:border-orange disabled:opacity-50">
            <RefreshCw className={isValidating ? 'size-4 animate-spin' : 'size-4'} />
          </button>
          <p className="text-brand-foreground/70">
            Mostrando {from} - {to} de {data?.total ?? 0}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} aria-label="Página anterior" className="inline-flex size-10 items-center justify-center rounded-lg border border-brand-foreground/20 hover:border-orange disabled:opacity-40">
            <ArrowLeft className="size-4" />
          </button>
          <span className="px-2 text-brand-foreground/70">
            Página {page} de {totalPages}
          </span>
          <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages} aria-label="Página siguiente" className="inline-flex size-10 items-center justify-center rounded-lg border border-brand-foreground/20 hover:border-orange disabled:opacity-40">
            <ArrowRight className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Filas por página"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value))
              setPage(1)
            }}
            className="h-10 rounded-lg border border-brand-foreground/20 bg-brand-foreground/10 px-3 text-sm text-brand-foreground outline-none focus:border-orange"
          >
            {[25, 50, 100].map((size) => (
              <option key={size} value={size} className="bg-brand text-brand-foreground">
                {size} filas
              </option>
            ))}
          </select>
          <button type="button" onClick={copyData} disabled={!data} className="inline-flex h-10 items-center gap-2 rounded-lg border border-brand-foreground/20 px-4 hover:border-orange disabled:opacity-40">
            {copied ? <Check className="size-4 text-orange" /> : <Copy className="size-4" />}
            {copied ? 'Copiado' : 'Copiar datos'}
          </button>
        </div>
      </div>
    </section>
  )
}

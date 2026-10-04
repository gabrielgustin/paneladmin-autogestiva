'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogoutButton } from '@/components/session-guard'
import { ArrowLeft, ChevronDown, Database, Pencil, Plus, RefreshCw, Search, Server, Trash2, UserRound, X } from 'lucide-react'
import Link from 'next/link'
import { COLUMN_LABELS, fingerprint, type ClientInput, type SheetClient } from '@/lib/clients-shared'

const emptyForm: ClientInput = { nombre: '', apellido: '', empresa: '', dominio: '', dominioVencimiento: '', mail: '', telefono: '', servidor: '', baseDatos: '', plan: '' }
const planOptions = ['$10.000', '$15.000', '$20.000', '$30.000', '$40.000', '$50.000']
const inputClass =
  'h-11 w-full rounded-lg border border-brand-foreground/15 bg-brand-foreground/10 px-3 text-sm text-brand-foreground outline-none placeholder:text-brand-foreground/40 focus:border-orange'

function toInput(client: SheetClient): ClientInput {
  const { row: _row, ...input } = client
  return input
}

export function ClientsDashboard() {
  const router = useRouter()
  const [clients, setClients] = useState<SheetClient[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [plan, setPlan] = useState('all')
  const [servidor, setServidor] = useState('all')
  const [editing, setEditing] = useState<SheetClient | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [form, setForm] = useState<ClientInput>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/clients', { cache: 'no-store' })
      if (response.status === 401) return router.replace('/login')
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'No se pudieron cargar los clientes')
      setClients(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los clientes')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const plans = useMemo(() => [...new Set(clients.map((client) => client.plan).filter(Boolean))], [clients])
  const servers = useMemo(() => [...new Set(clients.map((client) => client.servidor).filter(Boolean))], [clients])
  const filtered = useMemo(
    () =>
      clients.filter((client) => {
        const text = `${client.nombre} ${client.apellido} ${client.empresa} ${client.dominio} ${client.mail} ${client.telefono}`.toLowerCase()
        return text.includes(query.toLowerCase()) && (plan === 'all' || client.plan === plan) && (servidor === 'all' || client.servidor === servidor)
      }),
    [clients, plan, query, servidor],
  )

  function openNew() {
    setEditing(null)
    setForm({ ...emptyForm })
    setError('')
    setIsFormOpen(true)
  }
  function openEdit(client: SheetClient) {
    setEditing(client)
    setForm(toInput(client))
    setError('')
    setIsFormOpen(true)
  }
  function update(field: keyof ClientInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const body = editing ? { ...form, row: editing.row, expected: fingerprint(toInput(editing)) } : form
      const response = await fetch('/api/clients', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'No se pudo guardar')
      setEditing(null)
      setIsFormOpen(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  async function remove(client: SheetClient) {
    if (!window.confirm(`¿Eliminar a ${client.nombre} ${client.apellido}?`)) return
    const response = await fetch('/api/clients', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ row: client.row, expected: fingerprint(toInput(client)) }),
    })
    if (!response.ok) setError((await response.json()).error ?? 'No se pudo eliminar')
    await load()
  }

  return (
    <main
      className="min-h-screen bg-brand text-brand-foreground"
      style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px)', backgroundSize: '42px 42px' }}
    >
      <header className="border-b border-brand-foreground/10 bg-brand/85">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5 md:px-10">
          <div>
            <Link href="/" className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-brand-foreground/60 hover:text-orange">
              <ArrowLeft className="size-4" />
              Panel de infraestructura
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={load} className="inline-flex h-11 items-center gap-2 rounded-full border border-brand-foreground/20 px-4 text-sm font-bold hover:bg-brand-foreground/10">
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
            <button onClick={openNew} className="inline-flex h-11 items-center gap-2 rounded-full bg-orange px-5 text-sm font-bold text-orange-foreground disabled:opacity-50">
              <Plus className="size-4" />
              Nuevo cliente
            </button>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">
        <>
            <section className="mb-6 grid gap-4 sm:grid-cols-3">
              <Stat label="Clientes totales" value={clients.length} icon={<UserRound />} />
              <Stat label="Servidores distintos" value={servers.length} icon={<Server />} />
              <Stat label="Con base de datos" value={clients.filter((client) => client.baseDatos).length} icon={<Database />} />
            </section>
            {error && <p role="alert" className="mb-4 text-sm text-red-300">{error}</p>}
            <section className="overflow-hidden rounded-xl border border-brand-foreground/15 bg-brand-foreground/10">
              <div className="flex flex-col gap-3 border-b border-brand-foreground/10 p-4 md:flex-row">
                <label className="relative flex-1">
                  <span className="sr-only">Buscar clientes</span>
                  <Search className="absolute left-3 top-3 size-4 text-brand-foreground/45" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, mail o teléfono" className={`${inputClass} pl-10`} />
                </label>
                <SelectFilter value={servidor} onChange={setServidor} allLabel="Todos los servidores" options={servers} />
                <SelectFilter value={plan} onChange={setPlan} allLabel="Todos los planes" options={plans} />
              </div>
              <div className="divide-y divide-brand-foreground/10">
                {loading && clients.length === 0 ? (
                  <div className="p-12 text-center text-sm text-brand-foreground/60">Cargando clientes…</div>
                ) : filtered.length === 0 ? (
                  <div className="p-12 text-center text-sm text-brand-foreground/60">No hay clientes para mostrar. Creá uno con “Nuevo cliente”.</div>
                ) : (
                  filtered.map((client) => <ClientRow key={client.row} client={client} onEdit={() => openEdit(client)} onDelete={() => remove(client)} />)
                )}
              </div>
            </section>
        </>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/60 p-4 md:p-10">
          <form onSubmit={save} className="w-full max-w-2xl rounded-2xl border border-brand-foreground/15 bg-brand p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-orange">Ficha de cliente</div>
                <h2 className="mt-1 text-2xl font-bold">{editing ? 'Editar cliente' : 'Nuevo cliente'}</h2>
              </div>
              <button type="button" aria-label="Cerrar" onClick={() => { setEditing(null); setIsFormOpen(false) }} className="rounded-full p-2 text-brand-foreground/60 hover:bg-brand-foreground/10">
                <X className="size-5" />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {(Object.keys(emptyForm) as (keyof ClientInput)[]).map((field) => (
                <label key={field} className="text-xs font-semibold text-brand-foreground/65">
                  {COLUMN_LABELS[field]}
                  {field === 'plan' ? (
                    <div className="relative mt-2">
                      <select
                        required
                        value={form.plan}
                        onChange={(e) => update('plan', e.target.value)}
                        className={`${inputClass} appearance-none pr-10`}
                      >
                        <option value="">Seleccioná un plan</option>
                        {planOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-brand-foreground/70" aria-hidden="true" />
                    </div>
                  ) : (
                    <input
                      required={field === 'nombre' || field === 'apellido'}
                      type={field === 'mail' ? 'email' : field === 'dominioVencimiento' ? 'date' : 'text'}
                      value={form[field]}
                      onChange={(e) => update(field, e.target.value)}
                      className={`${inputClass} mt-2`}
                    />
                  )}
                </label>
              ))}
            </div>
            {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
            <button disabled={saving} className="mt-6 h-11 w-full rounded-full bg-orange text-sm font-bold text-orange-foreground disabled:opacity-60">
              {saving ? 'Guardando…' : 'Guardar cliente'}
            </button>
          </form>
        </div>
      )}
    </main>
  )
}

function SelectFilter({ value, onChange, allLabel, options }: { value: string; onChange: (value: string) => void; allLabel: string; options: string[] }) {
  return (
    <div className="relative md:w-52">
      <select aria-label={allLabel} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} appearance-none pr-10`}>
        <option value="all">{allLabel}</option>
        {options.map((item) => <option key={item}>{item}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-brand-foreground/70" aria-hidden="true" />
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-brand-foreground/15 bg-brand-foreground/10 p-5">
      <div className="mb-4 flex size-9 items-center justify-center rounded-lg bg-orange text-orange-foreground">{icon}</div>
      <div className="text-sm text-brand-foreground/65">{label}</div>
      <div className="mt-1 text-3xl font-black">{value}</div>
    </div>
  )
}

function ClientRow({ client, onEdit, onDelete }: { client: SheetClient; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="grid gap-4 p-5 md:grid-cols-[1.35fr_1fr_1.2fr_1fr_1fr_1fr_auto] md:items-center">
      <div className="min-w-0">
        <div className="font-bold">{client.nombre} {client.apellido}</div>
        <div className="mt-1 truncate text-xs text-brand-foreground/55">{client.mail || 'Sin mail'} · {client.telefono || 'Sin teléfono'}</div>
      </div>
      <div>
        <div className="text-xs text-brand-foreground/50">Empresa</div>
        <div className="truncate text-sm">{client.empresa || '—'}</div>
      </div>
      <div>
        <div className="text-xs text-brand-foreground/50">Dominio</div>
        <div className="truncate text-sm">{client.dominio || '—'}</div>
        <div className="mt-1 text-[11px] text-brand-foreground/45">Vence: {client.dominioVencimiento || '—'}</div>
      </div>
      <div>
        <div className="text-xs text-brand-foreground/50">Servidor</div>
        <div className="truncate text-sm">{client.servidor || '—'}</div>
      </div>
      <div>
        <div className="text-xs text-brand-foreground/50">Base de datos</div>
        <div className="truncate text-sm">{client.baseDatos || '—'}</div>
      </div>
      <div>
        <div className="text-xs text-brand-foreground/50">Plan</div>
        <div className="font-semibold text-orange">{client.plan || '—'}</div>
      </div>
      <div className="flex gap-2 md:justify-end">
        <button onClick={onEdit} className="rounded-lg border border-brand-foreground/15 p-2 text-brand-foreground/70 hover:bg-brand-foreground/10" aria-label={`Editar ${client.nombre}`}>
          <Pencil className="size-4" />
        </button>
        <button onClick={onDelete} className="rounded-lg border border-red-300/20 p-2 text-red-300 hover:bg-red-300/10" aria-label={`Eliminar ${client.nombre}`}>
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  )
}

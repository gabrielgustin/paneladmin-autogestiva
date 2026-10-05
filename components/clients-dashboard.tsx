'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogoutButton } from '@/components/session-guard'
import { ArrowLeft, CalendarClock, ChevronDown, ChevronUp, CircleDollarSign, Database, Pencil, Plus, RefreshCw, Search, Server, Trash2, UserRound, X } from 'lucide-react'
import Link from 'next/link'
import { COLUMN_LABELS, fingerprint, type ClientInput, type SheetClient } from '@/lib/clients-shared'

const emptyForm: ClientInput = { nombre: '', apellido: '', empresa: '', producto: '', dominio: '', dominioVencimiento: '', mail: '', telefono: '', servidor: '', baseDatos: '', plan: '', metodoPago: '', ultimoPago: '', proximoPago: '' }
const paymentOptions = ['Débito Automático', 'Pago mensual', 'Pago semestral', 'Pago anual']
const planOptions = ['$10.000', '$15.000', '$20.000', '$30.000', '$40.000', '$50.000']
const inputClass =
  'h-11 w-full rounded-lg border border-brand-foreground/15 bg-brand-foreground/10 px-3 text-sm text-brand-foreground outline-none placeholder:text-brand-foreground/40 focus:border-orange'

function nextPaymentDate(method: string, lastPayment: string) {
  if (!lastPayment) return ''
  const date = new Date(`${lastPayment}T12:00:00`)
  if (method === 'Débito Automático') {
    const next = new Date(date)
    next.setMonth(next.getMonth() + (date.getDate() >= 10 ? 1 : 0), 10)
    return next.toISOString().slice(0, 10)
  }
  const months = method === 'Pago semestral' ? 6 : method === 'Pago anual' ? 12 : 1
  date.setMonth(date.getMonth() + months)
  return date.toISOString().slice(0, 10)
}

function toInput(client: SheetClient): ClientInput {
  const { row: _row, ...input } = client
  return input
}

type ClientEntry = { key: string; members: SheetClient[] }

function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')
}

function buildEntries(list: SheetClient[]): ClientEntry[] {
  const entries = new Map<string, ClientEntry>()
  for (const client of list) {
    const company = normalizeText(client.empresa)
    const key = company ? `empresa:${company}` : `fila:${client.row}`
    const entry = entries.get(key)
    if (entry) entry.members.push(client)
    else entries.set(key, { key, members: [client] })
  }
  return [...entries.values()]
}

function planAmount(plan: string) {
  return Number.parseInt(plan.replace(/[^0-9]/g, ''), 10) || 0
}

function uniqueValues(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}


export function ClientsDashboard() {
  const router = useRouter()
  const [clients, setClients] = useState<SheetClient[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [plan, setPlan] = useState('all')
  const [servidor, setServidor] = useState('all')
  const [editing, setEditing] = useState<SheetClient | null>(null)
  const [selectedClient, setSelectedClient] = useState<SheetClient | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [form, setForm] = useState<ClientInput>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

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
  const activeProducts = useMemo(() => clients.filter((client) => client.producto.trim() && client.producto.trim() !== '-').length, [clients])
  const monthlyRevenue = useMemo(() => clients.reduce((total, client) => {
    const monthlyAmount = Number.parseInt(client.plan.replace(/[^0-9]/g, ''), 10) || 0
    return total + monthlyAmount
  }, 0), [clients])
  const nextExpiringDomain = useMemo(() => {
    const today = new Date()
    return clients
      .filter((client) => client.dominioVencimiento)
      .map((client) => ({
        client,
        date: new Date(`${client.dominioVencimiento}T12:00:00`),
      }))
      .filter(({ date }) => date >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0] ?? null
  }, [clients])
  const filtered = useMemo(
    () =>
      clients.filter((client) => {
        const text = `${client.nombre} ${client.apellido} ${client.empresa} ${client.producto} ${client.dominio} ${client.mail} ${client.telefono}`.toLowerCase()
        return text.includes(query.toLowerCase()) && (plan === 'all' || client.plan === plan) && (servidor === 'all' || client.servidor === servidor)
      }),
    [clients, plan, query, servidor],
  )
  const visibleEntries = useMemo(() => buildEntries(filtered), [filtered])
  const totalEntries = useMemo(() => buildEntries(clients).length, [clients])
  const isSearching = query.trim() !== ''

  function toggleGroup(key: string) {
    setExpandedGroups((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

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
    setForm((current) => {
      const next = { ...current, [field]: value }
      if (field === 'metodoPago' || field === 'ultimoPago') next.proximoPago = nextPaymentDate(next.metodoPago, next.ultimoPago)
      return next
    })
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

  async function persistOrder(reordered: SheetClient[]) {
    setClients(reordered)
    const response = await fetch('/api/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: reordered.map((item) => item.row) }),
    })
    if (!response.ok) {
      setError((await response.json()).error ?? 'No se pudo guardar el orden')
      await load()
    }
  }

  async function moveEntry(key: string, direction: -1 | 1) {
    const visibleIndex = visibleEntries.findIndex((entry) => entry.key === key)
    const target = visibleEntries[visibleIndex + direction]
    if (visibleIndex < 0 || !target) return
    const entries = buildEntries(clients)
    const from = entries.findIndex((entry) => entry.key === key)
    const to = entries.findIndex((entry) => entry.key === target.key)
    if (from < 0 || to < 0) return
    ;[entries[from], entries[to]] = [entries[to], entries[from]]
    await persistOrder(entries.flatMap((entry) => entry.members))
  }

  async function moveWithinGroup(entry: ClientEntry, client: SheetClient, direction: -1 | 1) {
    const sibling = entry.members[entry.members.findIndex((member) => member.row === client.row) + direction]
    if (!sibling) return
    const reordered = [...clients]
    const from = reordered.findIndex((item) => item.row === client.row)
    const to = reordered.findIndex((item) => item.row === sibling.row)
    if (from < 0 || to < 0) return
    ;[reordered[from], reordered[to]] = [reordered[to], reordered[from]]
    await persistOrder(reordered)
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
      className="min-h-screen overflow-x-hidden bg-brand text-brand-foreground"
      style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px)', backgroundSize: '42px 42px' }}
    >
      <header className="border-b border-brand-foreground/10 bg-brand/85">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5 md:px-10">
          <div>
            <Link href="/" className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-brand-foreground/60 hover:text-orange">
              <ArrowLeft className="size-4" />
              Panel de infraestructura
            </Link>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <button onClick={load} className="inline-flex h-11 items-center gap-2 rounded-full border border-brand-foreground/20 px-4 text-sm font-bold hover:bg-brand-foreground/10">
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-8 md:px-10">
        <>
            <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Clientes totales" value={totalEntries} icon={<UserRound />} />
              <Stat label="Recaudación mensual estimada" value={`$${Math.round(monthlyRevenue).toLocaleString('es-AR')}`} icon={<CircleDollarSign />} />
              <Stat
                label="Próximo dominio a vencer"
                value={
                  <>
                    <span className="block truncate">{nextExpiringDomain?.client.empresa || 'Sin empresa'}</span>
                    <span className="mt-1 block text-sm font-medium text-brand-foreground/50">
                      {nextExpiringDomain ? nextExpiringDomain.date.toLocaleDateString('es-AR') : 'Sin fecha registrada'}
                    </span>
                  </>
                }
                icon={<CalendarClock />}
              />
              <Stat label="Productos activos" value={activeProducts} icon={<CircleDollarSign />} />
            </section>
            {error && <p role="alert" className="mb-4 text-sm text-red-300">{error}</p>}
            <section className="overflow-hidden rounded-xl border border-brand-foreground/15 bg-brand-foreground/10">
              <div className="flex flex-col gap-3 border-b border-brand-foreground/10 p-3 sm:p-4 md:flex-row">
                <label className="relative flex-1">
                  <span className="sr-only">Buscar clientes</span>
                  <Search className="absolute left-3 top-3 size-4 text-brand-foreground/45" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, mail o teléfono" className={`${inputClass} pl-10`} />
                </label>
                <SelectFilter value={servidor} onChange={setServidor} allLabel="Todos los servidores" options={servers} />
                <SelectFilter value={plan} onChange={setPlan} allLabel="Todos los planes" options={plans} />
                <button onClick={openNew} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-orange px-5 text-sm font-bold text-orange-foreground disabled:opacity-50">
                  <Plus className="size-4" />
                  Nuevo cliente
                </button>
              </div>
              <div className="hidden border-b border-brand-foreground/10 px-5 py-3 text-xs font-semibold text-brand-foreground/50 md:grid md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_8rem] md:items-center md:gap-4">
                <div>Cliente</div>
                <div>Empresa</div>
                <div>Producto</div>
                <div>Dominio</div>
                <div>Servidor</div>
                <div>Base de datos</div>
                <div className="leading-4">Plan</div>
                <div />
              </div>
              <div className="divide-y divide-brand-foreground/10">
                {loading && clients.length === 0 ? (
                  <div className="p-12 text-center text-sm text-brand-foreground/60">Cargando clientes…</div>
                ) : filtered.length === 0 ? (
                  <div className="p-12 text-center text-sm text-brand-foreground/60">No hay clientes para mostrar. Creá uno con “Nuevo cliente”.</div>
                ) : (
                  visibleEntries.map((entry, entryIndex) => {
                    const canMoveUp = entryIndex > 0
                    const canMoveDown = entryIndex < visibleEntries.length - 1
                    if (entry.members.length === 1) {
                      const client = entry.members[0]
                      return <ClientRow key={entry.key} client={client} canMoveUp={canMoveUp} canMoveDown={canMoveDown} onMoveUp={() => moveEntry(entry.key, -1)} onMoveDown={() => moveEntry(entry.key, 1)} onOpen={() => setSelectedClient(client)} onEdit={() => openEdit(client)} onDelete={() => remove(client)} />
                    }
                    return (
                      <GroupRow key={entry.key} entry={entry} expanded={isSearching || expandedGroups.has(entry.key)} canMoveUp={canMoveUp} canMoveDown={canMoveDown} onToggle={() => toggleGroup(entry.key)} onMoveUp={() => moveEntry(entry.key, -1)} onMoveDown={() => moveEntry(entry.key, 1)}>
                        {entry.members.map((client, memberIndex) => (
                          <ClientRow key={client.row} client={client} canMoveUp={memberIndex > 0} canMoveDown={memberIndex < entry.members.length - 1} onMoveUp={() => moveWithinGroup(entry, client, -1)} onMoveDown={() => moveWithinGroup(entry, client, 1)} onOpen={() => setSelectedClient(client)} onEdit={() => openEdit(client)} onDelete={() => remove(client)} />
                        ))}
                      </GroupRow>
                    )
                  })
                )}
              </div>
            </section>
        </>
      </div>

      {selectedClient && (
        <ClientDetails client={selectedClient} onClose={() => setSelectedClient(null)} />
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/60 p-2 sm:p-4 md:p-10">
          <form onSubmit={save} className="w-full max-w-2xl rounded-2xl border border-brand-foreground/15 bg-brand p-4 shadow-2xl sm:p-6">
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
              {(Object.keys(emptyForm) as (keyof ClientInput)[]).filter((field) => field !== 'proximoPago').map((field) => (
                <label key={field} className="text-xs font-semibold text-brand-foreground/65">
                  {field === 'ultimoPago' ? 'Fecha del pago' : COLUMN_LABELS[field]}
                  {field === 'plan' || field === 'metodoPago' ? (
                    <div className="relative mt-2">
                      <select
                        required
                        value={form[field]}
                        onChange={(e) => update(field, e.target.value)}
                        className={`${inputClass} appearance-none pr-10`}
                      >
                        <option value="">Seleccioná {field === 'plan' ? 'un plan' : 'un método'}</option>
                        {(field === 'plan' ? planOptions : paymentOptions).map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-brand-foreground/70" aria-hidden="true" />
                    </div>
                  ) : (
                    <input
                      required={field === 'nombre' || field === 'apellido' || field === 'ultimoPago'}
                      type={field === 'mail' ? 'email' : ['dominioVencimiento', 'ultimoPago'].includes(field) ? 'date' : 'text'}
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
    <div className="relative w-full md:w-52">
      <select aria-label={allLabel} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} appearance-none pr-10`}>
        <option value="all">{allLabel}</option>
        {options.map((item) => <option key={item}>{item}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-brand-foreground/70" aria-hidden="true" />
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-brand-foreground/15 bg-brand-foreground/10 p-5">
      <div className="mb-4 flex size-9 items-center justify-center rounded-lg bg-orange text-orange-foreground">{icon}</div>
      <div className="text-sm text-brand-foreground/65">{label}</div>
      <div className="mt-1 text-3xl font-black">{value}</div>
    </div>
  )
}

function ClientDetails({ client, onClose }: { client: SheetClient; onClose: () => void }) {
  const details = [
    ['Nombre', `${client.nombre} ${client.apellido}`],
    ['Empresa', client.empresa],
    ['Producto', client.producto],
    ['Dominio', client.dominio],
    ['Vencimiento del dominio', client.dominioVencimiento],
    ['Mail', client.mail],
    ['Tel��fono', client.telefono],
    ['Servidor', client.servidor],
    ['Base de datos', client.baseDatos],
    ['Plan', client.plan],
    ['Método de pago', client.metodoPago],
    ['Último pago', client.ultimoPago],
    ['Próximo pago', client.proximoPago],
  ]

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-brand/70 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="client-details-title" className="w-full max-w-2xl rounded-2xl border border-brand-foreground/15 bg-brand p-5 shadow-2xl sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-orange">Detalle del cliente</div>
            <h2 id="client-details-title" className="mt-1 text-2xl font-bold text-balance">{client.nombre} {client.apellido}</h2>
          </div>
          <button type="button" aria-label="Cerrar detalle" onClick={onClose} className="rounded-full p-2 text-brand-foreground/60 hover:bg-brand-foreground/10">
            <X className="size-5" />
          </button>
        </div>
        <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
          {details.map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-xl border border-brand-foreground/10 bg-brand-foreground/5 p-3">
              <dt className="text-xs font-semibold text-brand-foreground/50">{label}</dt>
              <dd className="mt-1 truncate text-sm font-medium">{value || '—'}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}

const feminineNames = new Set(['ana', 'beatriz', 'camila', 'carla', 'carmen', 'clara', 'daniela', 'elena', 'emilia', 'florencia', 'gabriela', 'ines', 'isabel', 'josefina', 'julieta', 'laura', 'lucia', 'luisa', 'marcela', 'maria', 'mariana', 'martina', 'maria', 'monica', 'natalia', 'noelia', 'patricia', 'paula', 'romina', 'rosa', 'sofia', 'valentina', 'veronica'])

function clientLabel(nombre: string) {
  return feminineNames.has(normalizeText(nombre)) ? 'Clienta' : 'Cliente'
}

const rowGridClass = 'grid grid-cols-2 items-start gap-x-4 gap-y-3 p-4 sm:gap-4 sm:p-5 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_8rem] [&>*]:self-start'

function summarize(values: string[], plural: string) {
  if (values.length === 0) return '—'
  return values.length === 1 ? values[0] : `${values.length} ${plural}`
}

function GroupRow({ entry, expanded, canMoveUp, canMoveDown, onToggle, onMoveUp, onMoveDown, children }: { entry: ClientEntry; expanded: boolean; canMoveUp: boolean; canMoveDown: boolean; onToggle: () => void; onMoveUp: () => void; onMoveDown: () => void; children: React.ReactNode }) {
  const { members } = entry
  const names = uniqueValues(members.map((member) => `${member.nombre} ${member.apellido}`))
  const products = uniqueValues(members.map((member) => member.producto))
  const domains = uniqueValues(members.map((member) => member.dominio))
  const servers = uniqueValues(members.map((member) => member.servidor))
  const databases = uniqueValues(members.map((member) => member.baseDatos))
  const totalPlan = members.reduce((total, member) => total + planAmount(member.plan), 0)

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onToggle() } }}
        className={`${rowGridClass} cursor-pointer border-l-2 ${expanded ? 'border-orange/50' : 'border-transparent'} transition-colors hover:bg-brand-foreground/5 focus:outline-none focus:ring-2 focus:ring-orange/60 md:items-start`}
      >
        <div className="col-span-2 min-w-0 md:col-span-1">
          <div className="text-xs text-brand-foreground/50">{names.length > 1 ? 'Clientes' : clientLabel(members[0].nombre)}</div>
          <div className="truncate font-bold" title={names.join(', ')}>{names.join(', ') || '—'}</div>
        </div>
        <div className="min-w-0">
          <div className="text-xs text-brand-foreground/50">Empresa</div>
          <div className="truncate text-sm font-semibold">{members[0].empresa}</div>
          <div className="mt-1 text-[11px] text-orange">{members.length} servicios</div>
        </div>
        <div className="min-w-0" aria-hidden="true" />
        <div className="min-w-0" aria-hidden="true" />
        <div className="min-w-0" aria-hidden="true" />
        <div className="min-w-0" aria-hidden="true" />
        <div className="min-w-0 self-start">
          <div className="min-h-4 text-xs leading-4 text-brand-foreground/50">Plan (total)</div>
          <div className="font-semibold leading-6 text-orange">{totalPlan ? `$${totalPlan.toLocaleString('es-AR')}` : '—'}</div>
        </div>
        <div className="col-span-2 flex items-center gap-1 md:col-span-1 md:justify-end" onClick={(event) => event.stopPropagation()}>
          <div className="mr-1 flex flex-col">
            <button type="button" aria-label={`Mover ${members[0].empresa} hacia arriba`} disabled={!canMoveUp} onClick={onMoveUp} className="rounded p-1 text-brand-foreground/50 hover:bg-brand-foreground/10 disabled:opacity-20"><ChevronUp className="size-3.5" /></button>
            <button type="button" aria-label={`Mover ${members[0].empresa} hacia abajo`} disabled={!canMoveDown} onClick={onMoveDown} className="rounded p-1 text-brand-foreground/50 hover:bg-brand-foreground/10 disabled:opacity-20"><ChevronDown className="size-3.5" /></button>
          </div>
          <button type="button" onClick={onToggle} aria-label={expanded ? `Contraer ${members[0].empresa}` : `Expandir ${members[0].empresa}`} className="rounded-lg border border-brand-foreground/15 p-2 text-brand-foreground/70 hover:bg-brand-foreground/10">
            <ChevronDown className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
      {expanded && <div className="divide-y divide-brand-foreground/10 border-l-2 border-t border-orange/50 border-t-brand-foreground/10 bg-brand/40">{children}</div>}
    </div>
  )
}

function ClientRow({ client, canMoveUp, canMoveDown, onMoveUp, onMoveDown, onOpen, onEdit, onDelete }: { client: SheetClient; canMoveUp: boolean; canMoveDown: boolean; onMoveUp: () => void; onMoveDown: () => void; onOpen: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen() } }}
      className="grid cursor-pointer grid-cols-2 items-start gap-x-4 gap-y-3 p-4 transition-colors hover:bg-brand-foreground/5 focus:outline-none focus:ring-2 focus:ring-orange/60 sm:gap-4 sm:p-5 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_8rem] md:items-start"
    >
      <div className="col-span-2 min-w-0 md:col-span-1">
        <div className="text-xs text-brand-foreground/50">{clientLabel(client.nombre)}</div>
        <div className="font-bold">{client.nombre} {client.apellido}</div>
        {client.telefono ? (
          <a href={`https://wa.me/${client.telefono.replace(/\D/g, '')}?text=${encodeURIComponent('Hola')}`} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="mt-1 block truncate text-xs text-brand-foreground/55 underline-offset-2 hover:text-orange hover:underline">{client.telefono}</a>
        ) : <div className="mt-1 truncate text-xs text-brand-foreground/55">Sin teléfono</div>}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-brand-foreground/50">Empresa</div>
        <div className={`truncate text-sm ${client.empresa === '-' ? 'text-center' : ''}`}>{client.empresa || '—'}</div>
      </div>
      <div className="min-w-0">
        <div className="text-xs text-brand-foreground/50">Producto</div>
        <div className={`truncate text-sm ${client.producto === '-' ? 'text-center' : ''}`}>{client.producto || '—'}</div>
      </div>
      <div className="min-w-0">
        <div className="text-xs text-brand-foreground/50">Dominio</div>
        <div className={`truncate text-sm ${client.dominio === '-' ? 'text-center' : ''}`}>{client.dominio || '—'}</div>
        <div className="mt-1 text-[11px] text-brand-foreground/45">Vence: {client.dominioVencimiento || '—'}</div>
      </div>
      <div className="min-w-0">
        <div className="text-xs text-brand-foreground/50">Servidor</div>
        <div className={`truncate text-sm ${client.servidor === '-' ? 'text-center' : ''}`}>{client.servidor || '—'}</div>
      </div>
      <div className="min-w-0">
        <div className="text-xs text-brand-foreground/50">Base de datos</div>
        <div className={`truncate text-sm ${client.baseDatos === '-' ? 'text-center' : ''}`}>{client.baseDatos || '—'}</div>
      </div>
      <div className="min-w-0">
        <div className="text-xs text-brand-foreground/50">Plan</div>
        <div className="font-semibold text-orange">{client.plan || '—'}</div>
      </div>
      <div className="col-span-2 flex items-center gap-1 md:col-span-1 md:justify-end" onClick={(event) => event.stopPropagation()}>
        <div className="mr-1 flex flex-col">
          <button type="button" aria-label="Mover cliente hacia arriba" disabled={!canMoveUp} onClick={onMoveUp} className="rounded p-1 text-brand-foreground/50 hover:bg-brand-foreground/10 disabled:opacity-20"><ChevronUp className="size-3.5" /></button>
          <button type="button" aria-label="Mover cliente hacia abajo" disabled={!canMoveDown} onClick={onMoveDown} className="rounded p-1 text-brand-foreground/50 hover:bg-brand-foreground/10 disabled:opacity-20"><ChevronDown className="size-3.5" /></button>
        </div>
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

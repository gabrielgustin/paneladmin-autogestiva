'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronDown, Globe, Pencil, Plus, Search, Server, Trash2, UserRound, X } from 'lucide-react'
import Link from 'next/link'

type Client = { id: string; firstName: string; lastName: string; phone: string | null; hostingPlan: string; domain: string | null; server: string | null; github: string | null; status: string; notes: string | null }
type Form = Omit<Client, 'id'>
const hostingPlans = ['$ 10.000', '$ 15.000', '$ 20.000', '$ 25.000', '$ 30.000', '$ 40.000', '$ 50.000']
const empty: Form = { firstName: '', lastName: '', phone: '', hostingPlan: hostingPlans[0], domain: '', server: '', github: '', status: 'active', notes: '' }
const inputClass = 'h-11 w-full rounded-lg border border-brand-foreground/15 bg-brand-foreground/10 px-3 text-sm text-brand-foreground outline-none placeholder:text-brand-foreground/40 focus:border-orange'

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [query, setQuery] = useState('')
  const [plan, setPlan] = useState('all')
  const [status, setStatus] = useState('all')
  const [editing, setEditing] = useState<Client | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [form, setForm] = useState<Form>(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const response = await fetch('/api/clients', { cache: 'no-store' })
    if (!response.ok) throw new Error('No se pudieron cargar los clientes')
    setClients(await response.json())
  }
  useEffect(() => { load().catch((e) => setError(e.message)) }, [])

  const plans = useMemo(() => [...new Set(clients.map((client) => client.hostingPlan))], [clients])
  const filtered = useMemo(() => clients.filter((client) => {
    const text = `${client.firstName} ${client.lastName} ${client.domain ?? ''} ${client.github ?? ''}`.toLowerCase()
    return text.includes(query.toLowerCase()) && (plan === 'all' || client.hostingPlan === plan) && (status === 'all' || client.status === status)
  }), [clients, plan, query, status])

  function openNew() { setEditing(null); setForm({ ...empty }); setError(''); setIsFormOpen(true) }
  function openEdit(client: Client) { setEditing(client); setForm({ ...client }); setError(''); setIsFormOpen(true) }
  function update(field: keyof Form, value: string) { setForm((current) => ({ ...current, [field]: value })) }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const response = await fetch('/api/clients', { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing ? { ...form, id: editing.id } : form) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      await load(); setEditing(null); setIsFormOpen(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') } finally { setSaving(false) }
  }
  async function remove(client: Client) {
    if (!window.confirm(`¿Eliminar a ${client.firstName} ${client.lastName}?`)) return
    await fetch('/api/clients', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: client.id }) }); await load()
  }

  return <main className="min-h-screen bg-brand text-brand-foreground" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px)', backgroundSize: '42px 42px' }}>
    <header className="border-b border-brand-foreground/10 bg-brand/85"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-10"><div><Link href="/" className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-brand-foreground/60 hover:text-orange"><ArrowLeft className="size-4" />Panel de infraestructura</Link><h1 className="text-3xl font-black tracking-tight md:text-5xl">Clientes</h1><p className="mt-2 text-sm text-brand-foreground/65">Tu cartera, hosting y accesos en un solo lugar.</p></div><button onClick={openNew} className="inline-flex h-11 items-center gap-2 rounded-full bg-orange px-5 text-sm font-bold text-orange-foreground"><Plus className="size-4" />Nuevo cliente</button></div></header>
    <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">
      <section className="mb-6 grid gap-4 sm:grid-cols-3"><Stat label="Clientes totales" value={clients.length} icon={<UserRound />} /><Stat label="Activos" value={clients.filter((client) => client.status === 'active').length} icon={<Server />} /><Stat label="Dominios registrados" value={clients.filter((client) => client.domain).length} icon={<Globe />} /></section>
      <section className="overflow-hidden rounded-xl border border-brand-foreground/15 bg-brand-foreground/10"><div className="flex flex-col gap-3 border-b border-brand-foreground/10 p-4 md:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-3 size-4 text-brand-foreground/45" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, dominio o GitHub" className={`${inputClass} pl-10`} /></label><div className="relative md:w-44"><select value={plan} onChange={(e) => setPlan(e.target.value)} className={inputClass + ' appearance-none pr-10 md:w-44'}><option value="all">Todos los planes</option>{plans.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-brand-foreground/70" aria-hidden="true" /></div><div className="relative md:w-36"><select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass + ' appearance-none pr-10 md:w-36'}><option value="all">Todos</option><option value="active">Activos</option><option value="paused">Pausados</option></select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-brand-foreground/70" aria-hidden="true" /></div></div><div className="divide-y divide-brand-foreground/10">{filtered.length === 0 ? <div className="p-12 text-center text-sm text-brand-foreground/60">Todavía no hay clientes cargados. Creá el primero con “Nuevo cliente”.</div> : filtered.map((client) => <ClientRow key={client.id} client={client} onEdit={() => openEdit(client)} onDelete={() => remove(client)} />)}</div></section>
    </div>
    {isFormOpen && <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/60 p-4 md:p-10"><form onSubmit={save} className="w-full max-w-2xl rounded-2xl border border-brand-foreground/15 bg-brand p-6 shadow-2xl"><div className="mb-6 flex items-center justify-between"><div><div className="text-xs font-bold uppercase tracking-[0.16em] text-orange">Ficha de cliente</div><h2 className="mt-1 text-2xl font-bold">{editing ? 'Editar cliente' : 'Nuevo cliente'}</h2></div><button type="button" onClick={() => { setEditing(null); setIsFormOpen(false) }} className="rounded-full p-2 text-brand-foreground/60 hover:bg-brand-foreground/10"><X className="size-5" /></button></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Nombre" value={form.firstName} onChange={(v) => update('firstName', v)} required /><Field label="Apellido" value={form.lastName} onChange={(v) => update('lastName', v)} required /><Field label="Teléfono" value={form.phone ?? ''} onChange={(v) => update('phone', v)} /><PlanField value={form.hostingPlan} onChange={(v) => update('hostingPlan', v)} /><Field label="Dominio" value={form.domain ?? ''} onChange={(v) => update('domain', v)} /><Field label="Servidor" value={form.server ?? ''} onChange={(v) => update('server', v)} /><Field label="GitHub" value={form.github ?? ''} onChange={(v) => update('github', v)} /><label className="text-xs font-semibold text-brand-foreground/65">Estado<select value={form.status} onChange={(e) => update('status', e.target.value)} className={`${inputClass} mt-2`}><option value="active">Activo</option><option value="paused">Pausado</option></select></label><label className="text-xs font-semibold text-brand-foreground/65 sm:col-span-2">Notas<textarea value={form.notes ?? ''} onChange={(e) => update('notes', e.target.value)} className={`${inputClass} mt-2 h-24 py-3`} /></label></div>{error && <p className="mt-4 text-sm text-red-300">{error}</p>}<button disabled={saving} className="mt-6 h-11 w-full rounded-lg bg-orange font-bold text-orange-foreground disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar cliente'}</button></form></div>}
  </main>
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) { return <div className="rounded-xl border border-brand-foreground/15 bg-brand-foreground/10 p-5"><div className="mb-4 flex size-9 items-center justify-center rounded-lg bg-orange text-orange-foreground">{icon}</div><div className="text-sm text-brand-foreground/65">{label}</div><div className="mt-1 text-3xl font-black">{value}</div></div> }
function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) { return <label className="text-xs font-semibold text-brand-foreground/65">{label}<input required={required} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} mt-2`} /></label> }
function PlanField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const isPreset = hostingPlans.includes(value)
  return <label className="text-xs font-semibold text-brand-foreground/65">Plan de hosting<div className="relative mt-2"><select value={isPreset ? value : 'custom'} onChange={(event) => onChange(event.target.value === 'custom' ? (isPreset ? '' : value) : event.target.value)} className={`${inputClass} appearance-none pr-10`}><option value="" disabled>Seleccioná un plan</option>{hostingPlans.map((plan) => <option key={plan} value={plan}>{plan}</option>)}<option value="custom">Personalizado</option></select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-brand-foreground/70" aria-hidden="true" /></div>{!isPreset && <input aria-label="Importe personalizado" inputMode="decimal" placeholder="$ 12.500" value={value} onChange={(event) => onChange(event.target.value)} className={`${inputClass} mt-2`} />}</label>
}
function ClientRow({ client, onEdit, onDelete }: { client: Client; onEdit: () => void; onDelete: () => void }) { return <div className="grid gap-4 p-5 md:grid-cols-[1.3fr_1fr_1fr_1fr_auto] md:items-center"><div><div className="font-bold">{client.firstName} {client.lastName}</div><div className="mt-1 text-xs text-brand-foreground/55">{client.phone || 'Sin teléfono'}</div></div><div><div className="text-xs text-brand-foreground/50">Plan</div><div className="font-semibold text-orange">{client.hostingPlan}</div></div><div><div className="text-xs text-brand-foreground/50">Dominio</div><div className="truncate text-sm">{client.domain || '—'}</div></div><div><div className="text-xs text-brand-foreground/50">Servidor / GitHub</div><div className="truncate text-sm">{client.server || '—'} · {client.github || '—'}</div></div><div className="flex gap-2 md:justify-end"><button onClick={onEdit} className="rounded-lg border border-brand-foreground/15 p-2 text-brand-foreground/70 hover:bg-brand-foreground/10" aria-label={`Editar ${client.firstName}`}><Pencil className="size-4" /></button><button onClick={onDelete} className="rounded-lg border border-red-300/20 p-2 text-red-300 hover:bg-red-300/10" aria-label={`Eliminar ${client.firstName}`}><Trash2 className="size-4" /></button></div></div> }

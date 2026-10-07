import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

// Created on first use so a missing env var returns a 503 from the route guard instead of crashing on import.
function getClient() {
  client ??= createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  return client
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get: (_target, prop) => Reflect.get(getClient(), prop),
})

export type SupabaseClientRow = {
  id: string
  nombre: string
  apellido: string
  empresa: string | null
  producto: string | null
  dominio: string | null
  dominio_vencimiento: string | null
  mail: string | null
  telefono: string | null
  servidor: string | null
  base_datos: string | null
  plan: string | null
  metodo_pago: string | null
  ultimo_pago: string | null
  proximo_pago: string | null
  orden: number | null
}

export function toClient(row: SupabaseClientRow) {
  return { row: row.id, nombre: row.nombre, apellido: row.apellido, empresa: row.empresa ?? '', producto: row.producto ?? '', dominio: row.dominio ?? '', dominioVencimiento: row.dominio_vencimiento ?? '', mail: row.mail ?? '', telefono: row.telefono ?? '', servidor: row.servidor ?? '', baseDatos: row.base_datos ?? '', plan: row.plan ?? '', metodoPago: row.metodo_pago ?? '', ultimoPago: row.ultimo_pago ?? '', proximoPago: row.proximo_pago ?? '', orden: row.orden ?? 0 }
}

const FIELD_MAX = 200
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function text(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, FIELD_MAX) : ''
}

// Returns the DB row for a client form, or an error message when required data is missing or invalid.
export function toRow(input: Record<string, unknown>): { row: Record<string, string | null> } | { error: string } {
  const nombre = text(input.nombre)
  const apellido = text(input.apellido)
  if (!nombre || !apellido) return { error: 'Nombre y apellido son obligatorios' }
  const dates = { dominio_vencimiento: text(input.dominioVencimiento), ultimo_pago: text(input.ultimoPago), proximo_pago: text(input.proximoPago) }
  if (Object.values(dates).some((value) => value && !DATE_RE.test(value))) return { error: 'Las fechas deben tener formato AAAA-MM-DD' }
  return {
    row: {
      nombre, apellido,
      empresa: text(input.empresa) || null, producto: text(input.producto) || null, dominio: text(input.dominio) || null,
      dominio_vencimiento: dates.dominio_vencimiento || null, mail: text(input.mail) || null, telefono: text(input.telefono) || null,
      servidor: text(input.servidor) || null, base_datos: text(input.baseDatos) || null, plan: text(input.plan) || null,
      metodo_pago: text(input.metodoPago) || null, ultimo_pago: dates.ultimo_pago || null, proximo_pago: dates.proximo_pago || null,
      updated_at: new Date().toISOString(),
    },
  }
}

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL))
}

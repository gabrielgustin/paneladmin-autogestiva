import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

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

export function toRow(input: Record<string, string>) {
  return { nombre: input.nombre, apellido: input.apellido, empresa: input.empresa || null, producto: input.producto || null, dominio: input.dominio || null, dominio_vencimiento: input.dominioVencimiento || null, mail: input.mail || null, telefono: input.telefono || null, servidor: input.servidor || null, base_datos: input.baseDatos || null, plan: input.plan || null, metodo_pago: input.metodoPago || null, ultimo_pago: input.ultimoPago || null, proximo_pago: input.proximoPago || null, updated_at: new Date().toISOString() }
}

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL))
}

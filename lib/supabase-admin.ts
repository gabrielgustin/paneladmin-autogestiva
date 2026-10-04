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
  mail: string | null
  telefono: string | null
  servidor: string | null
  base_datos: string | null
  plan: string | null
}

export function toClient(row: SupabaseClientRow) {
  return { row: row.id, nombre: row.nombre, apellido: row.apellido, mail: row.mail ?? '', telefono: row.telefono ?? '', servidor: row.servidor ?? '', baseDatos: row.base_datos ?? '', plan: row.plan ?? '' }
}

export function toRow(input: Record<string, string>) {
  return { nombre: input.nombre, apellido: input.apellido, mail: input.mail || null, telefono: input.telefono || null, servidor: input.servidor || null, base_datos: input.baseDatos || null, plan: input.plan || null, updated_at: new Date().toISOString() }
}

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL))
}

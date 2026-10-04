import { createClient } from '@supabase/supabase-js'

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Faltan las variables de Supabase')

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export type ClientRecord = {
  id: string
  nombre: string
  apellido: string
  mail: string | null
  telefono: string | null
  servidor: string | null
  base_datos: string | null
  plan: string | null
}

export function toClient(record: ClientRecord) {
  return {
    row: record.id,
    nombre: record.nombre,
    apellido: record.apellido,
    mail: record.mail ?? '',
    telefono: record.telefono ?? '',
    servidor: record.servidor ?? '',
    baseDatos: record.base_datos ?? '',
    plan: record.plan ?? '',
  }
}

export function fromClient(input: Record<string, string>) {
  return {
    nombre: input.nombre,
    apellido: input.apellido,
    mail: input.mail || null,
    telefono: input.telefono || null,
    servidor: input.servidor || null,
    base_datos: input.baseDatos || null,
    plan: input.plan || null,
    updated_at: new Date().toISOString(),
  }
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function fingerprint(input: Record<string, string>) {
  return [input.nombre, input.apellido, input.mail, input.telefono, input.servidor, input.baseDatos, input.plan].join('|')
}

export function fingerprintClient(client: ReturnType<typeof toClient>) {
  return fingerprint(client)
}

export function parseSupabaseError(error: { message?: string } | null) {
  return error?.message || 'No se pudo completar la operación en Supabase'
}

export function sanitizeInput(body: Record<string, unknown>) {
  return Object.fromEntries(
    ['nombre', 'apellido', 'mail', 'telefono', 'servidor', 'baseDatos', 'plan'].map((key) => [
      key,
      typeof body[key] === 'string' ? body[key].trim().slice(0, 500) : '',
    ]),
  ) as Record<string, string>
}

export function validateInput(input: Record<string, string>) {
  if (!input.nombre || !input.apellido) return 'Nombre y apellido son obligatorios'
  return null
}

export function mapClientInput(input: Record<string, string>) {
  return fromClient(input)
}

export function mapRecord(record: ClientRecord) {
  return toClient(record)
}

export function recordMatches(record: ClientRecord, expected: string) {
  return fingerprintClient(toClient(record)) === expected
}

export function normalizeId(value: unknown) {
  return typeof value === 'string' && isUuid(value) ? value : null
}

export function getClientSelect() {
  return 'id, nombre, apellido, mail, telefono, servidor, base_datos, plan'
}

export function noStoreHeaders() {
  return { 'Cache-Control': 'no-store' }
}

export function supabaseErrorMessage(error: { message?: string } | null) {
  return parseSupabaseError(error)
}

export function clientColumns() {
  return ['nombre', 'apellido', 'mail', 'telefono', 'servidor', 'base_datos', 'plan'] as const
}

export function isClientRecord(value: unknown): value is ClientRecord {
  return Boolean(value && typeof value === 'object' && 'id' in value && 'nombre' in value && 'apellido' in value)
}

export function toDatabaseInput(input: Record<string, string>) {
  return fromClient(input)
}

export function toDashboardClient(record: ClientRecord) {
  return toClient(record)
}

export function getClientId(body: Record<string, unknown>) {
  return normalizeId(body.id ?? body.row)
}

export function getExpected(body: Record<string, unknown>) {
  return typeof body.expected === 'string' ? body.expected : ''
}

export function clientError(message: string) {
  return new Error(message)
}

export function asInput(body: Record<string, unknown>) {
  const input = sanitizeInput(body)
  const error = validateInput(input)
  if (error) throw clientError(error)
  return input
}

export function isMissingTable(error: { code?: string } | null) {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

export function nowIso() {
  return new Date().toISOString()
}

export function emptyToNull(value: string) {
  return value || null
}

export function toNullableInput(input: Record<string, string>) {
  return {
    nombre: input.nombre,
    apellido: input.apellido,
    mail: emptyToNull(input.mail),
    telefono: emptyToNull(input.telefono),
    servidor: emptyToNull(input.servidor),
    base_datos: emptyToNull(input.baseDatos),
    plan: emptyToNull(input.plan),
  }
}

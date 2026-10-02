import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { clients } from './schema'

const globalForDb = globalThis as unknown as { pool?: Pool }
const pool = globalForDb.pool ?? new Pool({ connectionString: process.env.DATABASE_URL })
if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool

export const db = drizzle(pool, { schema: { clients } })
export { clients }

export type ClientInput = {
  firstName: string
  lastName: string
  phone?: string
  hostingPlan: string
  domain?: string
  server?: string
  github?: string
  status: string
  notes?: string
}

export function normalizeClient(input: Partial<ClientInput>): ClientInput {
  const firstName = String(input.firstName ?? '').trim()
  const lastName = String(input.lastName ?? '').trim()
  if (!firstName || !lastName) throw new Error('Nombre y apellido son obligatorios')
  return {
    firstName,
    lastName,
    phone: String(input.phone ?? '').trim(),
    hostingPlan: String(input.hostingPlan ?? 'Launch').trim() || 'Launch',
    domain: String(input.domain ?? '').trim(),
    server: String(input.server ?? '').trim(),
    github: String(input.github ?? '').trim(),
    status: String(input.status ?? 'active').trim() || 'active',
    notes: String(input.notes ?? '').trim(),
  }
}

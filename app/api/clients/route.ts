import { NextResponse } from 'next/server'
import { UserAuthorizationRequiredError } from '@vercel/connect'
import { getAdminSession } from '@/lib/admin-session'
import { COLUMNS, type ClientInput } from '@/lib/clients-shared'
import { SheetsError, createClient, deleteClient, listClients, updateClient } from '@/lib/google-sheets'

export const dynamic = 'force-dynamic'

function parseInput(body: Record<string, unknown>): ClientInput {
  const input = Object.fromEntries(
    COLUMNS.map((column) => [column, typeof body[column] === 'string' ? (body[column] as string).trim().slice(0, 500) : '']),
  ) as ClientInput
  if (!input.nombre || !input.apellido) throw new SheetsError('Nombre y apellido son obligatorios', 400)
  return input
}

function parseRow(body: Record<string, unknown>) {
  const row = Number(body.row)
  const expected = typeof body.expected === 'string' ? body.expected : ''
  if (!Number.isInteger(row) || row < 2) throw new SheetsError('Fila inválida', 400)
  return { row, expected }
}

async function handle(action: (userId: string, body: Record<string, unknown>) => Promise<unknown>, request?: Request, status = 200) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    const body = request ? ((await request.json()) as Record<string, unknown>) : {}
    const result = await action(session.id, body)
    return NextResponse.json(result ?? { ok: true }, { status, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof UserAuthorizationRequiredError) {
      return NextResponse.json({ error: 'Conectá tu cuenta de Google', code: 'google_authorization_required' }, { status: 428 })
    }
    if (error instanceof SheetsError) return NextResponse.json({ error: error.message }, { status: error.status === 401 ? 502 : error.status })
    return NextResponse.json({ error: 'No se pudo completar la operación' }, { status: 500 })
  }
}

export function GET() {
  return handle((userId) => listClients(userId))
}

export function POST(request: Request) {
  return handle((userId, body) => createClient(userId, parseInput(body)), request, 201)
}

export function PUT(request: Request) {
  return handle((userId, body) => {
    const { row, expected } = parseRow(body)
    return updateClient(userId, row, expected, parseInput(body))
  }, request)
}

export function DELETE(request: Request) {
  return handle((userId, body) => {
    const { row, expected } = parseRow(body)
    return deleteClient(userId, row, expected)
  }, request)
}

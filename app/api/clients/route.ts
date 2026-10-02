import { NextResponse } from 'next/server'
import { asc, eq } from 'drizzle-orm'
import { clients, db, normalizeClient } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const rows = await db.select().from(clients).orderBy(asc(clients.lastName), asc(clients.firstName))
  return NextResponse.json(rows)
}

export async function POST(request: Request) {
  try {
    const input = normalizeClient(await request.json())
    const [created] = await db.insert(clients).values(input).returning()
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo crear el cliente' }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { id?: string } & Record<string, unknown>
    if (!body.id) return NextResponse.json({ error: 'Falta el id del cliente' }, { status: 400 })
    const input = normalizeClient(body as Partial<import('@/lib/db').ClientInput>)
    const [updated] = await db.update(clients).set({ ...input, updatedAt: new Date() }).where(eq(clients.id, body.id)).returning()
    if (!updated) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo actualizar el cliente' }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json() as { id?: string }
    if (!id) return NextResponse.json({ error: 'Falta el id del cliente' }, { status: 400 })
    await db.delete(clients).where(eq(clients.id, id))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'No se pudo eliminar el cliente' }, { status: 400 })
  }
}

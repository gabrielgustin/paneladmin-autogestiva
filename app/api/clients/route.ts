import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-session'
import { supabaseAdmin, toClient, toRow, isSupabaseConfigured } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

async function guard() {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Supabase no está configurado' }, { status: 503 })
  return null
}

export async function GET() {
  const denied = await guard()
  if (denied) return denied
  const { data, error } = await supabaseAdmin.from('clients').select('id,nombre,apellido,empresa,producto,dominio,dominio_vencimiento,mail,telefono,servidor,base_datos,plan,metodo_pago,ultimo_pago,proximo_pago,orden').order('orden', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'No se pudieron cargar los clientes' }, { status: 500 })
  return NextResponse.json((data ?? []).map(toClient))
}

export async function POST(request: Request) {
  const denied = await guard()
  if (denied) return denied
  const input = await request.json()
  const { data, error } = await supabaseAdmin.from('clients').insert(toRow(input)).select('id,nombre,apellido,empresa,producto,dominio,dominio_vencimiento,mail,telefono,servidor,base_datos,plan,metodo_pago,ultimo_pago,proximo_pago,orden').single()
  if (error) return NextResponse.json({ error: 'No se pudo crear el cliente' }, { status: 500 })
  return NextResponse.json(toClient(data), { status: 201 })
}

export async function PUT(request: Request) {
  const denied = await guard()
  if (denied) return denied
  const input = await request.json()
  const { row, ...fields } = input
  const { data, error } = await supabaseAdmin.from('clients').update(toRow(fields)).eq('id', row).select('id,nombre,apellido,empresa,producto,dominio,dominio_vencimiento,mail,telefono,servidor,base_datos,plan,metodo_pago,ultimo_pago,proximo_pago,orden').single()
  if (error) return NextResponse.json({ error: 'No se pudo actualizar el cliente' }, { status: 500 })
  return NextResponse.json(toClient(data))
}

export async function PATCH(request: Request) {
  const denied = await guard()
  if (denied) return denied
  const { ids } = await request.json()
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) return NextResponse.json({ error: 'Orden inválido' }, { status: 400 })
  const results = await Promise.all(ids.map((id, index) => supabaseAdmin.from('clients').update({ orden: index + 1 }).eq('id', id)))
  if (results.some(({ error }) => error)) return NextResponse.json({ error: 'No se pudo guardar el orden' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const denied = await guard()
  if (denied) return denied
  const { row } = await request.json()
  const { error } = await supabaseAdmin.from('clients').delete().eq('id', row)
  if (error) return NextResponse.json({ error: 'No se pudo eliminar el cliente' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

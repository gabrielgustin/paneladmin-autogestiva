import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { supabaseAdmin, toClient, isSupabaseConfigured, type SupabaseClientRow } from '@/lib/supabase-admin'
import { COLUMNS, COLUMN_LABELS } from '@/lib/clients-shared'

export const dynamic = 'force-dynamic'

// Quotes a CSV field and neutralizes spreadsheet formulas (=, +, -, @) that could execute when the file is opened.
function csvField(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Supabase no está configurado' }, { status: 503 })

  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('id,nombre,apellido,empresa,producto,dominio,dominio_vencimiento,mail,telefono,servidor,base_datos,plan,metodo_pago,ultimo_pago,proximo_pago,orden')
    .order('orden', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'No se pudo generar el respaldo' }, { status: 500 })

  const rows = (data as SupabaseClientRow[]).map(toClient)
  const lines = [COLUMNS.map((column) => csvField(COLUMN_LABELS[column])).join(',')]
  for (const row of rows) lines.push(COLUMNS.map((column) => csvField(String(row[column] ?? ''))).join(','))

  const today = new Date().toISOString().slice(0, 10)
  // The BOM lets Excel open the accents correctly.
  return new NextResponse(`﻿${lines.join('\r\n')}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="clientes-${today}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}

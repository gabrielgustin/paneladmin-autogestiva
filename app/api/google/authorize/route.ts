import { NextResponse } from 'next/server'
import { startAuthorization } from '@vercel/connect'
import { getAdminSession } from '@/lib/admin-session'
import { CONNECTOR_UID, SHEETS_SCOPES } from '@/lib/google-sheets'
import { getOrigin } from '@/lib/origin'

export async function POST() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    const origin = await getOrigin()
    const { url } = await startAuthorization(
      CONNECTOR_UID,
      { subject: { type: 'user', id: session.id }, scopes: SHEETS_SCOPES },
      { callbackUrl: `${origin}/clientes` },
    )
    return NextResponse.json({ url })
  } catch {
    return NextResponse.json({ error: 'No se pudo iniciar la conexión con Google' }, { status: 500 })
  }
}

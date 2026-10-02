import { getToken } from '@vercel/connect'
import { NextResponse } from 'next/server'

const CONNECTOR = 'neon/neon-account-usage-dashboard'
const API = 'https://console.neon.tech/api/v2'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { projectId?: string; endpointId?: string; action?: 'suspend' | 'start' }
    if (!body.projectId || !body.endpointId || !['suspend', 'start'].includes(body.action ?? '')) {
      return NextResponse.json({ error: 'Proyecto, endpoint y acción son obligatorios.' }, { status: 400 })
    }

    const token = await getToken(CONNECTOR, { subject: { type: 'app' } })
    const response = await fetch(`${API}/projects/${encodeURIComponent(body.projectId)}/endpoints/${encodeURIComponent(body.endpointId)}/${body.action}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!response.ok) {
      const detail = await response.text()
      return NextResponse.json({ error: `Neon no pudo ${body.action === 'suspend' ? 'suspender' : 'reactivar'} el compute.`, detail: detail.slice(0, 240) }, { status: response.status })
    }
    return NextResponse.json({ ok: true, action: body.action, result: await response.json() })
  } catch (error) {
    console.error('[v0] Neon compute control error:', error)
    return NextResponse.json({ error: 'No se pudo ejecutar la acción sobre el compute.' }, { status: 502 })
  }
}

import { getNeonToken } from '@/lib/neon-token'
import { NextResponse } from 'next/server'
import { neon, neonErrorMessage } from '@/lib/neon-api'
import { requireAdmin } from '@/lib/require-admin'

export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied
  try {
    const body = (await request.json()) as { projectId?: string; endpointId?: string; action?: 'suspend' | 'start' }
    if (!body.projectId || !body.endpointId || !['suspend', 'start'].includes(body.action ?? '')) {
      return NextResponse.json({ error: 'Proyecto, endpoint y acción son obligatorios.' }, { status: 400 })
    }

    const token = await getNeonToken()
    const result = await neon(`/projects/${encodeURIComponent(body.projectId)}/endpoints/${encodeURIComponent(body.endpointId)}/${body.action}`, token, { method: 'POST' })
    return NextResponse.json({ ok: true, action: body.action, result })
  } catch (error) {
    console.error('[v0] Neon compute control error:', error)
    return NextResponse.json({ error: neonErrorMessage(error) }, { status: 502 })
  }
}

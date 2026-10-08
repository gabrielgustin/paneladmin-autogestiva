import { NextResponse } from 'next/server'
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from '@/lib/admin-session'
import { verifyAdminCredentials } from '@/lib/admin-auth'

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000
const attempts = new Map<string, { count: number; resetAt: number }>()

function clientKey(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
}

export async function POST(request: Request) {
  const key = clientKey(request)
  const now = Date.now()
  const entry = attempts.get(key)
  if (entry && entry.resetAt > now && entry.count >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: 'Demasiados intentos. Probá de nuevo en unos minutos.' }, { status: 429 })
  }

  let body: { email?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email : ''
  const password = typeof body.password === 'string' ? body.password : ''

  let adminId: string | null = null
  try {
    adminId = await verifyAdminCredentials(email, password)
  } catch (error) {
    console.error('[admin] login check failed:', error)
    return NextResponse.json({ error: 'No se pudo verificar el acceso. Probá de nuevo en unos minutos.' }, { status: 503 })
  }
  if (!adminId) {
    const current = entry && entry.resetAt > now ? entry : { count: 0, resetAt: now + WINDOW_MS }
    attempts.set(key, { count: current.count + 1, resetAt: current.resetAt })
    await new Promise((resolve) => setTimeout(resolve, 500))
    return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 })
  }

  attempts.delete(key)
  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE, createSessionToken(adminId), sessionCookieOptions())
  return response
}

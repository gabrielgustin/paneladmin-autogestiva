import { NextResponse } from 'next/server'
import { SESSION_COOKIE, createSessionToken, getAdminSession, sessionCookieOptions } from '@/lib/admin-session'

export async function POST() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 })
  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE, createSessionToken(session.id), sessionCookieOptions())
  return response
}

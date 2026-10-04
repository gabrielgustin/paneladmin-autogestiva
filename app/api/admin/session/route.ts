import { NextResponse } from 'next/server'
import { SESSION_COOKIE, createSessionToken, getAdminSession, sessionCookieOptions } from '@/lib/admin-session'

export async function POST() {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 })
  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions())
  return response
}

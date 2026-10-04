import { NextResponse } from 'next/server'
import {
  CLOSING_GRACE_SECONDS,
  SESSION_COOKIE,
  createSessionToken,
  getAdminSession,
  sessionCookieOptions,
} from '@/lib/admin-session'

export async function POST() {
  if (!(await getAdminSession())) return new NextResponse(null, { status: 204 })
  const response = new NextResponse(null, { status: 204 })
  response.cookies.set(SESSION_COOKIE, createSessionToken(CLOSING_GRACE_SECONDS), sessionCookieOptions(CLOSING_GRACE_SECONDS))
  return response
}

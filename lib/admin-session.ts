import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'admin_session_v2'
// The open tab renews the session every minute; if it stops (tab closed, device asleep) the session lapses on its own.
export const SESSION_SECONDS = 60 * 10
// When a tab is unloading, the session is cut to this window so a reload survives but a closed tab does not.
export const CLOSING_GRACE_SECONDS = 15

function secret() {
  const explicit = process.env.BETTER_AUTH_SECRET
  if (explicit) return explicit
  // Falls back to a key derived from the Supabase service key so no extra secret is needed.
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base) throw new Error('Falta BETTER_AUTH_SECRET o SUPABASE_SERVICE_ROLE_KEY')
  return createHash('sha256').update(`admin-session:${base}`).digest('hex')
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function safeEqual(a: string, b: string) {
  const left = createHash('sha256').update(a).digest()
  const right = createHash('sha256').update(b).digest()
  return timingSafeEqual(left, right)
}

// `userId` is the Supabase Auth user id of the admin the session belongs to.
export function createSessionToken(userId: string, seconds = SESSION_SECONDS) {
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + seconds }),
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

function verifySessionToken(token: string | undefined) {
  if (!token) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub: string; exp: number }
    if (data.exp < Math.floor(Date.now() / 1000) || typeof data.sub !== 'string' || !data.sub) return null
    return { id: data.sub }
  } catch {
    return null
  }
}

export async function getAdminSession() {
  const store = await cookies()
  return verifySessionToken(store.get(SESSION_COOKIE)?.value)
}

// The v0 preview renders the app in a cross-site iframe, which needs SameSite=None.
// Without maxAge this is a browser-session cookie: it is discarded when the browser closes,
// so the login is requested again on every new visit. Pass 0 to delete it on logout.
export function sessionCookieOptions(maxAge?: number) {
  const isDev = process.env.NODE_ENV === 'development'
  return {
    httpOnly: true,
    secure: true,
    sameSite: (isDev ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    ...(maxAge === undefined ? {} : { maxAge }),
  }
}

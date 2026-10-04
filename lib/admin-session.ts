import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'admin_session_v2'
const SESSION_SECONDS = 60 * 60 * 2

function secret() {
  const value = process.env.BETTER_AUTH_SECRET
  if (!value) throw new Error('Falta BETTER_AUTH_SECRET')
  return value
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function safeEqual(a: string, b: string) {
  const left = createHash('sha256').update(a).digest()
  const right = createHash('sha256').update(b).digest()
  return timingSafeEqual(left, right)
}

export function credentialsAreValid(email: string, password: string) {
  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminEmail || !adminPassword) return false
  const emailOk = safeEqual(email.trim().toLowerCase(), adminEmail.trim().toLowerCase())
  const passwordOk = safeEqual(password, adminPassword)
  return emailOk && passwordOk
}

// Stable subject for Vercel Connect, derived from the server-side admin identity.
export function adminSubjectId() {
  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase()
  return createHash('sha256').update(email).digest('hex').slice(0, 24)
}

export function createSessionToken() {
  const payload = Buffer.from(
    JSON.stringify({ sub: adminSubjectId(), exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS }),
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

function verifySessionToken(token: string | undefined) {
  if (!token) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub: string; exp: number }
    if (data.exp < Math.floor(Date.now() / 1000) || data.sub !== adminSubjectId()) return null
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

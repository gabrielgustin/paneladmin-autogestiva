import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-session'

// Returns a 401 response when there is no valid admin session, otherwise null.
export async function requireAdmin() {
  if (await getAdminSession()) return null
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
}

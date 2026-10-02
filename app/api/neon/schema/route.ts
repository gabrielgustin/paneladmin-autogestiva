import { getToken } from '@vercel/connect'
import { NextRequest, NextResponse } from 'next/server'

const CONNECTOR = 'neon/neon-account-usage-dashboard'
const API = 'https://console.neon.tech/api/v2'

async function neon(path: string, token: string) {
  const response = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!response.ok) throw new Error(`Neon API ${response.status}`)
  return response.json()
}

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId es requerido' }, { status: 400 })
  try {
    const token = await getToken(CONNECTOR, { subject: { type: 'app' } })
    const branches = await neon(`/projects/${encodeURIComponent(projectId)}/branches`, token)
    const branch = branches.branches?.find((item: { primary?: boolean }) => item.primary) ?? branches.branches?.[0]
    if (!branch?.id) return NextResponse.json({ projectId, branch: null, tables: [] })
    const databases = await neon(`/projects/${encodeURIComponent(projectId)}/branches/${encodeURIComponent(branch.id)}/databases`, token)
    const database = databases.databases?.[0]
    if (!database?.name) return NextResponse.json({ projectId, branch: branch.name ?? branch.id, tables: [] })
    const schema = await neon(`/projects/${encodeURIComponent(projectId)}/branches/${encodeURIComponent(branch.id)}/schema?db_name=${encodeURIComponent(database.name)}&format=json`, token)
    return NextResponse.json({ projectId, branch: branch.name ?? branch.id, database: database.name, tables: schema.tables ?? [] }, { headers: { 'Cache-Control': 'private, max-age=60' } })
  } catch (error) {
    console.error('[v0] Neon schema lookup error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo consultar el esquema de Neon' }, { status: 502 })
  }
}

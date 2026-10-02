import { getToken } from '@vercel/connect'
import { NextRequest, NextResponse } from 'next/server'

const CONNECTOR = 'neon/neon-account-usage-dashboard'
const API = 'https://console.neon.tech/api/v2'

type SchemaTable = { name: string; schema: string; columns: unknown[] }

function parseSqlTables(sql: string): SchemaTable[] {
  const tables: SchemaTable[] = []
  const pattern = /CREATE TABLE(?: IF NOT EXISTS)?\s+(?:"?([^".\s]+)"?\.)?"?([^"(\s]+)"?\s*\(([^;]+?)\);/gis
  for (const match of sql.matchAll(pattern)) {
    const columns = match[3].split(/,\s*(?![^()]*\))/).map((line) => line.trim()).filter((line) => line && !/^(CONSTRAINT|PRIMARY KEY|UNIQUE|FOREIGN KEY|CHECK)\b/i.test(line)).map((line) => { const parts = line.match(/^"?([^"\s]+)"?\s+([^\s,]+)/); return parts ? { name: parts[1], type: parts[2], nullable: !/NOT NULL/i.test(line) } : null }).filter(Boolean)
    tables.push({ name: match[2], schema: match[1] ?? 'public', columns })
  }
  return tables
}

function normalizeTables(payload: Record<string, unknown>): SchemaTable[] {
  const direct = Array.isArray(payload.tables) ? payload.tables : []
  const schemas = Array.isArray(payload.schemas) ? payload.schemas : Array.isArray(payload.database_schemas) ? payload.database_schemas : []
  const objectTables = Array.isArray(payload.objects) ? payload.objects.filter((item) => typeof item === 'object' && String((item as Record<string, unknown>).type ?? '').toLowerCase().includes('table')) : []
  const nested = schemas.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const schema = item as { name?: string; tables?: unknown[] }
    return (schema.tables ?? []).map((table) => ({ ...(table as Record<string, unknown>), schema: schema.name ?? 'public' }))
  })
  return [...direct, ...nested, ...objectTables].map((table) => {
    const value = table as Record<string, unknown>
    return {
      name: String(value.name ?? value.table_name ?? value.relname ?? 'Tabla sin nombre'),
      schema: String(value.schema ?? value.schema_name ?? 'public'),
      columns: Array.isArray(value.columns) ? value.columns : Array.isArray(value.attributes) ? value.attributes : [],
    }
  })
}

async function neon(path: string, token: string) {
  const response = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!response.ok) throw new Error(`Neon API ${response.status}`)
  const contentType = response.headers.get('content-type') ?? ''
  return contentType.includes('json') ? response.json() : response.text()
}

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId es requerido' }, { status: 400 })
  try {
    const token = await getToken(CONNECTOR, { subject: { type: 'app' } })
    const project = await neon(`/projects/${encodeURIComponent(projectId)}`, token)
    const branches = await neon(`/projects/${encodeURIComponent(projectId)}/branches`, token)
    const branch = branches.branches?.find((item: { primary?: boolean }) => item.primary) ?? branches.branches?.[0]
    if (!branch?.id) return NextResponse.json({ projectId, name: project.name ?? projectId, branch: null, tables: [] })
    const databases = await neon(`/projects/${encodeURIComponent(projectId)}/branches/${encodeURIComponent(branch.id)}/databases`, token)
    const database = databases.databases?.[0]
    if (!database?.name) return NextResponse.json({ projectId, name: project.name ?? projectId, branch: branch.name ?? branch.id, tables: [] })
    const schema = await neon(`/projects/${encodeURIComponent(projectId)}/branches/${encodeURIComponent(branch.id)}/schema?db_name=${encodeURIComponent(database.name)}`, token)
    const sqlDump = typeof schema === 'string' ? schema : typeof schema?.sql === 'string' ? schema.sql : null
    const tables = sqlDump !== null ? parseSqlTables(sqlDump) : normalizeTables(schema)
    return NextResponse.json({ projectId, name: project.name ?? projectId, branch: branch.name ?? branch.id, database: database.name, tables }, { headers: { 'Cache-Control': 'private, max-age=60' } })
  } catch (error) {
    console.error('[v0] Neon schema lookup error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo consultar el esquema de Neon' }, { status: 502 })
  }
}

import { getNeonToken } from '@/lib/neon-token'
import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@/lib/neon-api'
import { requireAdmin } from '@/lib/require-admin'
import { Client } from 'pg'

const MAX_PAGE_SIZE = 100
const MAX_CELL_LENGTH = 2000

const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`

function serializeCell(value: unknown) {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (Buffer.isBuffer(value)) return `\\x${value.toString('hex').slice(0, 64)}`
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return text.length > MAX_CELL_LENGTH ? `${text.slice(0, MAX_CELL_LENGTH)}…` : text
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied
  const params = request.nextUrl.searchParams
  const projectId = params.get('projectId')
  const schemaName = params.get('schema') || 'public'
  const tableName = params.get('table')
  const page = Math.max(1, Number(params.get('page')) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(params.get('pageSize')) || 25))
  const sortColumn = params.get('sort')
  const sortDirection = params.get('dir') === 'desc' ? 'DESC' : 'ASC'
  const search = (params.get('q') ?? '').trim().slice(0, 200)

  if (!projectId || !tableName) return NextResponse.json({ error: 'projectId y table son requeridos' }, { status: 400 })

  let client: Client | null = null
  try {
    const token = await getNeonToken()
    const id = encodeURIComponent(projectId)
    const { branches } = await neon(`/projects/${id}/branches`, token)
    const branch = branches?.find((item: { primary?: boolean }) => item.primary) ?? branches?.[0]
    if (!branch?.id) return NextResponse.json({ error: 'El proyecto no tiene branches' }, { status: 404 })
    const [{ databases }, { roles }] = await Promise.all([
      neon(`/projects/${id}/branches/${branch.id}/databases`, token),
      neon(`/projects/${id}/branches/${branch.id}/roles`, token),
    ])
    const database = databases?.[0]?.name
    const role = databases?.[0]?.owner_name ?? roles?.[0]?.name
    if (!database || !role) return NextResponse.json({ error: 'No se encontró base o rol' }, { status: 404 })
    const { uri } = await neon(
      `/projects/${id}/connection_uri?branch_id=${encodeURIComponent(branch.id)}&database_name=${encodeURIComponent(database)}&role_name=${encodeURIComponent(role)}&pooled=true`,
      token,
    )

    client = new Client({ connectionString: uri, statement_timeout: 10000, connectionTimeoutMillis: 15000 })
    await client.connect()
    await client.query('BEGIN READ ONLY')

    const columnsResult = await client.query(
      `SELECT c.column_name AS name, c.udt_name AS type, c.is_nullable = 'YES' AS nullable,
              EXISTS (
                SELECT 1 FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = c.table_schema
                  AND tc.table_name = c.table_name AND kcu.column_name = c.column_name
              ) AS primary_key
       FROM information_schema.columns c
       WHERE c.table_schema = $1 AND c.table_name = $2
       ORDER BY c.ordinal_position`,
      [schemaName, tableName],
    )
    const columns = columnsResult.rows as { name: string; type: string; nullable: boolean; primary_key: boolean }[]
    if (columns.length === 0) return NextResponse.json({ error: 'La tabla no existe' }, { status: 404 })

    const table = `${quote(schemaName)}.${quote(tableName)}`
    const values: unknown[] = []
    let where = ''
    if (search) {
      values.push(`%${search.replace(/[%_\\]/g, '\\$&')}%`)
      where = `WHERE ${columns.map((column) => `${quote(column.name)}::text ILIKE $1`).join(' OR ')}`
    }
    const sortable = columns.find((column) => column.name === sortColumn)
    const orderBy = sortable ? `ORDER BY ${quote(sortable.name)} ${sortDirection} NULLS LAST` : ''

    const countResult = await client.query(`SELECT count(*)::int AS total FROM ${table} ${where}`, values)
    const total = countResult.rows[0].total as number
    const offset = (page - 1) * pageSize
    const rowsResult = await client.query(
      `SELECT * FROM ${table} ${where} ${orderBy} LIMIT ${pageSize} OFFSET ${offset}`,
      values,
    )
    await client.query('ROLLBACK')

    const sensitive = /pass(word)?|secret|token|hash|api_?key/i
    const rows = rowsResult.rows.map((row) =>
      Object.fromEntries(
        columns.map((column) => [column.name, sensitive.test(column.name) && row[column.name] != null ? '••••••••' : serializeCell(row[column.name])]),
      ),
    )
    return NextResponse.json({ columns, rows, total, page, pageSize })
  } catch (error) {
    console.error('[v0] Neon rows lookup error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudieron leer los registros' }, { status: 502 })
  } finally {
    await client?.end().catch(() => undefined)
  }
}

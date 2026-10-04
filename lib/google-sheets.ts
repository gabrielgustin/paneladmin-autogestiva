import { getToken } from '@vercel/connect'
import { COLUMNS, fingerprint, type ClientInput, type SheetClient } from '@/lib/clients-shared'

export const CONNECTOR_UID = 'google/autogestiva-sheets-oauth-nuevo'
export const SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID ?? '1jeDuIrE3aJbbIQiLdTzTKnOU1m5JM9aYaDlkRmS66eY'
const API = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`
const LAST_COLUMN = 'G'

export class SheetsError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

async function sheetsFetch<T>(userId: string, path: string, init?: RequestInit): Promise<T> {
  const token = await getToken(CONNECTOR_UID, {
    subject: { type: 'user', id: userId },
    scopes: SHEETS_SCOPES,
  })
  const response = await fetch(`${API}${path}`, {
    ...init,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    throw new SheetsError(
      response.status === 403 || response.status === 404
        ? 'La cuenta de Google conectada no tiene acceso a la planilla'
        : 'Google Sheets devolvió un error',
      response.status,
    )
  }
  return response.json() as Promise<T>
}

async function getFirstSheet(userId: string) {
  const meta = await sheetsFetch<{ sheets: { properties: { sheetId: number; title: string } }[] }>(
    userId,
    '?fields=sheets.properties(sheetId,title)',
  )
  const first = meta.sheets?.[0]?.properties
  if (!first) throw new SheetsError('La planilla no tiene hojas', 404)
  return first
}

function quote(title: string) {
  return `'${title.replace(/'/g, "''")}'`
}

function rangePath(title: string, range: string) {
  return encodeURIComponent(`${quote(title)}!${range}`)
}

function toRow(input: ClientInput) {
  return COLUMNS.map((column) => String(input[column] ?? '').trim())
}

function fromRow(row: string[] | undefined, rowNumber: number): SheetClient {
  const values = Object.fromEntries(COLUMNS.map((column, index) => [column, String(row?.[index] ?? '')])) as ClientInput
  return { ...values, row: rowNumber }
}

export async function listClients(userId: string) {
  const { title } = await getFirstSheet(userId)
  const data = await sheetsFetch<{ values?: string[][] }>(
    userId,
    `/values/${rangePath(title, `A:${LAST_COLUMN}`)}?valueRenderOption=FORMATTED_VALUE`,
  )
  const rows = data.values ?? []
  return rows
    .slice(1)
    .map((row, index) => fromRow(row, index + 2))
    .filter((client) => COLUMNS.some((column) => client[column].trim() !== ''))
}

async function assertRowUnchanged(userId: string, title: string, row: number, expected: string) {
  if (!Number.isInteger(row) || row < 2) throw new SheetsError('Fila inválida', 400)
  const data = await sheetsFetch<{ values?: string[][] }>(
    userId,
    `/values/${rangePath(title, `A${row}:${LAST_COLUMN}${row}`)}?valueRenderOption=FORMATTED_VALUE`,
  )
  const current = fromRow(data.values?.[0], row)
  if (fingerprint(current) !== expected) {
    throw new SheetsError('La planilla cambió. Actualizá la lista y probá de nuevo.', 409)
  }
}

export async function createClient(userId: string, input: ClientInput) {
  const { title } = await getFirstSheet(userId)
  await sheetsFetch(
    userId,
    `/values/${rangePath(title, `A:${LAST_COLUMN}`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values: [toRow(input)] }) },
  )
}

export async function updateClient(userId: string, row: number, expected: string, input: ClientInput) {
  const { title } = await getFirstSheet(userId)
  await assertRowUnchanged(userId, title, row, expected)
  await sheetsFetch(
    userId,
    `/values/${rangePath(title, `A${row}:${LAST_COLUMN}${row}`)}?valueInputOption=USER_ENTERED`,
    { method: 'PUT', body: JSON.stringify({ values: [toRow(input)] }) },
  )
}

export async function deleteClient(userId: string, row: number, expected: string) {
  const { title, sheetId } = await getFirstSheet(userId)
  await assertRowUnchanged(userId, title, row, expected)
  await sheetsFetch(userId, ':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: row - 1, endIndex: row } } }],
    }),
  })
}

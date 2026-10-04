export const COLUMNS = ['nombre', 'apellido', 'mail', 'telefono', 'servidor', 'baseDatos', 'plan'] as const

export type ClientColumn = (typeof COLUMNS)[number]
export type ClientInput = Record<ClientColumn, string>
export type SheetClient = ClientInput & { row: number }

export const COLUMN_LABELS: Record<ClientColumn, string> = {
  nombre: 'Nombre',
  apellido: 'Apellido',
  mail: 'Mail',
  telefono: 'Teléfono',
  servidor: 'Servidor',
  baseDatos: 'Base de Datos',
  plan: 'Plan',
}

export function fingerprint(values: ClientInput) {
  return COLUMNS.map((column) => values[column] ?? '').join('\u0001')
}

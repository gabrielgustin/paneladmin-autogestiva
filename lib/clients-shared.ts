export const COLUMNS = ['nombre', 'apellido', 'empresa', 'producto', 'dominio', 'dominioVencimiento', 'mail', 'telefono', 'servidor', 'baseDatos', 'plan', 'metodoPago', 'ultimoPago', 'proximoPago'] as const

export type ClientColumn = (typeof COLUMNS)[number]
export type ClientInput = Record<ClientColumn, string>
export type SheetClient = ClientInput & { row: number }

export const COLUMN_LABELS: Record<ClientColumn, string> = {
  nombre: 'Nombre',
  apellido: 'Apellido',
  empresa: 'Empresa',
  producto: 'Producto',
  dominio: 'Dominio',
  dominioVencimiento: 'Vencimiento del dominio',
  mail: 'Mail',
  telefono: 'Teléfono',
  servidor: 'Servidor',
  baseDatos: 'Base de Datos',
  plan: 'Plan',
  metodoPago: 'Método de pago',
  ultimoPago: 'Último pago',
  proximoPago: 'Próximo pago',
}

export function fingerprint(values: ClientInput) {
  return COLUMNS.map((column) => values[column] ?? '').join('\u0001')
}

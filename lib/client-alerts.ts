import type { SheetClient } from '@/lib/clients-shared'

export const DOMAIN_WARNING_DAYS = 60
export const PAYMENT_WARNING_DAYS = 10

export type ClientAlert = {
  id: string
  type: 'dominio' | 'pago'
  cliente: string
  detalle: string
  date: string
  days: number
}

const DAY_MS = 86_400_000
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function utcDay(year: number, month: number, day: number) {
  return Date.UTC(year, month, day)
}

// Whole days from `today` (local calendar day) to the ISO date; negative when already past.
function daysUntil(isoDate: string, today: Date) {
  const match = DATE_RE.exec(isoDate)
  if (!match) return null
  const target = utcDay(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Math.round((target - utcDay(today.getFullYear(), today.getMonth(), today.getDate())) / DAY_MS)
}

// Domains expiring within DOMAIN_WARNING_DAYS and payments due within PAYMENT_WARNING_DAYS (overdue included), soonest first.
export function buildClientAlerts(clients: SheetClient[], today = new Date()): ClientAlert[] {
  const alerts: ClientAlert[] = []
  const seenDomains = new Set<string>()
  for (const client of clients) {
    const cliente = client.empresa && client.empresa !== '-' ? client.empresa : `${client.nombre} ${client.apellido}`.trim()
    const domainDays = client.dominio ? daysUntil(client.dominioVencimiento, today) : null
    const domainKey = client.dominio.trim().toLowerCase()
    if (domainDays !== null && domainDays <= DOMAIN_WARNING_DAYS && !seenDomains.has(domainKey)) {
      seenDomains.add(domainKey)
      alerts.push({ id: `dominio-${client.row}`, type: 'dominio', cliente, detalle: client.dominio, date: client.dominioVencimiento, days: domainDays })
    }
    const paymentDays = daysUntil(client.proximoPago, today)
    if (paymentDays !== null && paymentDays <= PAYMENT_WARNING_DAYS) {
      alerts.push({ id: `pago-${client.row}`, type: 'pago', cliente, detalle: [client.producto, client.plan].filter((value) => value && value !== '-').join(' · ') || 'Pago', date: client.proximoPago, days: paymentDays })
    }
  }
  return alerts.sort((a, b) => a.days - b.days)
}

export function describeDays(days: number) {
  if (days < 0) return `Vencido hace ${-days} ${days === -1 ? 'día' : 'días'}`
  if (days === 0) return 'Vence hoy'
  if (days === 1) return 'Vence mañana'
  return `Vence en ${days} días`
}

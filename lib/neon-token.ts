import { getToken } from '@vercel/connect'

const CONNECTOR = 'neon/neon-account-usage-dashboard'

// Pasted keys often carry whitespace, a newline or surrounding quotes; none of those belong to the key.
export function neonApiKey() {
  const raw = process.env.NEON_API_KEY ?? ''
  return raw.trim().replace(/^["']|["']$/g, '').trim()
}

// Local/dev: NEON_API_KEY. Production on Vercel: Vercel Connect.
export async function getNeonToken() {
  const key = neonApiKey()
  if (key) return key
  return getToken(CONNECTOR, { subject: { type: 'app' } })
}

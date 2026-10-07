import { getToken } from '@vercel/connect'

const CONNECTOR = 'neon/neon-account-usage-dashboard'

// Local/dev: NEON_API_KEY. Production on Vercel: Vercel Connect.
export async function getNeonToken() {
  if (process.env.NEON_API_KEY) return process.env.NEON_API_KEY
  return getToken(CONNECTOR, { subject: { type: 'app' } })
}

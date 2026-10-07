const API = 'https://console.neon.tech/api/v2'
const TIMEOUT_MS = 15_000
const MAX_ATTEMPTS = 3

export class NeonApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// GET against the Neon API with a timeout and retries on rate limits (429), 5xx and network errors.
export async function neon<T = any>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(`${API}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...init.headers },
        cache: 'no-store',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (response.ok) {
        const contentType = response.headers.get('content-type') ?? ''
        return (contentType.includes('json') ? await response.json() : await response.text()) as T
      }
      const detail = (await response.text()).slice(0, 240)
      const error = new NeonApiError(response.status, `Neon API ${response.status}: ${detail}`)
      if (response.status !== 429 && response.status < 500) throw error
      lastError = error
      const retryAfter = Number(response.headers.get('retry-after'))
      if (attempt < MAX_ATTEMPTS) await wait(retryAfter > 0 ? Math.min(retryAfter, 5) * 1000 : 400 * attempt)
    } catch (error) {
      if (error instanceof NeonApiError && error.status !== 429 && error.status < 500) throw error
      lastError = error
      if (attempt < MAX_ATTEMPTS) await wait(400 * attempt)
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Neon API no respondió')
}

// Runs `task` over `items` with at most `limit` in flight, to stay under Neon's rate limits.
export async function mapLimit<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await task(items[next++])
    }),
  )
}

export function neonErrorMessage(error: unknown) {
  if (error instanceof NeonApiError) {
    if (error.status === 401 || error.status === 403) return 'Neon rechazó la API key (no es válida o no tiene permisos).'
    if (error.status === 429) return 'Neon limitó las consultas por demasiadas solicitudes. Reintentá en un momento.'
    return `Neon respondió con un error (${error.status}).`
  }
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return 'Neon tardó demasiado en responder.'
  if (error instanceof Error && /Vercel Connect|connector|token/i.test(error.message)) return 'No se pudo obtener el acceso a Neon (revisá NEON_API_KEY o la conexión de Vercel).'
  return 'No se pudo conectar con Neon.'
}

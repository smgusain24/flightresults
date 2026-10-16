const TIMEOUT_MS = 10_000

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function baseUrl() {
  const base = import.meta.env.VITE_API_BASE_URL
  if (!base) {
    throw new ApiError('VITE_API_BASE_URL is not set. Copy frontend/.env.example to frontend/.env.', 0)
  }
  return base.replace(/\/+$/, '')
}

function errorMessage(payload, status) {
  const detail = payload?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((entry) => entry.msg).join('; ')
  return `Request failed with status ${status}`
}

async function request(path, { method = 'GET', body } = {}) {
  const url = `${baseUrl()}${path}`
  const hasBody = body !== undefined

  let response
  try {
    response = await fetch(url, {
      method,
      // Only send Content-Type with a body, so plain GETs skip the CORS preflight.
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    if (error.name === 'TimeoutError') throw new ApiError('Request timed out', 0)
    throw new ApiError(`Cannot reach API at ${url}`, 0)
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new ApiError(errorMessage(payload, response.status), response.status)
  }
  if (response.status === 204) return null

  return response.json().catch(() => {
    throw new ApiError('API returned malformed JSON', response.status)
  })
}

async function searchFlights(data) {
  const flights = await request('/api/flight-listings', { method: 'POST', body: { data } })
  if (!Array.isArray(flights)) throw new ApiError('API returned an unexpected response', 200)
  return flights
}

export const api = {
  health: () => request('/api/health'),
  searchFlights,
}

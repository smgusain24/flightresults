import { vi } from 'vitest'

export function jsonResponse(status, body) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// handlers: { 'GET /api/items': (options) => Response | Promise<Response> }
export function mockFetch(handlers) {
  const fetchMock = vi.fn(async (url, options = {}) => {
    const key = `${options.method ?? 'GET'} ${new URL(url).pathname}`
    const handler = handlers[key]
    if (!handler) throw new Error(`Unhandled request: ${key}`)
    return handler(options)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from './api.js'
import { jsonResponse, mockFetch } from './test/mockFetch.js'

const SEARCH = 'POST /api/flight-listings'

const SEARCH_DATA = {
  first_name: 'Asha',
  last_name: 'Rao',
  email_id: 'asha@example.com',
  phone_no: '9876543210',
  travel_date: '2026-11-01',
  travel_from: 'Chennai',
  travel_to: 'Hyderabad',
  filters: [],
}

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test')
})

describe('api', () => {
  it('prefixes requests with VITE_API_BASE_URL', async () => {
    const fetchMock = mockFetch({ 'GET /api/health': () => jsonResponse(200, { status: 'ok' }) })

    await api.health()

    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/health')
  })

  it('strips trailing slashes from the base URL', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.test///')
    const fetchMock = mockFetch({ [SEARCH]: () => jsonResponse(200, []) })

    await api.searchFlights(SEARCH_DATA)

    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/flight-listings')
  })

  it('sends JSON with a Content-Type header only when there is a body', async () => {
    const fetchMock = mockFetch({
      'GET /api/health': () => jsonResponse(200, {}),
      [SEARCH]: () => jsonResponse(200, []),
    })

    await api.health()
    await api.searchFlights(SEARCH_DATA)

    const [, getOptions] = fetchMock.mock.calls[0]
    const [, postOptions] = fetchMock.mock.calls[1]
    expect(getOptions.headers).toBeUndefined()
    expect(postOptions.headers).toEqual({ 'Content-Type': 'application/json' })
  })

  it('returns null for 204 responses', async () => {
    mockFetch({ 'GET /api/health': () => new Response(null, { status: 204 }) })

    await expect(api.health()).resolves.toBeNull()
  })

  it('throws when VITE_API_BASE_URL is missing', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    const fetchMock = mockFetch({})

    await expect(api.health()).rejects.toThrow(/VITE_API_BASE_URL is not set/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('surfaces a string detail from the API', async () => {
    mockFetch({ 'GET /api/health': () => jsonResponse(503, { detail: 'Database unavailable' }) })

    await expect(api.health()).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Database unavailable',
      status: 503,
    })
  })

  it('joins validation error messages from a 422', async () => {
    mockFetch({
      [SEARCH]: () =>
        jsonResponse(422, {
          detail: [{ msg: 'Input should be a valid date' }, { msg: 'Field required' }],
        }),
    })

    await expect(api.searchFlights(SEARCH_DATA)).rejects.toMatchObject({
      message: 'Input should be a valid date; Field required',
      status: 422,
    })
  })

  it('falls back to the status code when the error body is not JSON', async () => {
    mockFetch({ [SEARCH]: () => new Response('<html>Bad Gateway</html>', { status: 502 }) })

    await expect(api.searchFlights(SEARCH_DATA)).rejects.toThrow('Request failed with status 502')
  })

  it('reports an unreachable API', async () => {
    mockFetch({
      'GET /api/health': () => {
        throw new TypeError('Failed to fetch')
      },
    })

    await expect(api.health()).rejects.toThrow('Cannot reach API at http://api.test/api/health')
  })

  it('reports a timeout', async () => {
    mockFetch({
      [SEARCH]: () => {
        throw new DOMException('The operation timed out.', 'TimeoutError')
      },
    })

    await expect(api.searchFlights(SEARCH_DATA)).rejects.toThrow('Request timed out')
  })

  it('passes an abort signal so requests cannot hang forever', async () => {
    const fetchMock = mockFetch({ 'GET /api/health': () => jsonResponse(200, {}) })

    await api.health()

    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })

  it('rejects a 200 with a malformed JSON body', async () => {
    mockFetch({ [SEARCH]: () => new Response('{not json', { status: 200 }) })

    const error = await api.searchFlights(SEARCH_DATA).catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.message).toBe('API returned malformed JSON')
  })
})

describe('api.searchFlights', () => {
  it('posts the search inside a data envelope and returns the flights', async () => {
    const flights = [{ start_time: '07:30', journey_time: '45m', price: 5000, stars: 4, set: 1 }]
    const fetchMock = mockFetch({ [SEARCH]: () => jsonResponse(200, flights) })

    await expect(api.searchFlights(SEARCH_DATA)).resolves.toEqual(flights)

    const [, options] = fetchMock.mock.calls[0]
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ data: SEARCH_DATA })
  })

  it('returns an empty list as is', async () => {
    mockFetch({ [SEARCH]: () => jsonResponse(200, []) })

    await expect(api.searchFlights(SEARCH_DATA)).resolves.toEqual([])
  })

  it.each([
    ['an object', { flights: [] }],
    ['null', null],
    ['a string', 'no flights'],
  ])('rejects a 200 whose body is %s instead of a list', async (_, body) => {
    mockFetch({ [SEARCH]: () => jsonResponse(200, body) })

    await expect(api.searchFlights(SEARCH_DATA)).rejects.toMatchObject({
      name: 'ApiError',
      message: 'API returned an unexpected response',
    })
  })

  it('rejects a 204 with no body', async () => {
    mockFetch({ [SEARCH]: () => new Response(null, { status: 204 }) })

    await expect(api.searchFlights(SEARCH_DATA)).rejects.toThrow('API returned an unexpected response')
  })

  it('surfaces a database outage', async () => {
    mockFetch({ [SEARCH]: () => jsonResponse(503, { detail: 'Database unavailable' }) })

    await expect(api.searchFlights(SEARCH_DATA)).rejects.toMatchObject({
      message: 'Database unavailable',
      status: 503,
    })
  })
})

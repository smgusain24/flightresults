import { describe, expect, it } from 'vitest'
import { buildSearchData, formatPrice, formatTravelDate, sortFlights } from './flights.js'

// API order is departure order.
const FLIGHTS = [
  { key: 0, start_time: '06:00', price: 5000 },
  { key: 1, start_time: '09:00', price: 3000 },
  { key: 2, start_time: '12:00', price: 7000 },
  { key: 3, start_time: '18:00', price: 3000 },
]

const keys = (flights) => flights.map((flight) => flight.key)

describe('sortFlights', () => {
  it('keeps API order for departure sort', () => {
    expect(keys(sortFlights(FLIGHTS, 'departure'))).toEqual([0, 1, 2, 3])
  })

  it('sorts by price low to high, keeping departure order for equal prices', () => {
    expect(keys(sortFlights(FLIGHTS, 'price-asc'))).toEqual([1, 3, 0, 2])
  })

  it('sorts by price high to low, keeping departure order for equal prices', () => {
    expect(keys(sortFlights(FLIGHTS, 'price-desc'))).toEqual([2, 0, 1, 3])
  })

  it('does not mutate the input', () => {
    const copy = structuredClone(FLIGHTS)

    sortFlights(FLIGHTS, 'price-desc')

    expect(FLIGHTS).toEqual(copy)
  })

  it('falls back to API order for an unknown sort', () => {
    expect(keys(sortFlights(FLIGHTS, 'rating'))).toEqual([0, 1, 2, 3])
  })

  it('handles an empty list', () => {
    expect(sortFlights([], 'price-asc')).toEqual([])
  })
})

describe('formatPrice', () => {
  it.each([
    [5000, '₹5,000'],
    [123456, '₹1,23,456'],
    [0, '₹0'],
  ])('formats %s as %s', (price, formatted) => {
    expect(formatPrice(price)).toBe(formatted)
  })
})

describe('formatTravelDate', () => {
  it('formats an ISO date as a readable local date', () => {
    // ICU versions disagree on the comma before the year.
    expect(formatTravelDate('2026-11-01')).toMatch(/^Sun, 1 Nov,? 2026$/)
  })

  it.each(['', 'tomorrow', null])('returns %j unchanged when it is not a date', (raw) => {
    expect(formatTravelDate(raw)).toBe(raw)
  })
})

describe('buildSearchData', () => {
  const traveller = {
    firstName: '  Asha ',
    lastName: 'Rao ',
    email: ' asha@example.com',
    phone: ' 9876543210 ',
  }
  const trip = { source: 'Chennai', destination: 'Hyderabad', travelDate: '2026-11-01' }

  it('maps wizard state to the API field names, trimmed, with no filters', () => {
    expect(buildSearchData(traveller, trip, 0)).toEqual({
      first_name: 'Asha',
      last_name: 'Rao',
      email_id: 'asha@example.com',
      phone_no: '9876543210',
      travel_date: '2026-11-01',
      travel_from: 'Chennai',
      travel_to: 'Hyderabad',
      filters: [],
    })
  })

  it('adds a stars filter for a minimum rating', () => {
    expect(buildSearchData(traveller, trip, 4).filters).toEqual([
      { field: 'stars', op: 'gte', value: 4 },
    ])
  })
})

import { describe, expect, it } from 'vitest'
import { CITIES, isValid, localToday, validateTraveller, validateTrip } from './validation.js'

const TODAY = '2026-10-16'

const traveller = (overrides = {}) => ({
  firstName: 'Asha',
  lastName: 'Rao',
  email: 'asha@example.com',
  phone: '9876543210',
  ...overrides,
})

const trip = (overrides = {}) => ({
  source: 'Chennai',
  destination: 'Hyderabad',
  travelDate: '2026-11-01',
  ...overrides,
})

describe('validateTraveller', () => {
  it('accepts a complete traveller', () => {
    expect(validateTraveller(traveller())).toEqual({})
  })

  it.each([
    ['firstName', 'Enter your first name'],
    ['lastName', 'Enter your last name'],
    ['email', 'Enter your email address'],
    ['phone', 'Enter your phone number'],
  ])('requires %s', (field, message) => {
    expect(validateTraveller(traveller({ [field]: '' }))[field]).toBe(message)
    expect(validateTraveller(traveller({ [field]: '   ' }))[field]).toBe(message)
  })

  it.each([null, undefined, 42, {}, ['Asha']])('treats a non-string name (%j) as missing', (value) => {
    expect(validateTraveller(traveller({ firstName: value })).firstName).toBe('Enter your first name')
  })

  it('accepts names up to 100 characters after trimming', () => {
    expect(validateTraveller(traveller({ firstName: ` ${'a'.repeat(100)} ` }))).toEqual({})
  })

  it('rejects names over 100 characters', () => {
    expect(validateTraveller(traveller({ lastName: 'a'.repeat(101) })).lastName).toBe(
      'Last name must be 100 characters or fewer',
    )
  })

  it.each(['a@b.co', 'first.last+tag@mail.example.co.in', '  asha@example.com  '])(
    'accepts the email %j',
    (email) => {
      expect(validateTraveller(traveller({ email }))).toEqual({})
    },
  )

  it.each(['plainaddress', '@example.com', 'asha@', 'asha@example', 'as ha@example.com', 'asha@exa mple.com', 'asha@@example.com', 'asha@example.'])(
    'rejects the email %j',
    (email) => {
      expect(validateTraveller(traveller({ email })).email).toBe(
        'Enter an email address like name@example.com',
      )
    },
  )

  it('rejects emails over 100 characters', () => {
    const email = `${'a'.repeat(89)}@example.com`
    expect(email).toHaveLength(101)

    expect(validateTraveller(traveller({ email })).email).toBe(
      'Email address must be 100 characters or fewer',
    )
  })

  it.each(['9876543210', '0000000000', ' 9876543210 '])('accepts the phone number %j', (phone) => {
    expect(validateTraveller(traveller({ phone }))).toEqual({})
  })

  it.each(['987654321', '98765432101', '98765abcde', '98765-43210', '98765 43210', '+919876543210', '９８７６５４３２１０'])(
    'rejects the phone number %j',
    (phone) => {
      expect(validateTraveller(traveller({ phone })).phone).toBe(
        'Phone number must be exactly 10 digits',
      )
    },
  )

  it.each([null, undefined])('reports every field when the traveller is %s', (value) => {
    expect(Object.keys(validateTraveller(value)).sort()).toEqual([
      'email',
      'firstName',
      'lastName',
      'phone',
    ])
  })
})

describe('validateTrip', () => {
  it('accepts a complete trip', () => {
    expect(validateTrip(trip(), TODAY)).toEqual({})
  })

  it('offers exactly the three supported cities', () => {
    expect(CITIES).toEqual(['Chennai', 'Hyderabad', 'Bengaluru'])
  })

  it.each(CITIES.flatMap((from) => CITIES.filter((to) => to !== from).map((to) => [from, to])))(
    'accepts %s to %s',
    (source, destination) => {
      expect(validateTrip(trip({ source, destination }), TODAY)).toEqual({})
    },
  )

  it('requires a source and a destination', () => {
    expect(validateTrip(trip({ source: '', destination: '' }), TODAY)).toEqual({
      source: "Choose where you're flying from",
      destination: "Choose where you're flying to",
    })
  })

  it.each(['Delhi', 'chennai', ' Chennai', 'DEL', 42, null])(
    'rejects a city outside the list (%j)',
    (source) => {
      expect(validateTrip(trip({ source }), TODAY).source).toBe("Choose where you're flying from")
    },
  )

  it('rejects the same city as source and destination', () => {
    expect(validateTrip(trip({ destination: 'Chennai' }), TODAY)).toEqual({
      destination: 'Choose a destination different from Chennai',
    })
  })

  it('requires a travel date', () => {
    expect(validateTrip(trip({ travelDate: '' }), TODAY).travelDate).toBe('Choose a travel date')
  })

  it.each(['01-11-2026', '2026-13-01', '2026-02-30', '2026-11-1', 'tomorrow', '20261101', 20261101])(
    'rejects the malformed date %j',
    (travelDate) => {
      expect(validateTrip(trip({ travelDate }), TODAY).travelDate).toBe('Enter a valid date')
    },
  )

  it('accepts today and rejects yesterday', () => {
    expect(validateTrip(trip({ travelDate: TODAY }), TODAY)).toEqual({})
    expect(validateTrip(trip({ travelDate: '2026-10-15' }), TODAY).travelDate).toBe(
      "Travel date can't be in the past",
    )
  })

  it('accepts 29 February in a leap year only', () => {
    expect(validateTrip(trip({ travelDate: '2028-02-29' }), TODAY)).toEqual({})
    expect(validateTrip(trip({ travelDate: '2027-02-29' }), TODAY).travelDate).toBe(
      'Enter a valid date',
    )
  })

  it.each([null, undefined])('reports every field when the trip is %s', (value) => {
    expect(Object.keys(validateTrip(value, TODAY)).sort()).toEqual([
      'destination',
      'source',
      'travelDate',
    ])
  })
})

describe('localToday', () => {
  it('formats the local calendar date as YYYY-MM-DD', () => {
    expect(localToday(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(localToday(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31')
  })
})

describe('isValid', () => {
  it('is true only for an empty error map', () => {
    expect(isValid({})).toBe(true)
    expect(isValid({ email: 'Enter your email address' })).toBe(false)
  })
})

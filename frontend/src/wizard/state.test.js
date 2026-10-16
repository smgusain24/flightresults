import { describe, expect, it } from 'vitest'
import { canEnter, initialState, wizardReducer } from './state.js'

const TODAY = '2026-10-16'

const filled = {
  step: 'results',
  traveller: { firstName: 'Asha', lastName: 'Rao', email: 'asha@example.com', phone: '9876543210' },
  trip: { source: 'Chennai', destination: 'Hyderabad', travelDate: '2026-11-01' },
  view: { sort: 'price-asc', minStars: 4 },
}

describe('wizardReducer', () => {
  it('starts on the traveller step with empty fields', () => {
    expect(initialState).toEqual({
      step: 'traveller',
      traveller: { firstName: '', lastName: '', email: '', phone: '' },
      trip: { source: '', destination: '', travelDate: '' },
      view: { sort: 'departure', minStars: 0 },
    })
  })

  it('updates one traveller field and keeps every other slice', () => {
    const next = wizardReducer(filled, { type: 'traveller/update', fields: { lastName: 'Iyer' } })

    expect(next).toEqual({ ...filled, traveller: { ...filled.traveller, lastName: 'Iyer' } })
    expect(next.trip).toBe(filled.trip)
    expect(next.view).toBe(filled.view)
  })

  it('updates one trip field and keeps every other slice', () => {
    const next = wizardReducer(filled, { type: 'trip/update', fields: { travelDate: '2026-12-01' } })

    expect(next).toEqual({ ...filled, trip: { ...filled.trip, travelDate: '2026-12-01' } })
    expect(next.traveller).toBe(filled.traveller)
  })

  it('ignores fields that do not belong to the slice', () => {
    const next = wizardReducer(filled, {
      type: 'traveller/update',
      fields: { phone: '1234567890', source: 'Delhi', step: 'results' },
    })

    expect(next.traveller).toEqual({ ...filled.traveller, phone: '1234567890' })
    expect(next.traveller).not.toHaveProperty('source')
    expect(next.trip).toBe(filled.trip)
  })

  it.each([undefined, null, 'lastName'])('ignores an update with fields %j', (fields) => {
    expect(wizardReducer(filled, { type: 'trip/update', fields })).toEqual(filled)
  })

  it.each(['departure', 'price-asc', 'price-desc'])('sets the sort order to %s', (sort) => {
    expect(wizardReducer(filled, { type: 'view/sort', sort }).view).toEqual({ ...filled.view, sort })
  })

  it.each(['price', 'rating', '', null])('ignores the unknown sort %j', (sort) => {
    expect(wizardReducer(filled, { type: 'view/sort', sort })).toBe(filled)
  })

  it.each([0, 1, 5])('sets the minimum rating to %s', (minStars) => {
    expect(wizardReducer(filled, { type: 'view/minStars', minStars }).view.minStars).toBe(minStars)
  })

  it.each([-1, 6, 2.5, '3', NaN, null])('ignores the out-of-range rating %j', (minStars) => {
    expect(wizardReducer(filled, { type: 'view/minStars', minStars })).toBe(filled)
  })

  it('moves to a known step and keeps all data', () => {
    expect(wizardReducer(filled, { type: 'step/go', step: 'traveller' })).toEqual({
      ...filled,
      step: 'traveller',
    })
  })

  it.each(['payment', '', undefined])('ignores the unknown step %j', (step) => {
    expect(wizardReducer(filled, { type: 'step/go', step })).toBe(filled)
  })

  it('throws on an unknown action so typos surface in development', () => {
    expect(() => wizardReducer(filled, { type: 'traveler/update' })).toThrow(
      'Unknown wizard action: traveler/update',
    )
  })
})

describe('canEnter', () => {
  it('always allows the traveller step', () => {
    expect(canEnter(initialState, 'traveller', TODAY)).toBe(true)
  })

  it('allows the trip step only with valid traveller details', () => {
    expect(canEnter(initialState, 'trip', TODAY)).toBe(false)
    expect(canEnter({ ...filled, trip: initialState.trip }, 'trip', TODAY)).toBe(true)
    const badPhone = { ...filled, traveller: { ...filled.traveller, phone: '12345' } }
    expect(canEnter(badPhone, 'trip', TODAY)).toBe(false)
  })

  it('allows the results step only when traveller and trip are both valid', () => {
    expect(canEnter(filled, 'results', TODAY)).toBe(true)
    expect(canEnter({ ...filled, trip: initialState.trip }, 'results', TODAY)).toBe(false)
    expect(canEnter({ ...filled, traveller: initialState.traveller }, 'results', TODAY)).toBe(false)
  })

  it('re-checks the date against today', () => {
    expect(canEnter(filled, 'results', '2026-11-02')).toBe(false)
  })

  it('rejects an unknown step', () => {
    expect(canEnter(filled, 'payment', TODAY)).toBe(false)
  })
})

import { isValid, validateTraveller, validateTrip } from './validation.js'

export const STEPS = ['traveller', 'trip', 'results']
export const SORTS = ['departure', 'price-asc', 'price-desc']
export const MAX_STARS = 5

export const initialState = {
  step: 'traveller',
  traveller: { firstName: '', lastName: '', email: '', phone: '' },
  trip: { source: '', destination: '', travelDate: '' },
  view: { sort: 'departure', minStars: 0 },
}

// Merge only the keys the slice already has, so one step can never write into another.
function mergeSlice(slice, fields) {
  if (fields === null || typeof fields !== 'object') return slice
  const updates = Object.entries(fields).filter(([key]) => Object.hasOwn(slice, key))
  return { ...slice, ...Object.fromEntries(updates) }
}

export function wizardReducer(state, action) {
  switch (action.type) {
    case 'traveller/update':
      return { ...state, traveller: mergeSlice(state.traveller, action.fields) }
    case 'trip/update':
      return { ...state, trip: mergeSlice(state.trip, action.fields) }
    case 'view/sort':
      return SORTS.includes(action.sort) ? { ...state, view: { ...state.view, sort: action.sort } } : state
    case 'view/minStars': {
      const { minStars } = action
      const inRange = Number.isInteger(minStars) && minStars >= 0 && minStars <= MAX_STARS
      return inRange ? { ...state, view: { ...state.view, minStars } } : state
    }
    case 'step/go':
      return STEPS.includes(action.step) ? { ...state, step: action.step } : state
    default:
      throw new Error(`Unknown wizard action: ${action.type}`)
  }
}

// A step is reachable once every step before it validates.
export function canEnter(state, step, today) {
  switch (step) {
    case 'traveller':
      return true
    case 'trip':
      return isValid(validateTraveller(state.traveller))
    case 'results':
      return isValid(validateTraveller(state.traveller)) && isValid(validateTrip(state.trip, today))
    default:
      return false
  }
}

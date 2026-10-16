// Each validator returns a map of field -> message; an empty map means valid.
// Length limits mirror the CHECK constraints on the users table.

export const CITIES = ['Chennai', 'Hyderabad', 'Bengaluru']

const NAME_MAX = 100
const EMAIL_MAX = 100
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^[0-9]{10}$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function nameError(value, label) {
  const name = text(value)
  if (!name) return `Enter your ${label.toLowerCase()}`
  if (name.length > NAME_MAX) return `${label} must be ${NAME_MAX} characters or fewer`
  return null
}

function emailError(value) {
  const email = text(value)
  if (!email) return 'Enter your email address'
  if (email.length > EMAIL_MAX) return `Email address must be ${EMAIL_MAX} characters or fewer`
  if (!EMAIL_PATTERN.test(email)) return 'Enter an email address like name@example.com'
  return null
}

function phoneError(value) {
  const phone = text(value)
  if (!phone) return 'Enter your phone number'
  if (!PHONE_PATTERN.test(phone)) return 'Phone number must be exactly 10 digits'
  return null
}

function isCalendarDate(value) {
  if (!DATE_PATTERN.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function travelDateError(value, today) {
  if (value === '' || value == null) return 'Choose a travel date'
  if (typeof value !== 'string' || !isCalendarDate(value)) return 'Enter a valid date'
  // ISO dates compare correctly as strings.
  if (value < today) return "Travel date can't be in the past"
  return null
}

function collect(entries) {
  return Object.fromEntries(entries.filter(([, message]) => message))
}

export function validateTraveller(traveller) {
  const { firstName, lastName, email, phone } = traveller ?? {}
  return collect([
    ['firstName', nameError(firstName, 'First name')],
    ['lastName', nameError(lastName, 'Last name')],
    ['email', emailError(email)],
    ['phone', phoneError(phone)],
  ])
}

export function validateTrip(trip, today) {
  const { source, destination, travelDate } = trip ?? {}
  const knownSource = CITIES.includes(source)
  const knownDestination = CITIES.includes(destination)
  return collect([
    ['source', knownSource ? null : "Choose where you're flying from"],
    [
      'destination',
      !knownDestination
        ? "Choose where you're flying to"
        : destination === source
          ? `Choose a destination different from ${source}`
          : null,
    ],
    ['travelDate', travelDateError(travelDate, today)],
  ])
}

export function isValid(errors) {
  return Object.keys(errors).length === 0
}

export function localToday(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

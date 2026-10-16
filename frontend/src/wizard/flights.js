const priceFormat = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const dateFormat = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

// Array.prototype.sort is stable, so flights at the same price stay in departure order.
export function sortFlights(flights, sort) {
  if (sort === 'price-asc') return [...flights].sort((a, b) => a.price - b.price)
  if (sort === 'price-desc') return [...flights].sort((a, b) => b.price - a.price)
  return flights
}

export function formatPrice(price) {
  return priceFormat.format(price)
}

export function formatTravelDate(value) {
  const match = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return value
  const [, year, month, day] = match.map(Number)
  return dateFormat.format(new Date(year, month - 1, day))
}

export function buildSearchData(traveller, trip, minStars) {
  return {
    first_name: traveller.firstName.trim(),
    last_name: traveller.lastName.trim(),
    email_id: traveller.email.trim(),
    phone_no: traveller.phone.trim(),
    travel_date: trip.travelDate,
    travel_from: trip.source,
    travel_to: trip.destination,
    filters: minStars > 0 ? [{ field: 'stars', op: 'gte', value: minStars }] : [],
  }
}

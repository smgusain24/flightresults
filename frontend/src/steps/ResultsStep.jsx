import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { useWizard } from '../wizard/context.js'
import { buildSearchData, formatPrice, formatTravelDate, sortFlights } from '../wizard/flights.js'
import { MAX_STARS } from '../wizard/state.js'
import Field from './Field.jsx'
import StepHeading from './StepHeading.jsx'

const SORT_OPTIONS = [
  ['departure', 'Departure time'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
]

const RATING_OPTIONS = [
  [0, 'Any rating'],
  [1, '1 star and up'],
  [2, '2 stars and up'],
  [3, '3 stars and up'],
  [4, '4 stars and up'],
  [5, '5 stars'],
]

function Stars({ value }) {
  const filled = Math.max(0, Math.min(MAX_STARS, Math.round(value)))
  return (
    <span className="stars" role="img" aria-label={`${value} out of ${MAX_STARS} stars`}>
      <span className="stars-filled">{'★'.repeat(filled)}</span>
      <span className="stars-empty">{'★'.repeat(MAX_STARS - filled)}</span>
    </span>
  )
}

function PlaneIcon() {
  return (
    <svg className="route-plane" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
    </svg>
  )
}

function FlightPass({ flight, source, destination }) {
  return (
    <li className="pass">
      <div className="pass-body">
        <div className="pass-top">
          <span className="pass-time">{flight.start_time}</span>
          <span className="pass-duration">{flight.journey_time}</span>
        </div>
        <div className="pass-route">
          <span>{source}</span>
          <span className="route-line">
            <span className="visually-hidden">to</span>
            <PlaneIcon />
          </span>
          <span>{destination}</span>
        </div>
        <div className="pass-meta">
          <Stars value={flight.stars} />
          <span>Set {flight.set}</span>
        </div>
      </div>
      <div className="pass-stub">
        <span className="pass-price">{formatPrice(flight.price)}</span>
      </div>
    </li>
  )
}

export default function ResultsStep() {
  const { state, setSort, setMinStars, goTo } = useWizard()
  const { traveller, trip, view } = state
  const data = useMemo(
    () => buildSearchData(traveller, trip, view.minStars),
    [traveller, trip, view.minStars],
  )
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null)

  useEffect(() => {
    let ignore = false
    api.searchFlights(data).then(
      (flights) => {
        // The response has no id, so the API's order becomes the stable key.
        if (!ignore) setResult({ data, attempt, flights: flights.map((flight, key) => ({ ...flight, key })) })
      },
      (error) => {
        if (!ignore) setResult({ data, attempt, error: error.message })
      },
    )
    return () => {
      ignore = true
    }
  }, [data, attempt])

  // A result belongs to the current search only if it answers this exact request.
  const current = result?.data === data && result?.attempt === attempt ? result : null

  return (
    <section className="step" aria-labelledby="results-heading">
      <StepHeading id="results-heading">
        {trip.source} to {trip.destination}
      </StepHeading>
      <p className="trip-summary">
        {formatTravelDate(trip.travelDate)}, for {traveller.firstName.trim()} {traveller.lastName.trim()}
      </p>

      <div className="field-row controls">
        <Field
          as="select"
          label="Sort by"
          name="sort"
          value={view.sort}
          onChange={(event) => setSort(event.target.value)}
        >
          {SORT_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Field>
        <Field
          as="select"
          label="Rating"
          name="minStars"
          value={view.minStars}
          onChange={(event) => setMinStars(Number(event.target.value))}
        >
          {RATING_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Field>
      </div>

      {!current ? (
        <p role="status" className="notice">
          Searching flights…
        </p>
      ) : current.error ? (
        <div role="alert" className="notice notice-error">
          <p>Couldn&rsquo;t load flights. {current.error}</p>
          <button type="button" className="button-secondary" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </div>
      ) : current.flights.length === 0 ? (
        <div className="notice">
          {view.minStars > 0 ? (
            <>
              <p>No flights rated {view.minStars} stars or higher on this date.</p>
              <button type="button" className="button-secondary" onClick={() => setMinStars(0)}>
                Show all ratings
              </button>
            </>
          ) : (
            <>
              <p>
                No flights from {trip.source} to {trip.destination} on{' '}
                {formatTravelDate(trip.travelDate)}.
              </p>
              <button type="button" className="button-secondary" onClick={() => goTo('trip')}>
                Change trip
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <p role="status" className="result-count">
            {current.flights.length === 1 ? '1 flight' : `${current.flights.length} flights`}
          </p>
          <ol className="passes" aria-label="Flights">
            {sortFlights(current.flights, view.sort).map((flight) => (
              <FlightPass
                key={flight.key}
                flight={flight}
                source={trip.source}
                destination={trip.destination}
              />
            ))}
          </ol>
        </>
      )}

      <div className="actions">
        <button type="button" className="button-secondary" onClick={() => goTo('trip')}>
          Back
        </button>
      </div>
    </section>
  )
}

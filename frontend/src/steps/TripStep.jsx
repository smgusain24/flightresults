import { useState } from 'react'
import { useWizard } from '../wizard/context.js'
import { CITIES, localToday, validateTrip } from '../wizard/validation.js'
import Field from './Field.jsx'
import StepHeading from './StepHeading.jsx'

const FIELDS = ['source', 'destination', 'travelDate']

function CityOptions() {
  return (
    <>
      <option value="">Choose a city</option>
      {CITIES.map((city) => (
        <option key={city} value={city}>
          {city}
        </option>
      ))}
    </>
  )
}

export default function TripStep() {
  const { state, updateTrip, goTo } = useWizard()
  const { trip } = state
  const today = localToday()
  const errors = validateTrip(trip, today)
  const [touched, setTouched] = useState({})
  const [attempted, setAttempted] = useState(false)

  const fieldProps = (field) => ({
    name: field,
    value: trip[field],
    error: attempted || touched[field] ? errors[field] : undefined,
    onChange: (event) => updateTrip({ [field]: event.target.value }),
    onBlur: () => setTouched((current) => ({ ...current, [field]: true })),
  })

  function handleSubmit(event) {
    event.preventDefault()
    setAttempted(true)
    const firstInvalid = FIELDS.find((field) => errors[field])
    if (firstInvalid) event.currentTarget.elements.namedItem(firstInvalid).focus()
    else goTo('results')
  }

  return (
    <form className="step" onSubmit={handleSubmit} noValidate aria-labelledby="trip-heading">
      <StepHeading id="trip-heading">Where are you flying?</StepHeading>

      <div className="field-row">
        <Field as="select" label="From" {...fieldProps('source')}>
          <CityOptions />
        </Field>
        <Field as="select" label="To" {...fieldProps('destination')}>
          <CityOptions />
        </Field>
      </div>
      <Field label="Travel date" type="date" min={today} {...fieldProps('travelDate')} />

      <div className="actions">
        <button type="button" className="button-secondary" onClick={() => goTo('traveller')}>
          Back
        </button>
        <button type="submit" className="button-primary">
          Search flights
        </button>
      </div>
    </form>
  )
}

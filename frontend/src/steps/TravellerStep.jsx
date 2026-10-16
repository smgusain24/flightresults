import { useState } from 'react'
import { useWizard } from '../wizard/context.js'
import { validateTraveller } from '../wizard/validation.js'
import Field from './Field.jsx'
import StepHeading from './StepHeading.jsx'

const FIELDS = ['firstName', 'lastName', 'email', 'phone']

export default function TravellerStep() {
  const { state, updateTraveller, goTo } = useWizard()
  const { traveller } = state
  const errors = validateTraveller(traveller)
  const [touched, setTouched] = useState({})
  const [attempted, setAttempted] = useState(false)

  const fieldProps = (field) => ({
    name: field,
    value: traveller[field],
    error: attempted || touched[field] ? errors[field] : undefined,
    onChange: (event) => updateTraveller({ [field]: event.target.value }),
    onBlur: () => setTouched((current) => ({ ...current, [field]: true })),
  })

  function handleSubmit(event) {
    event.preventDefault()
    setAttempted(true)
    const firstInvalid = FIELDS.find((field) => errors[field])
    if (firstInvalid) event.currentTarget.elements.namedItem(firstInvalid).focus()
    else goTo('trip')
  }

  return (
    <form className="step" onSubmit={handleSubmit} noValidate aria-labelledby="traveller-heading">
      <StepHeading id="traveller-heading">Who&rsquo;s flying?</StepHeading>

      <div className="field-row">
        <Field label="First name" autoComplete="given-name" {...fieldProps('firstName')} />
        <Field label="Last name" autoComplete="family-name" {...fieldProps('lastName')} />
      </div>
      <Field label="Email" type="email" autoComplete="email" {...fieldProps('email')} />
      <Field
        label="Phone number"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        hint="10 digits, without the country code"
        {...fieldProps('phone')}
      />

      <div className="actions">
        <button type="submit" className="button-primary">
          Continue to trip
        </button>
      </div>
    </form>
  )
}

import { useWizard } from '../wizard/context.js'
import { STEPS } from '../wizard/state.js'

const LABELS = { traveller: 'Your details', trip: 'Trip', results: 'Flights' }

export default function StepIndicator() {
  const { state, canEnter, goTo } = useWizard()

  return (
    <nav aria-label="Booking steps">
      <ol className="steps">
        {STEPS.map((step, index) => {
          const current = step === state.step
          const content = (
            <>
              <span className="step-number" aria-hidden="true">
                {index + 1}
              </span>
              {LABELS[step]}
            </>
          )
          return (
            <li
              key={step}
              className={current ? 'step-item step-current' : 'step-item'}
              aria-current={current ? 'step' : undefined}
            >
              {!current && canEnter(step) ? (
                <button type="button" className="step-link" onClick={() => goTo(step)}>
                  {content}
                </button>
              ) : (
                <span className="step-label">{content}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

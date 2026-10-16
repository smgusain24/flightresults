import { useEffect, useRef } from 'react'

// Moves focus to the new screen's heading so keyboard and screen-reader users
// start at the top of each step.
export default function StepHeading({ id, children }) {
  const ref = useRef(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <h2 id={id} ref={ref} tabIndex={-1} className="step-heading">
      {children}
    </h2>
  )
}

import { useEffect, useEffectEvent, useMemo, useReducer } from 'react'
import { WizardContext } from './context.js'
import { canEnter, initialState, wizardReducer } from './state.js'
import { localToday } from './validation.js'

// Each step is a browser history entry, so the browser's Back and Forward
// buttons move between steps. The URL itself never changes.
const HISTORY_KEY = 'wizardStep'

export default function WizardProvider({ children }) {
  const [state, dispatch] = useReducer(wizardReducer, initialState)

  const onPopState = useEffectEvent((event) => {
    const step = event.state?.[HISTORY_KEY]
    if (step === state.step) return
    if (canEnter(state, step, localToday())) {
      dispatch({ type: 'step/go', step })
    } else {
      // The entry points at a step whose inputs no longer validate: stay put.
      window.history.replaceState({ [HISTORY_KEY]: state.step }, '')
    }
  })

  useEffect(() => {
    window.history.replaceState({ ...window.history.state, [HISTORY_KEY]: initialState.step }, '')
    const listener = (event) => onPopState(event)
    window.addEventListener('popstate', listener)
    return () => window.removeEventListener('popstate', listener)
  }, [])

  const wizard = useMemo(
    () => ({
      state,
      canEnter: (step) => canEnter(state, step, localToday()),
      goTo(step) {
        if (step === state.step || !canEnter(state, step, localToday())) return false
        window.history.pushState({ [HISTORY_KEY]: step }, '')
        dispatch({ type: 'step/go', step })
        return true
      },
      updateTraveller: (fields) => dispatch({ type: 'traveller/update', fields }),
      updateTrip: (fields) => dispatch({ type: 'trip/update', fields }),
      setSort: (sort) => dispatch({ type: 'view/sort', sort }),
      setMinStars: (minStars) => dispatch({ type: 'view/minStars', minStars }),
    }),
    [state],
  )

  return <WizardContext value={wizard}>{children}</WizardContext>
}

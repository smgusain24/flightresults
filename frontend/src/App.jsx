import ResultsStep from './steps/ResultsStep.jsx'
import StepIndicator from './steps/StepIndicator.jsx'
import TravellerStep from './steps/TravellerStep.jsx'
import TripStep from './steps/TripStep.jsx'
import WizardProvider from './wizard/WizardProvider.jsx'
import { useWizard } from './wizard/context.js'

const SCREENS = { traveller: TravellerStep, trip: TripStep, results: ResultsStep }

function CurrentStep() {
  const { state } = useWizard()
  const Screen = SCREENS[state.step]
  return <Screen />
}

export default function App() {
  return (
    <WizardProvider>
      <header className="masthead">
        <div className="masthead-inner">
          <p className="brand">Flight search</p>
          <StepIndicator />
        </div>
      </header>
      <main className="container">
        <CurrentStep />
      </main>
    </WizardProvider>
  )
}

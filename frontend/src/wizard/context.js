import { createContext, use } from 'react'

export const WizardContext = createContext(null)

export function useWizard() {
  const wizard = use(WizardContext)
  if (!wizard) throw new Error('useWizard must be used inside <WizardProvider>')
  return wizard
}

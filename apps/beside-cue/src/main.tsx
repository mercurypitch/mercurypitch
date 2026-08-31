import { render } from 'solid-js/web'
import '@fontsource-variable/gabarito'
import '@fontsource/coiny/latin-400.css'
import '@fontsource/saira-condensed/latin-600.css'
import '@fontsource/saira-condensed/latin-700.css'
import './styles.css'
import { App } from './App'
import { DEFAULT_BESIDE_CUE_CONFIG } from './app-config'
import { createDefaultAppServices } from './app-services'
import { isDevSeedEnabled } from './dev/dev-seed-flag'

const root = document.querySelector<HTMLDivElement>('#root')

if (root === null) {
  throw new Error('Beside Cue could not find its application root.')
}

// The literal DEV test is what lets the bundler delete this branch, and with
// it the dynamic import of the seeder, from a production build.
if (
  import.meta.env.DEV &&
  isDevSeedEnabled(import.meta.env, window.location.search)
) {
  const services = createDefaultAppServices()
  const { seedDevState } = await import('./dev/dev-seed')
  await seedDevState({
    repository: services.repository,
    onboardingPreferences: services.onboardingPreferences,
    onboardingRevision: DEFAULT_BESIDE_CUE_CONFIG.onboarding.revision,
  }).catch((error: unknown) => {
    console.error('dev seed failed', error)
    return false
  })
  render(() => <App services={services} />, root)
} else {
  render(() => <App />, root)
}

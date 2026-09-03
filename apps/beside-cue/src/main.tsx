// ============================================================
// Beside Cue entry point — mounts the single product onboarding configuration
// ============================================================

import { configureInputDevice } from '@irchiinnuss/audio-io'
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
import { isOnboardingReviewEnabled } from './onboarding-review'

// The remembered microphone is this product's, not the package's
// default: two apps served from one origin must not share the entry.
configureInputDevice({ storageKey: 'beside-cue:input-device' })

const root = document.querySelector<HTMLDivElement>('#root')

if (root === null) {
  throw new Error('Beside Cue could not find its application root.')
}

const config = DEFAULT_BESIDE_CUE_CONFIG

const onboardingReview = isOnboardingReviewEnabled({
  VITE_BESIDE_CUE_ONBOARDING_REVIEW: import.meta.env
    .VITE_BESIDE_CUE_ONBOARDING_REVIEW,
})

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
    onboardingRevision: config.onboarding.revision,
  }).catch((error: unknown) => {
    console.error('dev seed failed', error)
    return false
  })
  render(
    () => (
      <App
        config={config}
        onboardingReview={onboardingReview}
        services={services}
      />
    ),
    root,
  )
} else {
  render(
    () => <App config={config} onboardingReview={onboardingReview} />,
    root,
  )
}

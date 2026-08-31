// ============================================================
// Beside Cue entry point — selects an explicit onboarding configuration
// ============================================================

import { render } from 'solid-js/web'
import '@fontsource-variable/gabarito'
import '@fontsource/coiny/latin-400.css'
import '@fontsource/saira-condensed/latin-600.css'
import '@fontsource/saira-condensed/latin-700.css'
import './styles.css'
import { App } from './App'
import { DEFAULT_BESIDE_CUE_CONFIG, V2_BESIDE_CUE_PREVIEW_CONFIG, } from './app-config'
import { createDefaultAppServices } from './app-services'
import { isDevSeedEnabled } from './dev/dev-seed-flag'
import { isOnboardingReviewEnabled, isV2OnboardingPreviewEnabled, } from './v2-onboarding-preview'

const root = document.querySelector<HTMLDivElement>('#root')

if (root === null) {
  throw new Error('Beside Cue could not find its application root.')
}

const config = isV2OnboardingPreviewEnabled({
  VITE_BESIDE_CUE_V2_ONBOARDING: import.meta.env.VITE_BESIDE_CUE_V2_ONBOARDING,
  VITE_BESIDE_CUE_ONBOARDING_REVIEW: import.meta.env
    .VITE_BESIDE_CUE_ONBOARDING_REVIEW,
})
  ? V2_BESIDE_CUE_PREVIEW_CONFIG
  : DEFAULT_BESIDE_CUE_CONFIG

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

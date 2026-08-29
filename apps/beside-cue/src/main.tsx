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

render(
  () => (
    <App
      config={config}
      onboardingReview={isOnboardingReviewEnabled({
        VITE_BESIDE_CUE_ONBOARDING_REVIEW: import.meta.env
          .VITE_BESIDE_CUE_ONBOARDING_REVIEW,
      })}
    />
  ),
  root,
)

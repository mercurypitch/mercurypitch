// ============================================================
// The onboarding's landing: the Warm-up's path (S7b beat 10, §3.7)
// ============================================================
//
// The onboarding's own end (Continue on the sung line, the Cloud offer
// closed, or Continue without the mic after a refusal, REQ-NFL-043) lands
// on the Warm-up's path instead of the Sing room. The path is pushed over
// the Sing room as the Sing room's own exercise row pushes it, while the
// layer is still up, so the room under it never arrives live only to be
// covered: the layer fades off the path as it draws in, and Merc hops
// beside its first stop (path-landing.ts). Back from the path is the Sing
// room. Not now leaves for the Sing room, as it always has.
//
// Nothing is added to the Warm-up's plan: a skipped range keeps its way
// back through Keep's "Find your range first".

import { trackNativeOnboarding } from '@/features/onboarding/funnel'
import { askPathLanding } from '@/features/warm-up/path-landing'
import { EXERCISE_WARM_UP_PATH } from '@/lib/domain/exercise-contracts'
import { openPremiumExercise } from '../shell/premium-exercise-wiring'

/** Push the Warm-up's path as the onboarding's landing. */
export function landOnWarmUp(): void {
  askPathLanding()
  openPremiumExercise(EXERCISE_WARM_UP_PATH)
  trackNativeOnboarding('native_onboarding_path_view')
}

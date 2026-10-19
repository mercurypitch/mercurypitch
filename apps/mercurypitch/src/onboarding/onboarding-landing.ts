// ============================================================
// The onboarding's landings: the Warm-up's path (S7b beat 10, §3.7), and
// the alley after Not now
// ============================================================
//
// The onboarding's own end (Continue on the sung line, the Cloud offer
// closed, or Continue without the mic after a refusal, REQ-NFL-043) lands
// on the Warm-up's path instead of the Sing room. The path is pushed over
// the Sing room as the Sing room's own exercise row pushes it, while the
// layer is still up, so the room under it never arrives live only to be
// covered: the layer fades off the path as it draws in, and Merc hops
// beside its first stop (path-landing.ts). Back from the path is the Sing
// room.
//
// Not now (on the layer, or Back as Not now) lands on the Rooms home, the
// alley, not the Sing room the layer opened over (owner, 20 Oct 2026),
// once the Cloud offer it may open has closed. Nothing is pushed: the tab
// changes as the rail's own Home changes it.
//
// Nothing is added to the Warm-up's plan: a skipped range keeps its way
// back through Keep's "Find your range first".

import { trackNativeOnboarding } from '@/features/onboarding/funnel'
import { TAB_HOME } from '@/features/tabs/constants'
import { askPathLanding } from '@/features/warm-up/path-landing'
import { EXERCISE_WARM_UP_PATH } from '@/lib/domain/exercise-contracts'
import { openPremiumExercise } from '../shell/premium-exercise-wiring'
import { goToTab } from '../shell/shell-navigation'

/** Push the Warm-up's path as the onboarding's landing. */
export function landOnWarmUp(): void {
  askPathLanding()
  openPremiumExercise(EXERCISE_WARM_UP_PATH)
  trackNativeOnboarding('native_onboarding_path_view')
}

/** Not now's landing: the Rooms home, the alley. */
export function landInAlley(): void {
  goToTab(TAB_HOME)
}

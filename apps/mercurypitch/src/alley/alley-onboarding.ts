// ============================================================
// The alley's part in the native onboarding
// ============================================================
//
// A new install's onboarding opens over the Sing room: its code loads as
// the Sing door is picked, and the room's words are held, so none of them
// show as the door opens into it (onboarding-layer.ts). Any other door, the
// alley at rest again, or the alley gone lets them go.
//
// Each call is behind the switch, as the shell's are: a store build folds
// the branch, and only then drops the layer's module, its flag and its
// storage key with it (MISTAKES.md, a folded branch still runs the modules
// its imports name; onboarding-fold.test.ts).

import type { ActiveTab } from '@/features/tabs/constants'
import { TAB_SINGING } from '@/features/tabs/constants'
import { NATIVE_ONBOARDING } from '@/lib/native-build'
import { expectNoOnboarding, expectOnboarding, } from '../onboarding/onboarding-layer'

/** A door picked: the Sing room's readies the onboarding, any other lets it go. */
export function onboardingForDoor(tab: ActiveTab | null): void {
  if (NATIVE_ONBOARDING) {
    if (tab === TAB_SINGING) expectOnboarding()
    else expectNoOnboarding()
  }
}

/** A door entered without a pick first (the keyboard's way in): as a pick. */
export function onboardingForEntry(tab: ActiveTab): void {
  if (NATIVE_ONBOARDING) {
    if (tab === TAB_SINGING) expectOnboarding()
  }
}

/** The room's words go free. */
export function letOnboardingGo(): void {
  if (NATIVE_ONBOARDING) expectNoOnboarding()
}

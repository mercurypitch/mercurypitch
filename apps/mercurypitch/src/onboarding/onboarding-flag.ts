// ============================================================
// The onboarding flag: is this install's onboarding still to come?
// ============================================================
//
// 'due' until the singer finishes the onboarding or leaves it with Not now,
// then 'done' for good: completion is recorded once, and a later launch
// never walks into it again (REQ-NFL-047).
//
// SETTLED ONCE, as the shell mounts (`settleOnboarding`). An install that
// has opened a door already (alley-welcome.ts) is not new: the update that
// brings the onboarding must not hand somebody who has been singing for
// weeks a first-run flow. A new install has opened none, so it is due.
//
// THIS INSTALL'S, like the welcome flag: an `mp:` key, which the settings
// sync never pushes (it syncs `pitchperfect_` keys, settings-service.ts),
// so a second phone gets its own onboarding. Built on first read, not at
// import, for the reason alley-welcome.ts gives.
//
// Stored as the bare word, so a walk can seed it (probe-bundle.mjs).

import type { Signal } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'

export const ONBOARDING_KEY = 'mp:native-onboarding'

export type OnboardingFlag = 'due' | 'done'

/** '' until the flag is settled. */
type Stored = OnboardingFlag | ''

let flag: Signal<Stored> | undefined

const resolve = (): Signal<Stored> => {
  flag ??= createPersistedSignal<Stored>(ONBOARDING_KEY, '', {
    validator: (value): value is Stored => value === 'due' || value === 'done',
  })
  return flag
}

/** Whether the onboarding is still to come on this install. */
export function onboardingDue(): boolean {
  return resolve()[0]() === 'due'
}

/**
 * Settle the flag once: due on a new install, done on one that has opened
 * a door (`seenWelcome`). A flag already settled is left as it is. What it
 * settled to, or null when it was settled already: 'due' is a new install.
 */
export function settleOnboarding(seenWelcome: boolean): OnboardingFlag | null {
  if (resolve()[0]() !== '') return null
  const settled: OnboardingFlag = seenWelcome ? 'done' : 'due'
  resolve()[1](settled)
  return settled
}

/** Finished, or left with Not now. Idempotent. */
export function markOnboardingDone(): void {
  if (resolve()[0]() === 'done') return
  resolve()[1]('done')
}

/** "Replay the onboarding" (the Developer screen): due again. */
export function resetOnboarding(): void {
  resolve()[1]('due')
}

/** Whether the flag has been built. Tests only: it must not be at import. */
export function onboardingFlagBuilt(): boolean {
  return flag !== undefined
}

/** Tests only: the next read builds the flag again, from storage. */
export function resetOnboardingFlagForTests(): void {
  flag = undefined
}

// ============================================================
// useFirstLight — opens First Light whenever it is due
// ============================================================
//
// App's first-run decision, kept here so it can be tested against the real
// stores. `showWelcome` means "this visitor has not been offered the flow
// yet", and the answer is to open it. The welcome door that used to stand in
// front of it was beat 1 twice: the same greeting, the same two choices, one
// screen earlier, and its "Show me around" named a tour of the interface
// rather than what actually happens, which is that we listen to you sing and
// hand back a voiceprint.
//
// A visitor a lesson's practise link sent (`?lesson=NN`) never finds the flow
// due: index.tsx steps it aside before App mounts (stepAsideForLesson in
// onboarding-store.ts).

import type { Accessor } from 'solid-js'
import { createEffect, createSignal } from 'solid-js'
import { flowOpen, openBeat, startOrResumeOnboarding, } from '@/stores/onboarding-store'
import { showWelcome } from '@/stores/ui-store'

export interface FirstLightGate {
  /** True while the flow is open as a replay of its Map (#/map). */
  readonly replay: Accessor<boolean>
  /** Open the Map on its own, as the #/map replay does. */
  readonly openMap: () => void
}

/**
 * Open the flow whenever it is due and nothing holds it back. `held` is a
 * surface that owns the screen meanwhile (the route-backed constellation);
 * the flow opens once it closes.
 */
export function useFirstLight(held: Accessor<boolean>): FirstLightGate {
  // A replay (#/map) reopens the Map without re-running the first-run
  // bookkeeping, so closing it can't rewind anyone's seen-flag.
  const [replay, setReplay] = createSignal(false)

  createEffect(() => {
    if (!showWelcome() || flowOpen() || held()) return
    setReplay(false)
    // Not plain startOnboarding: a Google sign-in mid-flow is a full-page
    // redirect, and this reopens the flow where it left (the map with the
    // measured voiceprint) instead of restarting the visitor at beat one.
    startOrResumeOnboarding()
  })

  const openMap = () => {
    setReplay(true)
    openBeat('map')
  }

  return { replay, openMap }
}

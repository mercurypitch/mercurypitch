// ============================================================
// useOpeningTakeover — what opens when the app does, once, after the account's settings are in
// ============================================================
//
// The decision is opening-takeover.ts's table; this is the timing and the
// doing. Once, from an effect: it reads what the picker needs, picks, and
// opens the plan or tells What's New. First Light needs nothing from it, since
// useFirstLight opens it whenever the welcome is due.
//
// It also says when it has decided (onDecided): once the pick is final and
// whatever it picked is open, and on every other way out as well (First
// Light's turn, no takeover at all, a visit that came for somewhere, a failure,
// an unmount). App holds the tour offer back until then. The offer spends its
// once-per-tab key the moment it shows, so one that showed a moment before the
// plan opened over it would be gone for the tab without having been seen.
// Saying it twice is harmless.
//
// Five things are easy to break:
//
// - A real account waits for the settings pull, up to SETTINGS_PULL_WAIT_MS
//   (settings-pull-wait.ts), before anything is read. The plan record, and the
//   line What's New has told, both sync with the settings, so a second device
//   that decided first would ask for a plan the singer answered on their phone,
//   or announce a release they have read there. After the cap, or when the pull
//   ended without the account's settings, the plan is treated as not due: the
//   next visit asks again, when the pull is on time, and a second device never
//   asks twice. A visitor with no account has no pull to wait for and is picked
//   at once.
// - The route and First Light's flag are read at the start, before the wait,
//   and App has settled both when it set up (OpeningTakeoverProps). The router
//   rewrites the address in its first dispatch (it erases a checkout return's
//   one-shot hash, and keeps #/plan only while the layer is up), so by the time
//   a three-second wait ends it says something else. First Light is spent when
//   somebody finishes or skips it, which can happen before this chunk lands or
//   inside the wait: a first-run visitor who does is still on their first run,
//   and gets no second takeover on top of it.
// - The layer opens from an effect, never from the setup. useHashRouter's
//   first dispatch runs in an onMount, and for every address but #/plan it
//   closes the layer, so one opened before it runs is closed unseen
//   (plan-layer-host.ts says the same). An effect registered after the
//   router's runs after its dispatch.
// - Automated runs get nothing. Specs seed the welcome flag to skip onboarding,
//   which makes every spec an existing user with no plan, and the layer would
//   open over every run (announceIfNew has the same guard for the same reason).
// - A takeover that throws costs the visit its takeover and nothing else. It
//   says so on the console, once, and still says it has decided; it never
//   leaves a rejection nobody handles.

import { onCleanup, onMount } from 'solid-js'
import { isE2ETestMode } from '@/lib/test-utils'
import { pickOpeningTakeover } from './opening-takeover'
import { planRecord } from './plan-store'
import { awaitSettingsPull } from './settings-pull-wait'

/** What App fills in: the questions about this visit, the two things the takeover can open, and where to say it has decided. */
export interface OpeningTakeoverDeps {
  /** The native build, which has no takeover. */
  native: boolean
  /** Did this visit come for somewhere in particular? Asked once, at the start: see above. */
  routeSuppressed: () => boolean
  /** Has First Light's welcome not been offered to this visitor yet? Asked once, at the start: see above. */
  welcomeDue: () => boolean
  /** Is a release line this device has not been told about waiting? */
  whatsNewDue: () => boolean
  /** Does this browser hold a real account? Only one has a pull to wait for. */
  upgraded: () => boolean
  /** Resolves when the first settings pull has applied the account's settings, rejecting when it ended without them. */
  settingsPulled: () => Promise<void>
  /** Opens the existing user's plan layer. */
  openPlan: () => void
  /** Announces the release line, as App always has (it knows whether this visitor is returning). */
  announceWhatsNew: () => void
  /** The pick is final and its surface is open, or nothing is going to open. Called more than once is fine. */
  onDecided: () => void
}

/** Picks the visit's one takeover, once, and opens it. Call it in the component that mounts the takeover. */
export function useOpeningTakeover(d: OpeningTakeoverDeps): void {
  const routeSuppressed = d.routeSuppressed()
  const welcomeDue = d.welcomeDue()
  let gone = false
  onCleanup(() => {
    gone = true
    d.onDecided()
  })

  const takeOver = async (): Promise<void> => {
    try {
      if (d.native || routeSuppressed || isE2ETestMode()) return
      const landed = d.upgraded()
        ? (await awaitSettingsPull(d.settingsPulled)) === 'pulled'
        : true
      if (gone) return
      const pick = pickOpeningTakeover({
        native: d.native,
        routeSuppressed,
        welcomeDue,
        planDue: landed && planRecord() === null,
        whatsNewDue: d.whatsNewDue(),
      })
      // 'first-light' is useFirstLight's: nothing opens beside it.
      if (pick === 'plan') d.openPlan()
      else if (pick === 'whats-new') d.announceWhatsNew()
    } catch (err) {
      console.warn('[opening-takeover] The takeover failed:', err)
    } finally {
      d.onDecided()
    }
  }

  onMount(() => {
    void takeOver()
  })
}

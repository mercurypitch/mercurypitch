// ============================================================
// OpeningTakeover — App's mount for the one takeover per visit, on the web
// ============================================================
//
// Draws nothing: it is the place useOpeningTakeover runs, so that the hook,
// the plan store it reads and the account and settings code it fills in all
// sit in a chunk of their own. App loads it lazily, and not in the native
// build at all (R9, R32): a module-level createPersistedSignal is a side effect
// Rollup keeps, so one static import of the store from App would put the plan
// in the phone's bundle. The constant picks a stub before `lazy()` is written,
// as it does for First Light and the plan layer.
//
// App hands in what only App knows (the arrival and First Light's due flag it
// read at its own setup, the two What's New questions it already asked, and
// where to say the takeover has decided); this fills in the rest from the real
// modules and opens the layer the one way an existing user's takeover opens it:
// the store's mode 'existing', which hears the line written for them. The
// host's `open()` is the wrong door, since it picks the review or the skipper's
// four taps by the record.

import type { JSX } from 'solid-js'
import { hasUpgradedAccount } from '@/db/services/auth-service'
import { settingsPulled } from '@/db/services/settings-service'
import { IS_NATIVE_BUILD } from '@/lib/native-build'
import { openPlanLayer } from './plan-store'
import { useOpeningTakeover } from './useOpeningTakeover'

/**
 * What App hands in. Two of them are values and the rest are functions on
 * purpose: what the visit came for and whether it began as a first run are
 * settled at App's setup and must not be asked again, while the others ask or
 * do something that moves as the visit goes on.
 */
export interface OpeningTakeoverProps {
  /** The visit came for somewhere in particular. A value, read at App's setup: the router rewrites the address after. */
  routeSuppressed: boolean
  /** First Light's welcome was due when the visit began. A value, read at App's setup: it is spent when somebody finishes or skips it, which can be before this chunk lands. */
  welcomeDue: boolean
  /** Is a release line this device has not been told about waiting? */
  whatsNewDue: () => boolean
  /** Announces the release line to a returning visitor. */
  announceWhatsNew: () => void
  /** The takeover has chosen and what it chose is open, or nothing will open; also when it failed or was unmounted. Safe to call twice. */
  onDecided: () => void
}

export function OpeningTakeover(props: OpeningTakeoverProps): JSX.Element {
  useOpeningTakeover({
    native: IS_NATIVE_BUILD,
    routeSuppressed: () => props.routeSuppressed,
    welcomeDue: () => props.welcomeDue,
    whatsNewDue: () => props.whatsNewDue(),
    upgraded: hasUpgradedAccount,
    settingsPulled,
    openPlan: () => {
      openPlanLayer('existing')
    },
    announceWhatsNew: () => {
      props.announceWhatsNew()
    },
    onDecided: () => {
      props.onDecided()
    },
  })
  return null
}

// ============================================================
// Native shell bridge — how a room and the native chrome reach each other
// ============================================================
//
// The native shell (`apps/mercurypitch/src/shell/`) draws the bottom rail,
// the transport that replaces it during a run, the More sheet and the pushed
// Settings screen. It lives in the app package, so nothing under `src/` can
// import it, and nothing in it can be imported from here. This module is the
// one seam between the two, and it points both ways:
//
//   room  → shell   `registerRunControls()`. A room that owns a run hands the
//                   shell everything the transport needs — whether it is
//                   playing, the count-in, pause, resume, stop, and the park
//                   that stops sound and releases the mic on the same frame
//                   (REQ-NHR-017).
//   shell → room    `registerShellApi()` for the room's "All settings" row,
//                   and `shellOwnsTransport()` for the one question a room
//                   has to ask before drawing its own transport.
//
// WHY THE SHELL ASKS THE ROOM RATHER THAN THE STORE. `playbackState` in
// `playback-state-store.ts` reads like the app's transport signal and is not:
// the only production writer is `resetPlaybackState()`, which sets 'stopped'.
// A practice run's real play state is `usePlaybackController`'s own signals,
// handed to the stage as props — so the shell derives its run from THESE
// accessors and falls back to the global store only where no room has
// registered. A shell that watched the store alone never left `browsing`.
//
// Both registries are plain signals, both are empty on the web, and every
// caller on the `src/` side is wrapped in `IS_NATIVE_BUILD` so the web bundle
// keeps none of it. Registration returns its own unregister: a room that
// unmounts while the shell is still up must not leave a transport pointed at
// a dead engine.

import { createSignal } from 'solid-js'
import type { ActiveTab } from '@/features/tabs/constants'

/** What the shell's transport drives, supplied by the room that owns the run. */
export interface NativeRunControls {
  /** The tab the run belongs to. The session pill keys off it. */
  readonly tab: ActiveTab
  /** The room's name, for the pill and the room header. */
  readonly roomLabel: string
  /** The room's OWN play state — not `playbackState()`. See the header. */
  isPlaying: () => boolean
  isPaused: () => boolean
  /** The bars before the first note. The shell shows them on the primary. */
  isCountingIn?: () => boolean
  countInBeat?: () => number
  pause: () => void
  resume: () => void
  stop: () => void
  /**
   * Leave the run behind: stop the sound AND release the microphone, both on
   * the frame the singer left the room. Pause, never stop — a parked run
   * comes back paused. Parking never asks first.
   */
  park: () => void
  /** Open the room's own options sheet (the shell's gear). */
  openOptions?: () => void
  /**
   * Whether a take the singer has not kept is on screen.
   *
   * Absent means NO. Today no room can answer — a practice run leaves nothing
   * the stores call a take — and a Keep alert on every Stop, whose two
   * answers do the same thing, teaches a promise the app does not keep. A
   * room that gains a real take opts in here and gets the alert.
   */
  hasUnsavedTake?: () => boolean
}

/** What a room can ask the shell for. */
export interface NativeShellApi {
  /** Push the Settings screen (Back returns to the room). */
  pushSettings: () => void
  /**
   * Open THIS APP's row in the system Settings — the one place a refused
   * microphone can be turned back on, because neither platform prompts twice.
   *
   * It lives on the shell rather than in the room for the same reason
   * `pushSettings` does: the call is `openAppSettings()` from
   * `@irchiinnuss/mobile-runtime/platform`, a package only the app depends
   * on, and the web build must not so much as resolve it. Optional, so a room
   * that finds no shell (or an older one) simply has no button to offer.
   */
  openAppSettings?: () => Promise<boolean>
}

const [runControls, setRunControls] = createSignal<NativeRunControls | null>(
  null,
)
const [shellApi, setShellApi] = createSignal<NativeShellApi | null>(null)
const [transportOwned, setTransportOwned] = createSignal(false)

/** The run controls of the room that currently owns a run, or null. */
export const nativeRunControls = runControls

/** The shell's own API, or null on the web and before the shell mounts. */
export const nativeShellApi = shellApi

/**
 * True while the shell's band is showing this run's transport.
 *
 * The room asks this, not "am I playing": the two are not the same question.
 * A room that hid its own controls on "a run is going" would leave the singer
 * with no Stop at all in the moments the shell has not taken the band —
 * counting in, or a build where the shell is not mounted at all.
 */
export const shellOwnsTransport = transportOwned

export function setShellOwnsTransport(owned: boolean): void {
  setTransportOwned(owned)
}

export function registerRunControls(controls: NativeRunControls): () => void {
  setRunControls(controls)
  return () => {
    // Only clear what we put there: a second room that registered after us
    // owns the slot now, and clearing it would take its transport away.
    setRunControls((current) => (current === controls ? null : current))
  }
}

export function registerShellApi(api: NativeShellApi): () => void {
  setShellApi(api)
  return () => {
    setShellApi((current) => (current === api ? null : current))
  }
}

// ── Parking, and the cleanup it must survive ─────────────────
//
// Leaving a room runs that room's tab-transition cleanup, which for Sing ends
// the run outright. That is right for every way of leaving EXCEPT the one the
// shell just handled: it has already paused the run and released the mic, and
// the session pill is the way back to it. The tab is remembered rather than a
// bare flag, so a park that did not lead to a transition cannot make the next,
// unrelated leave skip its cleanup.

let parkedFrom: ActiveTab | null = null

/** Called by the shell the moment it parks a run in `tab`. */
export function markRunParked(tab: ActiveTab): void {
  parkedFrom = tab
}

/** True once, and only for the tab the shell actually parked. */
export function consumeRunParked(tab: ActiveTab): boolean {
  const parked = parkedFrom === tab
  parkedFrom = null
  return parked
}

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
//                   shell the controls the transport needs — pause, resume,
//                   stop, and the park that stops sound and releases the mic
//                   on the same frame (REQ-NHR-017). The shell renders no
//                   transport until a room has registered one.
//   shell → room    `registerShellApi()`. A room's own options sheet ends
//                   with an "All settings" row, and Settings is a screen the
//                   SHELL pushes. This is how the row reaches it.
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
  isPlaying: () => boolean
  isPaused: () => boolean
  pause: () => void
  resume: () => void
  stop: () => void
  /**
   * Leave the run behind: stop the sound AND release the microphone, both on
   * the frame the singer left the room. Parking never asks first.
   */
  park: () => void
  /** Open the room's own options sheet (the shell's gear). */
  openOptions?: () => void
  /**
   * Whether a take the singer has not kept is on screen. Today no room can
   * answer this — the practice run leaves nothing the stores call a take —
   * so the default treats every ended run as unsaved and the Keep alert is
   * always asked. Wire it the moment a room can tell.
   */
  hasUnsavedTake?: () => boolean
}

/** What a room can ask the shell for. */
export interface NativeShellApi {
  /** Push the Settings screen (Back returns to the room). */
  pushSettings: () => void
}

const [runControls, setRunControls] = createSignal<NativeRunControls | null>(
  null,
)
const [shellApi, setShellApi] = createSignal<NativeShellApi | null>(null)

/** The run controls of the room that currently owns a run, or null. */
export const nativeRunControls = runControls

/** The shell's own API, or null on the web and before the shell mounts. */
export const nativeShellApi = shellApi

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

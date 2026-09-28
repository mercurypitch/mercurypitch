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
import type { AudioContextLease } from '@/lib/audio-context-lease'
import type { SettingsSection } from '@/stores/settings-section'

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
   * Open the room's background picker (the shell's room-name chip).
   *
   * Absent means the chip is a label, exactly as it was: a room with no
   * picker of its own must not grow a button that does nothing. The chip is
   * the one piece of chrome on a room that names it, which is why the owner
   * asked for the picker to live behind it (device round 2, R5) — but the
   * shell cannot open a picker it does not own, so the room hands it one.
   */
  openRoomPicker?: () => void
  /**
   * Close the topmost thing the ROOM has over its own stage, if there is
   * one, and say whether anything closed.
   *
   * Back has an order (`shell-navigation.ts`) and everything in it belongs to
   * the shell — the column, the Keep alert, the More sheet, a pushed screen.
   * A room with a sheet or a card of its own was invisible to it: Back fell
   * straight through to history, the room unmounted with its card still
   * undecided, and the Sing room's end card took the take with it.
   *
   * Asking IS closing, deliberately. "Is something open" and "close it" would
   * be two answers that can disagree, and only the room can answer either.
   */
  closeRoomOverlay?: () => boolean
  /**
   * The room draws its own transport, and the shell must not draw another.
   *
   * The Karaoke room plays inside zen's bar: the scrubber, both times, the
   * mic, the music level and Next, none of which the shell's Transport has
   * (S8 decision D2 A). During a run the shell still steps the rail aside,
   * as for any run, but draws no Transport and no corner chip in its place.
   * Absent means the shell's Transport, as Sing has it.
   */
  readonly ownsTransport?: boolean
  /** The gear's accessible name. Absent means "Practice options". */
  readonly optionsLabel?: string
  /**
   * The one option the singer pinned beside the gear, as it is now, or null
   * for none (owner, 27 Sep: the Karaoke room's toggles live behind the gear,
   * and one of them may also sit in the header). Absent means none.
   */
  pinnedToggle?: () => PinnedRoomToggle | null
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

/** An option a room pinned beside the gear. The shell draws it by `icon`. */
export interface PinnedRoomToggle {
  readonly icon: 'lyrics-size' | 'notes' | 'play-next'
  /** The accessible name. A control that steps says its state here. */
  readonly label: string
  /** A switch's state. Absent for a control that steps, not switches. */
  readonly pressed?: boolean
  readonly onToggle: () => void
}

/** What a room can ask the shell for. */
export interface NativeShellApi {
  /**
   * Push the Settings screen (Back returns to where it was asked from).
   *
   * The section is the web's name for the part of Settings a caller wanted
   * (`openSettingsSection`): the native Settings has no tab of its own, so
   * every in-app jump to one arrives here, and the shell decides which of
   * its screens answers it.
   */
  pushSettings: (section?: SettingsSection) => void
  /**
   * Open THIS APP's row in the system Settings — the one place a refused
   * microphone can be turned back on, because neither platform prompts twice.
   *
   * It lives on the shell rather than in the room for the same reason
   * `pushSettings` does: the call is `openAppSettings()` from
   * `@irchiinnuss/mobile-runtime/platform`, which wraps Capacitor plugins,
   * and the web build must never import it. (The web app depends on the
   * package for its plugin-free `asset-fetch` entry alone, and
   * eslint.config.js refuses every other entry under src/.) Optional, so a
   * room that finds no shell (or an older one) simply has no button to offer.
   */
  openAppSettings?: () => Promise<boolean>
  /**
   * Open the shell's sign-in sheet.
   *
   * Every in-app "Sign in" (`openAuthModal`) arrives here under the native
   * build: the web's sign-in dialog, with its password-first form, the
   * television's phone row and the passkey button, is not the phone's way in
   * (S6 audit D2). Optional, like `openAppSettings`.
   */
  openSignIn?: () => void
  /**
   * Push the Karaoke studio over the room: the old Karaoke tab, a library to
   * work on (plan S8 §11, decision D8 A). The room's Options reach it from
   * "Manage songs". Optional, like `openSignIn`: a room that finds no shell
   * that offers it draws no row for it.
   */
  openKaraokeStudio?: () => void
  /**
   * The Karaoke subscription, bought and restored through the store (plan
   * S8 §6.7). The purchase port it wraps lives in the app, which the room
   * cannot import. Until the store products and RevenueCat's keys exist
   * (owner, plan step 25) the port is the inert one and every call answers
   * `unavailable`, so the paywall fails closed. Optional, like the rest: a
   * room that finds none treats it the same way.
   */
  karaokeSubscription?: KaraokeSubscriptionApi
}

/** How a Subscribe ended. Only `purchased` changes anything. */
export type KaraokeSubscribeOutcome =
  | 'purchased'
  | 'pending'
  | 'cancelled'
  | 'unavailable'
  | 'failed'

/** How a Restore purchases ended. */
export type KaraokeRestoreOutcome =
  | 'restored'
  | 'nothing'
  | 'unavailable'
  | 'failed'

/** The plan the paywall offers, as the store states it. */
export interface KaraokeOffer {
  /** The price in the singer's own storefront, as the store writes it. */
  readonly priceText: string
  /** The product's name in the store. */
  readonly title: string
}

export interface KaraokeSubscriptionApi {
  subscribe: () => Promise<KaraokeSubscribeOutcome>
  restore: () => Promise<KaraokeRestoreOutcome>
  /** The month's plan at the store's own price; null without a store. */
  offer?: () => Promise<KaraokeOffer | null>
  /** The store's own page for the subscription, where the store has one. */
  manage?: () => Promise<void>
}

/**
 * A claim on the app's one AudioContext (`packages/audio-io`'s broker), as
 * its claimant holds it: what it lends, and the release. The last claim
 * released suspends the clock; nothing ever closes it.
 */
export interface NativeAudioLease extends AudioContextLease {
  release(): void
}

/**
 * What a room under `src/` needs from the device and cannot import.
 *
 * The root package does not depend on `packages/audio-io`, and eslint keeps
 * every `@irchiinnuss/mobile-runtime` entry but asset-fetch out of `src/`.
 * The app registers this from its entry (apps/mercurypitch main.tsx); on the
 * web nothing does, and a room that finds nothing builds its own context
 * and leaves the screen to sleep as it always did.
 */
export interface NativeDeviceApi {
  /** A lease on the one shared AudioContext, under the owner's name. */
  acquireAudio: (owner: string) => NativeAudioLease
  /** Keep the screen on while a song plays, and let it sleep after. */
  keepAwake: (on: boolean) => void
}

const [runControls, setRunControls] = createSignal<NativeRunControls | null>(
  null,
)
const [deviceApi, setDeviceApi] = createSignal<NativeDeviceApi | null>(null)

/** The device, or null on the web and before the app registers it. */
export const nativeDeviceApi = deviceApi

export function registerNativeDevice(api: NativeDeviceApi): () => void {
  setDeviceApi(api)
  return () => {
    setDeviceApi((current) => (current === api ? null : current))
  }
}
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

// ── The door that opened into a room ─────────────────────────
//
// The alley's Enter grows a clone of the door over the screen, and the room
// mounts UNDER it. A room that starts its own arrival on mount — the Sing
// room reaches for the microphone the moment it opens, once the grant is
// remembered — would then start while the alley's ambient is still fading
// and a picture of the door is still on the glass (S4 brief §2: the arrival
// flow "starts only after the clone is gone and the ambient is silent").
//
// So the shell holds the arrival for the length of that hand-over, and a room
// that has an arrival waits for `roomArrivalHeld()` to fall before it runs.
// Holds count, so two overlapping ones cannot release each other early; the
// release is idempotent, so a failsafe and the normal path can both call it.

const [arrivalHolds, setArrivalHolds] = createSignal(0)

/** True while a door is still handing the screen over to its room. */
export function roomArrivalHeld(): boolean {
  return arrivalHolds() > 0
}

/**
 * Tests only: drop every hold. The count is module state, so a case that
 * throws between a hold and its release would otherwise hold every later
 * case in the file.
 */
export function resetRoomArrivalHolds(): void {
  setArrivalHolds(0)
}

/** Hold every room's arrival until the returned release is called. */
export function holdRoomArrival(): () => void {
  setArrivalHolds((count) => count + 1)
  let released = false
  return () => {
    if (released) return
    released = true
    setArrivalHolds((count) => Math.max(0, count - 1))
  }
}

// ── Where "Skip to main content" goes ────────────────────────
//
// The app's skip link points at `#main-content`, which under the native
// build is empty on the Rooms tab: the alley is drawn by the shell, portalled
// after the app. So a surface the shell draws in place of the page registers
// itself here, and the link moves focus to it instead.

let skipTarget: HTMLElement | null = null

/** The element the skip link should focus, for as long as it is mounted. */
export function registerSkipTarget(element: HTMLElement): () => void {
  skipTarget = element
  return () => {
    if (skipTarget === element) skipTarget = null
  }
}

/** Where the skip link goes under the native build, or null for `#main-content`. */
export function nativeSkipTarget(): HTMLElement | null {
  return skipTarget !== null && skipTarget.isConnected ? skipTarget : null
}

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
import type { PremiumExerciseId } from '@/lib/domain/exercise-contracts'
import type { LyricWindowScript } from '@/lib/lyric-window-script'
import type { TvStageMessage } from '@/lib/tv-stage/protocol'
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
  /**
   * How far the work the switch started has got, 0 to 100, while it runs:
   * the notes being read from the vocal. Absent when nothing is running.
   */
  readonly progress?: number
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
   * A test build's Developer screen, scrolled to one of its sections (the id
   * `registerDeveloperSection` was given). Absent from a store build, which
   * has no Developer screen, so a room offers no button for it there. The
   * Karaoke room's stage asks for "karaoke-audio" when it refused a song that
   * one of that section's switches could let it play.
   */
  openDeveloperSection?: (id: string) => void
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
   * Open Keep, the account offer (S7b §3.5): what an account keeps, then
   * Apple, Google or email. For the Cloud offer's free account line
   * (FREE_ACCOUNT_LINE) and anything else that asks for a free account
   * rather than a sign-in. The same shape as `openSignIn`. Optional, like it.
   */
  openKeep?: () => void
  /**
   * Push the Karaoke studio over the room: the old Karaoke tab, a library to
   * work on (plan S8 §11, decision D8 A). The room's Options reach it from
   * "Manage songs". Optional, like `openSignIn`: a room that finds no shell
   * that offers it draws no row for it.
   */
  openKaraokeStudio?: () => void
  /**
   * Push a premium exercise over the room (Long note first): the Sing
   * room's exercise row, its picker and its options open one by id.
   * Optional, like `openKaraokeStudio`: a build without the premium
   * exercises registers none, and the room draws no way in.
   */
  openExercise?: (id: PremiumExerciseId) => void
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

/**
 * How a Subscribe ended. `purchased` and `moved` give the account the songs.
 * `moved`: the store already held this phone's own purchase, made signed
 * out, and it went to the account instead of being bought again.
 * `held-elsewhere`: the store account already pays for the subscription,
 * filed under another account, and it stays there (owner rule D2).
 */
export type KaraokeSubscribeOutcome =
  | 'purchased'
  | 'moved'
  | 'held-elsewhere'
  | 'pending'
  | 'cancelled'
  | 'unavailable'
  | 'failed'

/**
 * What a sign-in did with a subscription this phone bought signed out:
 * moved it to the account, found nothing of this phone's to move, or could
 * not ask the store (and asks again at the next Subscribe or sign-in).
 */
export type KaraokeCarryOutcome = 'moved' | 'nothing' | 'unavailable' | 'failed'

/** How a Restore purchases ended. */
export type KaraokeRestoreOutcome =
  | 'restored'
  | 'nothing'
  | 'unavailable'
  | 'failed'

/** How Manage subscription ended: the store's page opened, or it did not. */
export type KaraokeManageOutcome = 'opened' | 'failed'

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
  /** The month's plan at the store's own price; null while the store has
   *  none to sell, or there is no store. Rejects when the store cannot say. */
  offer?: () => Promise<KaraokeOffer | null>
  /** The store's own page for the subscription, where the store has one. */
  manage?: () => Promise<KaraokeManageOutcome>
  /** Whether the store holds the subscription for this singer: it knows of
   *  a purchase before the server does. False without a store, or when it
   *  cannot say. */
  storeSubscribed?: () => Promise<boolean>
  /**
   * After a sign-in: a subscription this phone bought while signed out goes
   * to the account now signed in, through the store, so its renewals follow
   * (karaoke-subscription.ts). Never one another account owns.
   */
  carryToAccount?: () => Promise<KaraokeCarryOutcome>
}

/**
 * A claim on the app's one AudioContext (`packages/audio-io`'s broker), as
 * its claimant holds it: what it lends, and the release. The last claim
 * released suspends the clock; nothing ever closes it.
 */
export interface NativeAudioLease extends AudioContextLease {
  release(): void
}

/** What a claimant asks of the clock when it is about to stop. */
export interface NativeAudioLeaseOptions {
  /**
   * The clock is about to be parked: cancel or fade what plays, and return
   * the milliseconds the fade needs (at most 250 are granted).
   */
  readonly prepareToSuspend?: () => number
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
/** A song the system's media controls can name, and where it is. */
export interface NativeNowPlaying {
  readonly title: string
  readonly artist?: string
  readonly playing: boolean
  /** Seconds into the song, on the clock the lyrics follow. */
  readonly position?: number
  /** The song's length in seconds, or 0 while it is not known. */
  readonly duration?: number
  /** How fast it plays: 1 is as written. */
  readonly rate?: number
  /**
   * Paused because the system took the sound (another app, a call), not by
   * a press: iOS can then bring the song back when a call ends.
   */
  readonly interrupted?: boolean
}

/**
 * The system's progress bar let go at a place in the song: the notification's
 * and the shade's on Android, the lock screen's on both.
 */
export interface NativeMediaSeek {
  /** Seconds into the song, as the platform reported them: not clamped. */
  readonly seekTo: number
}

/**
 * iOS: the lock screen's skip back or forward, from wherever the song is
 * now. Seconds; negative goes back.
 */
export interface NativeMediaSkip {
  readonly skipBy: number
}

/**
 * What the system's media controls ask: a press (the notification, the lock
 * screen, a headset), a seek, or a skip.
 */
export type NativeMediaAction =
  | 'play'
  | 'pause'
  | 'stop'
  | NativeMediaSeek
  | NativeMediaSkip

/**
 * Where the phone's sound goes, by kind. AirPlay and HDMI take it to a TV or
 * a receiver, which plays it with a delay of its own.
 */
export type NativeAudioRoute =
  | 'speaker'
  | 'receiver'
  | 'headphones'
  | 'bluetooth'
  | 'airplay'
  | 'hdmi'
  | 'other'
  | 'none'

/**
 * The phone's output at one moment: the volume the app's sound plays at and
 * where it goes (packages/mobile-runtime audio-output.ts reads it).
 */
export interface NativeAudioOutputReading {
  /** 0 to 1. */
  readonly volume: number
  /**
   * How far `volume` can be taken at its word: 'live' follows the volume
   * keys, 'agreed' is an iPhone's two readings saying the same, 'session'
   * is an iPhone's own session alone, which can read 0 while the room plays
   * out loud (packages/mobile-runtime audio-output.ts says when each is).
   */
  readonly volumeKnown: 'live' | 'agreed' | 'session'
  /** Android: the volume in the phone's own steps, and how many there are. */
  readonly step: number | null
  readonly steps: number | null
  readonly route: NativeAudioRoute
  readonly outputs: readonly { readonly type: string; readonly name: string }[]
  /** The rest of what the phone said: iOS's session, Android's mode. */
  readonly detail: Readonly<Record<string, unknown>>
  /** On a change, what moved it. */
  readonly reason: string | null
}

/** The phone's output, read now and heard on every change. */
export interface NativeAudioOutput {
  /** Null where the phone gives no reading. */
  read: () => Promise<NativeAudioOutputReading | null>
  /** Returns the unsubscribe. */
  watch: (handler: (reading: NativeAudioOutputReading) => void) => () => void
  /**
   * Every change of route alone, for what follows the route for as long as
   * the app runs (audio-route-store.ts). Unlike `watch`, a listener here
   * keeps nothing running on the phone between changes. Returns the
   * unsubscribe. Absent where the app cannot say.
   */
  watchRoute?: (handler: (route: NativeAudioRoute) => void) => () => void
}

export interface NativeDeviceApi {
  /**
   * Whether the microphone coming on takes the sound from another app, as
   * a song starting does (iOS). Not on Android.
   */
  micStopsOtherApps: boolean
  /** A lease on the one shared AudioContext, under the owner's name. */
  acquireAudio: (
    owner: string,
    options?: NativeAudioLeaseOptions,
  ) => NativeAudioLease
  /** Keep the screen on while a song plays, and let it sleep after. */
  keepAwake: (on: boolean) => void
  /**
   * Keep the AudioContext running behind another app. Returns the release.
   * Taking it does not start anything; it stops the app leaving the
   * foreground from parking a song that is playing.
   */
  holdAudioInBackground: (owner: string) => () => void
  /**
   * What the system shows as playing, or null for nothing. On Android a song
   * playing or paused here is also what keeps the app from being frozen.
   */
  nowPlaying: (song: NativeNowPlaying | null) => void
  /** The system's media buttons and progress bar. Returns the unsubscribe. */
  onMediaAction: (handler: (action: NativeMediaAction) => void) => () => void
  /**
   * While on, leaving the app opens a small floating window instead of
   * putting the app behind everything: Android's of the whole app, iOS's of
   * the lyrics alone.
   */
  pictureInPictureAutoEnter: (on: boolean) => void
  /**
   * The app entering that window (true) and leaving it (false). Returns the
   * unsubscribe.
   */
  onPictureInPicture: (
    handler: (inPictureInPicture: boolean) => void,
  ) => () => void
  /**
   * iOS: what the window draws, the song's lyrics worked out ahead, or null
   * when the room has no song, which closes a window that is open. The page
   * is hidden behind another app while the window is up, so the window
   * draws itself. Null on Android, whose window shows the page.
   */
  pictureInPictureLyrics: ((script: LyricWindowScript | null) => void) | null
  /**
   * iOS: whether a TV connected to the phone shows the room's lyrics (a test
   * build's "Lyrics on a connected TV"), now and on every change. The TV
   * draws them from the same script as the window, so the room keeps handing
   * it over while the TV shows them, window or not. Returns the unsubscribe.
   * Absent where no TV can show them.
   */
  onTvLyrics?: (handler: (showing: boolean) => void) => () => void
  /**
   * iOS: a TV connected to the phone that draws the room's stage, the pitch
   * lane, the lyrics and the score (a test build's "Stage on a connected
   * TV"). Absent where no TV can.
   */
  tvStage?: NativeTvStage
  /**
   * The phone's volume and where its sound goes, for the premium rooms'
   * low-volume hint and a test build's audio readout. Absent where the app
   * has no reading of it.
   */
  audioOutput?: NativeAudioOutput
}

/**
 * A TV that draws the room's stage (src/lib/tv-stage/): whether it shows it,
 * now and on every change, and what to draw. The TV draws only what it is
 * sent; the room sends while the TV shows it (useKaraokeTvStage.ts).
 */
export interface NativeTvStage {
  /** Returns the unsubscribe. */
  watch: (handler: (showing: boolean) => void) => () => void
  send: (message: TvStageMessage) => void
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

// ── The song list, asked for from outside the Sing room ──────
//
// The Warm-up's "Sing a song" goes back to the Sing room and opens its song
// list (DESIGN-warm-up.md N15). The shell asks as it pops the Warm-up; the
// Sing room opens the list once it is on screen, and takes the request as
// it does, so the list opens once.

const [songListAsked, setSongListAsked] = createSignal(false)

/** The shell: open the Sing room's song list as soon as it is on screen. */
export function requestSongList(): void {
  setSongListAsked(true)
}

/** The Sing room: its song list has been asked for. */
export function songListRequested(): boolean {
  return songListAsked()
}

/** The Sing room opens the list now: true once per request. */
export function takeSongListRequest(): boolean {
  const asked = songListAsked()
  if (asked) setSongListAsked(false)
  return asked
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

// ── A room in the small window ───────────────────────────────
//
// On Android a room can go on in a picture-in-picture window after the
// singer leaves the app (the Karaoke room's lyrics). That window is a few
// centimetres across, and the room draws a compact view of itself into it.
// The shell's chrome is not the room's to hide, so the room says it is in
// there, and the shell takes its rail, header and sheets off the screen for
// as long as it is (shell-attributes.ts, `data-picture-in-picture`).

const [pictureInPicture, setPictureInPicture] = createSignal(false)

/** True while a room is drawing itself for the small window. */
export const roomInPictureInPicture = pictureInPicture

export function setRoomInPictureInPicture(on: boolean): void {
  setPictureInPicture(on)
}

// ── A held note keeps the rail out of reach ──────────────────
//
// An exercise pushed over a tab (Long note) has no run for the shell to
// drive, so `registerRunControls` is the wrong tool: it would take the slot
// from the room underneath and hand it back to nobody when it left. A held
// note still wants the rail out of the way, so a stray thumb cannot change
// tab mid-breath. The shell folds this into `railVisible`.

const [exerciseFocus, setExerciseFocusSignal] = createSignal(false)

/** True while an exercise is holding the singer's attention (a held note). */
export const exerciseHoldsFocus = exerciseFocus

export function setExerciseFocus(on: boolean): void {
  setExerciseFocusSignal(on)
}

// ── A room drawn over a tab answers Back first ───────────────
//
// The Ear Lab's drill room (EAR_LAB_WITH_MERC) covers its tab, rail and
// all, with no run for the shell to drive, so `closeRoomOverlay` (a run
// control) is the wrong slot for it, as it is for a held note. It hands
// the shell its own answer instead: Android's back asks it after the
// shell's own overlays and before history, as a swipe down or Close does
// ("End the run?" mid-run, out of the room otherwise).

let roomBack: (() => boolean) | null = null

/** While a full-screen room is up: Back is its to answer. Returns the
 *  release. */
export function registerRoomBack(answer: () => boolean): () => void {
  roomBack = answer
  return () => {
    if (roomBack === answer) roomBack = null
  }
}

/** Ask the room drawn over the tab, if there is one. True: it answered. */
export function askRoomBack(): boolean {
  return roomBack?.() === true
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

// ── The bar's right side, for the screen under it ────────────
//
// A pushed screen's bar (PushedScreen.tsx) has Back and the screen's name
// on its left. Its right side is a slot the screen under it fills: a
// premium room puts its level pill and its "?" there (RoomBarEnd in the
// room kit), so anything a room needs in the bar later goes the same way.
// The shell registers the slot's element; the room draws into it from its
// own tree, so its signals and its cleanup stay the room's.

const [barEnd, setBarEnd] = createSignal<HTMLElement | null>(null)

/** The bar's right-hand slot, or null with no pushed screen up. */
export const pushedBarEnd = barEnd

export function registerPushedBarEnd(element: HTMLElement): () => void {
  setBarEnd(element)
  return () => {
    setBarEnd((current) => (current === element ? null : current))
  }
}

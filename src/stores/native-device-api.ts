// ============================================================
// The device, as the native app lends it to rooms: its types
// ============================================================
//
// What `registerNativeDevice()` (native-shell-store.ts) takes: the app's one
// AudioContext lent as a lease, the lock screen's Now Playing and its
// controls, where the sound goes, the reminders, and a TV that draws the
// room's stage. Types only, in a module of their own so the shell's bridge
// stays one that reads; native-shell-store.ts names them again, so every
// caller imports them from where it always has.

import type { AudioContextLease } from '@/lib/audio-context-lease'
import type { LyricWindowScript } from '@/lib/lyric-window-script'
import type { TvStageMessage } from '@/lib/tv-stage/protocol'

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

/** Whether the phone will show a reminder: 'prompt' until it has been
 *  asked, 'unavailable' where it cannot show one at all. */
export type NativeReminderPermission =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'unavailable'

/** One reminder, for one date (packages/mobile-runtime reminders.ts). */
export interface NativeReminder {
  /** Unique among those pending; scheduling an id again replaces it. */
  readonly id: number
  readonly title: string
  readonly body: string
  /** Strictly in the future: iOS shows one whose time has passed at once. */
  readonly at: Date
}

/**
 * Notifications the phone shows by itself, at a time the app chose: the Ear
 * Lab's, so a tap on one opens the app on the Ear Lab (native-reminders.ts).
 * None of these rejects: a phone that cannot answers 'unavailable', or false.
 */
export interface NativeReminders {
  permission: () => Promise<NativeReminderPermission>
  /** The system's own question, which neither platform puts twice. */
  ask: () => Promise<NativeReminderPermission>
  schedule: (reminders: readonly NativeReminder[]) => Promise<boolean>
  /** Those still to come, and those already shown. */
  cancel: (ids: readonly number[]) => Promise<boolean>
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
  /**
   * Reminders the phone shows by itself: the Ear Lab's "Remind me tomorrow"
   * (src/features/ear-lab/merc/reminder.ts). Absent from a build without the
   * Ear Lab with Merc.
   */
  reminders?: NativeReminders
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

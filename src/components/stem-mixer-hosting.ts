// ============================================================
// The mixer a room hosts — what the room lends it, and what it hands back
// ============================================================
//
// The native Karaoke room draws the stem mixer's zen stage as its player.
// The mixer does not guess what it is there: the room says. It lends the
// app's one AudioContext, owns the library the transport steps through, and
// takes the few controls its own sheets and the shell need (play, pause, the
// position, whether the song has notes). Everything else — the audio engine,
// the lyrics, the sing pill, the scrubber — is the mixer's, unchanged.
//
// Only types: the room imports these without importing the mixer. They sit
// beside the mixer they describe, in the component layer, so the mixer names
// its own props without reaching up into a feature.

import type { Accessor } from 'solid-js'
import type { AudioContextLease } from '@/lib/audio-context-lease'
import type { LyricGlance } from '@/lib/lyric-glance'
import type { LyricWindowScript } from '@/lib/lyric-window-script'
import type { KaraokeStageHosting } from './KaraokeMobileStage'

/** The guide vocal as the sing pill leaves it: its level, and whether it is off. */
export interface GuideLevel {
  readonly volume: number
  readonly muted: boolean
}

/** What the mixer hands its room once it is set up. */
export interface HostedMixerControls {
  readonly playing: Accessor<boolean>
  /**
   * Paused because the system took the sound (a call, Siri, another app),
   * until the singer next plays, pauses or stops the song.
   */
  readonly interrupted: Accessor<boolean>
  readonly loading: Accessor<boolean>
  readonly loadError: Accessor<string>
  /** Seconds into the song. */
  readonly elapsed: Accessor<number>
  /**
   * Seconds into the song by the audio clock this instant. `elapsed` moves
   * with the frames, and behind another app once a second.
   */
  readonly positionNow: () => number
  /**
   * Seconds into the song as the lyrics follow it: what has reached the
   * speakers. The system's progress bar reads this one, so the two agree.
   */
  readonly audibleElapsed: Accessor<number>
  /** Goes up by one each time the position jumps: a seek, a line tapped. */
  readonly jumps: Accessor<number>
  /** Goes up by one each time the song's clock starts running while it plays. */
  readonly clockStarts: Accessor<number>
  /** How fast the song plays: 1 is as written. */
  readonly speed: Accessor<number>
  readonly duration: Accessor<number>
  /** The song has its notes (a stored analysis), so notes can be shown. */
  readonly hasNotes: Accessor<boolean>
  readonly musicLevel: Accessor<number>
  readonly play: () => void
  readonly pause: () => void
  /**
   * The room's clock is about to stop (the app leaving, the page hiding):
   * a playing song pauses with its fade. Returns the milliseconds to wait.
   */
  readonly prepareToSuspend: () => number
  /**
   * Go to a place in the song the way a tapped lyric line does: the line
   * sung there at once, back in the middle of the stage. A playing song
   * plays on from there; a paused one stays paused.
   */
  readonly seek: (seconds: number) => void
  /** Back to the shipped level: the Options sheet's "Reset to 100%". */
  readonly resetMusicLevel: () => void
  /**
   * Let the microphone go, if it is on: a parked song holds no device
   * (REQ-NRM-036). The mic chip turns it back on.
   */
  readonly releaseMic: () => void
  /** The microphone is on. */
  readonly micOn: Accessor<boolean>
  /**
   * Turn the microphone on, if it is off: the singer came back to a room
   * that let it go when they left (KaraokeRoomStage.tsx, COMING BACK).
   */
  readonly resumeMic: () => void
  /**
   * The guide vocal, so a parked song comes back with it where the singer
   * left it. The mixer starts every mount at its own level; the music level
   * needs no such help, because the mixer keeps that one itself.
   */
  readonly guide: Accessor<GuideLevel>
  readonly setGuide: (guide: GuideLevel) => void
  /**
   * The line being sung and the next, as text: what the room shows when it
   * is drawn too small for the stage (Android's picture-in-picture window).
   */
  readonly lyricGlance: Accessor<LyricGlance>
  /**
   * The whole song's lyrics worked out ahead, named `title`: what iOS's
   * lyrics window draws while the page is hidden behind another app
   * (lyric-window-script.ts). Built on each call, from the lyrics the stage
   * lights; a caller memoizes it.
   */
  readonly lyricWindowScript: (title: string) => LyricWindowScript
}

export interface StemMixerHosting {
  /**
   * The room's claim on the app's one AudioContext (REQ-NRM-033). Absent
   * where nothing lends one (no device registered), and the mixer then
   * builds its own, as it always did.
   */
  readonly audio?: AudioContextLease
  /** How the zen stage is hosted: its song line and the room's settings. */
  readonly stage: KaraokeStageHosting
  /** Receive the mixer's controls, once, when it is set up. */
  readonly attach: (controls: HostedMixerControls) => void
  /** The transport steps through the room's library. */
  readonly hasPrev: () => boolean
  readonly hasNext: () => boolean
  readonly onPrev: () => void
  readonly onNext: () => void
  /** The song reached its end by itself (not a stop). */
  readonly onEnded: () => void
  /**
   * The room keeps the song playing behind another app: "Keep playing in
   * the background", or the lyrics window.
   */
  readonly keepsPlayingHidden?: Accessor<boolean>
}

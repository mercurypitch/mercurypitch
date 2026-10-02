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
import type { KaraokeStageHosting } from './KaraokeMobileStage'
import type { KeyShiftBinding } from './key-shift/KeyShiftControl'

/** The guide vocal as the sing pill leaves it: its level, and whether it is off. */
export interface GuideLevel {
  readonly volume: number
  readonly muted: boolean
}

/** What the mixer hands its room once it is set up. */
export interface HostedMixerControls {
  readonly playing: Accessor<boolean>
  readonly loading: Accessor<boolean>
  readonly loadError: Accessor<string>
  /** Seconds into the song. */
  readonly elapsed: Accessor<number>
  readonly duration: Accessor<number>
  /** The song has its notes (a stored analysis), so notes can be shown. */
  readonly hasNotes: Accessor<boolean>
  readonly musicLevel: Accessor<number>
  readonly play: () => void
  readonly pause: () => void
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
   * The singer's key, for the room's options: the shift and the key it lands
   * on, a step either way, 0 for the song's own key, and Find my key, whose
   * wait and fit the sheet says while it holds them. The same binding the
   * phone stage's key sheet uses. The room's stage has no key button: its
   * landscape column is 236-286 px and the control needs about 324.
   */
  readonly key: KeyShiftBinding
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
}

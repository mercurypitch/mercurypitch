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
// Only types: the room imports these without importing the mixer.

import type { Accessor } from 'solid-js'
import type { KaraokeStageHosting } from '@/components/KaraokeMobileStage'
import type { StemMixerAudioLease } from './useStemMixerAudioController'

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
}

export interface StemMixerHosting {
  /** The room's claim on the app's one AudioContext (REQ-NRM-033). */
  readonly audio: StemMixerAudioLease
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

// ============================================================
// The Sing tab's demo switch — what Merc's demo borrows from the tab
// ============================================================
//
// Merc's second Sing tour ("Show me more", sing-more-tour.ts) sings through
// the Sing tab itself, the way the rooms' demos do: the tab's own transport
// plays the melody, its frame loop draws Merc's pitch where it would draw the
// microphone's, and his voice sings the same line. The demo's code loads with
// that tour; this file is the part the tab carries from its first paint, and
// it imports nothing but types and Solid:
//
// - `singDemo()` says Merc is singing, and holds his melody and his pitch at
//   a beat. While it is set, the frame loop (usePracticeController) draws his
//   pitch and leaves the mic's alone, and App scores nothing, records nothing
//   and plays no karaoke backing: a run Merc sings is no one's take.
// - `provideSingDemoHost` is how App hands the demo what it drives: the
//   transport, the play-mode controls it sets and puts back, and the reset a
//   tab change makes. The demo never imports App, the stores' barrel or the
//   mic, so its chunk stays small, and it can be tested with a fake host.

import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { MelodyItem, MelodyKind, PitchResult, PlaybackMode, SpacedRestMode, } from '@/types'

export interface SingDemo {
  /** The melody Merc sings: the singer's own, or a short one of the app's. */
  melody: readonly MelodyItem[]
  /** His pitch at a beat of the transport, as the line draws it; null is silence. */
  pitchAt: (beat: number) => PitchResult | null
}

const [demo, setDemo] = createSignal<SingDemo | null>(null)

/** Merc is singing through the Sing tab, and how; null while he is not. */
export const singDemo: Accessor<SingDemo | null> = demo

/** Starts (a demo) or ends (null) Merc singing through the tab. The demo's own. */
export const setSingDemo = (next: SingDemo | null): void => {
  setDemo(() => next)
}

/** The A-B loop, as the demo finds it and puts it back. */
export interface SingDemoLoop {
  enabled: boolean
  a: number
  b: number
}

/** What App lends the demo: the Sing tab's transport and its play-mode controls. */
export interface SingDemoHost {
  audioEngine: Pick<AudioEngine, 'getAudioContext' | 'getVolume'>
  playbackRuntime: Pick<PlaybackRuntime, 'on' | 'off' | 'getMelody' | 'getBPM'>
  /** The Sing tab is on screen, with no stage over it. */
  onSingTab: () => boolean
  isPlaying: Accessor<boolean>
  /** The singer's melody and what kind it is (a drum pattern is not sung). */
  melody: () => readonly MelodyItem[]
  melodyKind: () => MelodyKind
  /** The tonic of the singer's key, at their octave, as MIDI. */
  tonicMidi: () => number
  bpm: Accessor<number>
  playMode: Accessor<PlaybackMode>
  setPlayMode: (mode: PlaybackMode) => void
  repeatCycles: Accessor<number>
  setRepeatCycles: (cycles: number) => void
  currentRepeat: Accessor<number>
  setCurrentRepeat: (cycle: number) => void
  spacedRestMode: Accessor<SpacedRestMode>
  setSpacedRestMode: (mode: SpacedRestMode) => void
  loop: () => SingDemoLoop
  setLoop: (loop: SingDemoLoop) => void
  /** The Sing tab's Play, as its button presses it. */
  play: () => void
  /** The hard reset a tab change makes: stops the transport, clears the line. */
  reset: () => void
}

let host: SingDemoHost | null = null

/** App names what the demo drives; null in a build with no Sing tab to lend. */
export function provideSingDemoHost(next: SingDemoHost | null): void {
  host = next
}

/** What the demo drives, if App has lent it. */
export const singDemoHost = (): SingDemoHost | null => host

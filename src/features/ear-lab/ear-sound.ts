// ============================================================
// Ear Lab sound — the stage's level, and the Grid's click voice.
//
// One number for how loud the bench is, on top of the app's own
// volume: every tone the drills play carries it as a trim on the
// engine, and the Grid's clicks take it directly. The click voice
// is a matter of ears and headphones — the bright tick that makes a
// perfect onset also pierces on earbuds — so the default is the
// woodblock and the tick stays a choice.
// ============================================================

import { createClampedPreference } from '@/lib/clamped-preference'
import { midiToFreq } from '@/lib/scale-data'
import { createPersistedSignal } from '@/lib/storage'
import type { ClickVoice } from './click-synth'

const volume = createClampedPreference({
  storageKey: 'pitchperfect_ear_volume',
  defaultValue: 0.7,
  min: 0,
  max: 1,
  step: 0.05,
})

export const EAR_VOLUME = volume.spec

export const loadEarVolume = volume.load

export const persistEarVolume = volume.persist

export function formatEarVolume(value: number): string {
  return `${Math.round(value * 100)}%`
}

export const CLICK_VOICES: { id: ClickVoice; label: string; note: string }[] = [
  { id: 'wood', label: 'Wood', note: 'a woodblock — round, kind to earbuds' },
  { id: 'tick', label: 'Tick', note: 'bright and sharp' },
  { id: 'soft', label: 'Soft', note: 'low and gentle' },
]

const isClickVoice = (value: unknown): value is ClickVoice =>
  value === 'tick' || value === 'wood' || value === 'soft'

export const [earClickVoice, setEarClickVoice] =
  createPersistedSignal<ClickVoice>('pitchperfect_ear_click_voice', 'wood', {
    validator: isClickVoice,
  })

/** The engine's playTone resolves when the note is *scheduled*, not when
 *  it ends, and a new note replaces the one before it (an 80 ms
 *  release). A drill that wants two whole tones in a row therefore has
 *  to wait each one out itself — this sounds one and returns when it
 *  has finished. `chordIntervals` colours the note into a block chord
 *  the way Stack voices its stacks. */
export async function playToneFor(
  engine: {
    playTone: (
      frequency: number,
      duration?: number,
      effectType?: undefined,
      targetFreq?: undefined,
      vibratoAmplitude?: undefined,
      tremoloRate?: undefined,
      tremoloDepth?: undefined,
      trillInterval?: undefined,
      trillRate?: undefined,
      staccatoRatio?: undefined,
      chordIntervals?: number[],
    ) => Promise<void>
  },
  frequency: number,
  durationMs: number,
  chordIntervals?: number[],
): Promise<void> {
  await engine.playTone(
    frequency,
    durationMs,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    chordIntervals,
  )
  await new Promise<void>((resolve) => setTimeout(resolve, durationMs))
}

/** The engine surface a chord needs: `playTone` with its block-chord tail. */
type ToneEngine = Parameters<typeof playToneFor>[0]

/**
 * A block chord as the engine voices it: the lowest note is the voice's
 * root, the rest ride along as semitone intervals above it (the root's own
 * interval, 0, and any doubling are dropped -- the engine skips 0 anyway).
 */
export function chordVoicing(midis: readonly number[]): {
  rootMidi: number
  intervals: number[]
} {
  if (midis.length === 0) throw new Error('a chord needs at least one note')
  const rootMidi = Math.min(...midis)
  const intervals = [...new Set(midis.map((midi) => midi - rootMidi))]
    .filter((interval) => interval !== 0)
    .sort((a, b) => a - b)
  return { rootMidi, intervals }
}

/**
 * Sounds `midis` together as ONE voice. Resolves when the chord is
 * scheduled, like `playTone`, so the caller keeps its own timing.
 *
 * `Promise.all(midis.map(playTone))` looked like a chord and sounded like
 * its last note: `playTone` is monophonic -- every call releases the voice
 * before it, and three calls in one tick leave the first two silent (the
 * cadences and plants in Home, Echo, Span, Pull and the Field Book all did
 * this). The engine's block-chord path is polyphonic: one root voice plus
 * sine members sharing its envelope, the way Stack voices its stacks.
 */
export async function playChordMidis(
  engine: ToneEngine,
  midis: readonly number[],
  durationMs: number,
): Promise<void> {
  const { rootMidi, intervals } = chordVoicing(midis)
  await engine.playTone(
    midiToFreq(rootMidi),
    durationMs,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    intervals,
  )
}

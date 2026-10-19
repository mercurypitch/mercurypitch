// ============================================================
// A range this phone measured before, as the reveal draws one
// ============================================================
//
// Keep's "Find your range first" can measure a range before the first Sing
// door (onboarding-layer.ts, the range on its own), and that leaves the
// onboarding due. When the onboarding comes, its first note does not end
// on a second "Find my range": it ends on See my voice, which reveals the
// range already kept, and Find my range again, which measures a new one
// (FirstNoteView.tsx).
//
// The range is the one Keep's card shows (keep-voiceprint.ts): the newest
// this phone holds that an account made here would keep. Rebuilt from its
// two ends the way the Voice Mirror measures one (computeRange), so the
// voice type and the twin come out as they did when it was kept: every
// voiceprint names its twin by singerForRange of the same two ends.

import type { RangeResult } from '@/lib/mirror/metrics'
import { voiceTypeHint } from '@/lib/mirror/metrics'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { keepableVoiceprint } from '../shell/settings/keep-voiceprint'

/** A range from its two ends, every semitone between them counted. */
export function rangeFromEnds(lowMidi: number, highMidi: number): RangeResult {
  const qualifyingMidis: number[] = []
  for (let midi = lowMidi; midi <= highMidi; midi += 1) {
    qualifyingMidis.push(midi)
  }
  return {
    lowMidi,
    highMidi,
    lowNote: midiToNoteNameOctave(lowMidi),
    highNote: midiToNoteNameOctave(highMidi),
    semitones: highMidi - lowMidi,
    qualifyingMidis,
    voiceHint: voiceTypeHint(lowMidi, highMidi),
  }
}

/** The range this phone already keeps, or null when it keeps none. */
export function savedRange(): RangeResult | null {
  const print = keepableVoiceprint()
  return print === null ? null : rangeFromEnds(print.lowMidi, print.highMidi)
}

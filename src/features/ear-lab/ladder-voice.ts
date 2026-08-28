// ============================================================
// soundRung — a tapped rung sounds its note.
//
// Melodic dictation on a keyboard always sounds; a silent ladder made
// every tap a guess. Short, in the drill's own sine voice — the bass
// drills strum their own.
// ============================================================

import type { AudioEngine } from '@/lib/audio-engine'
import { phraseMidis } from '@/lib/ear/phrase'
import { LADDER_TIMING } from '@/lib/ear/timing'
import { midiToFreq } from '@/lib/scale-data'

export function soundRung(
  audioEngine: Pick<AudioEngine, 'playTone'>,
  rootMidi: number,
  degree: number,
): void {
  const midi = phraseMidis(rootMidi, [degree])[0]
  if (midi === undefined) return
  void audioEngine.playTone(midiToFreq(midi), LADDER_TIMING.tapMs)
}

// ============================================================
// Merc's recorded lines in Long note: his opening lines, aloud
// ============================================================
//
// Long note's opening lines (merc-lines.ts `intro`, `routine` and
// `introAny`) in Merc's voice, said as his bubble shows them (room-kit
// merc-speech.ts): as the room opens and after a take is stopped, never on
// a first visit, where the demo opens the room instead. They name no note,
// which the stage's tag and the picker show, so one take says each line
// for every note. ElevenLabs takes (eleven_v4, the "Merc V1 Gentle
// Whimsical D2" voice, 2 Nov 2026), heard back word for word, trimmed and
// levelled to -18 LUFS: placeholders until real recordings come. The
// Warm-up's line is the same words as the first opening line, and the
// same take. Each file folds out of a build without the premium exercises
// (apps/mercurypitch/vite.config.ts, PREMIUM_VOICES).

import type { SpokenLines } from '@/components/room-kit/merc-speech'
import anyEasy from './voice/merc-says-any-easy.mp3'
import anyFollow from './voice/merc-says-any-follow.mp3'
import introBreathe from './voice/merc-says-intro-breathe.mp3'
import introEasy from './voice/merc-says-intro-easy.mp3'
import introFills from './voice/merc-says-intro-fills.mp3'

/** Each opening line's recording, by the line's id. */
export const LONG_NOTE_SPOKEN: SpokenLines = {
  'intro-breathe': introBreathe,
  'intro-easy': introEasy,
  'intro-fills': introFills,
  'routine-breathe': introBreathe,
  'any-easy': anyEasy,
  'any-follow': anyFollow,
}

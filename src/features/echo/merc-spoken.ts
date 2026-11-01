// ============================================================
// Merc's recorded lines in Echo: his opening lines, aloud
// ============================================================
//
// Echo's opening lines (merc-lines.ts `intro`, `routine` and `introAny`)
// in Merc's voice, said as his bubble shows them (room-kit
// merc-speech.ts): as the room opens and after a run is stopped, never on
// a first visit, where the demo opens the room instead. ElevenLabs takes
// (eleven_v4, the "Merc V1 Gentle Whimsical D2" voice, 1 Nov 2026), heard
// back word for word, trimmed and levelled to -18 LUFS: placeholders until
// real recordings come, as his sung set beside them in voice/ is. The
// Warm-up's line is the same words as the first opening line, and the
// same take. Each file folds out of a build without the premium exercises
// (apps/mercurypitch/vite.config.ts, PREMIUM_VOICES).

import type { SpokenLines } from '@/components/room-kit/merc-speech'
import anyEasy from './voice/merc-says-any-easy.mp3'
import anyStart from './voice/merc-says-any-start.mp3'
import introFirst from './voice/merc-says-intro-first.mp3'
import introListen from './voice/merc-says-intro-listen.mp3'

/** Each opening line's recording, by the line's id. */
export const ECHO_SPOKEN: SpokenLines = {
  'intro-first': introFirst,
  'intro-listen': introListen,
  'routine-first': introFirst,
  'any-easy': anyEasy,
  'any-start': anyStart,
}

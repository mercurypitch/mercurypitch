// ============================================================
// Merc's recorded lines in Lip roll: his opening lines, aloud
// ============================================================
//
// Lip roll's opening lines (merc-lines.ts `intro`, `routine` and
// `introAny`) in Merc's voice, said as his bubble shows them (room-kit
// merc-speech.ts, through glide/useGlideRoom.ts): as the room opens and
// after a run is stopped, never on a first visit, where the demo opens the
// room instead. They name no note, which the bay names under each wave's
// crest, so one take says each line for every singer. ElevenLabs takes
// (eleven_v4, the "Merc V1 Gentle Whimsical D2" voice, 2 Nov 2026), heard
// back word for word, trimmed and levelled to -18 LUFS: placeholders until
// real recordings come. Each file folds out of a build without the premium
// exercises (apps/mercurypitch/vite.config.ts, PREMIUM_VOICES).

import type { SpokenLines } from '@/components/room-kit/merc-speech'
import anySet from './voice/merc-says-any-set.mp3'
import introFollow from './voice/merc-says-intro-follow.mp3'
import introRoll from './voice/merc-says-intro-roll.mp3'
import routineRoll from './voice/merc-says-routine-roll.mp3'

/** Each opening line's recording, by the line's id. */
export const LIP_SPOKEN: SpokenLines = {
  'intro-roll': introRoll,
  'intro-follow': introFollow,
  'routine-roll': routineRoll,
  'any-set': anySet,
}

// ============================================================
// Merc's recorded lines in First note: his opening lines, aloud
// ============================================================
//
// The room's opening lines (merc-lines.ts `intro` and `introLine`) in Merc's voice,
// said as his bubble shows them (room-kit merc-speech.ts): as the room
// opens, and after a run is stopped. ElevenLabs takes (eleven_v4, the
// "Merc V1 Gentle Whimsical D2" voice, 1 Nov 2026), heard back word for
// word, trimmed and levelled to -18 LUFS: placeholders until real
// recordings come, as his sung set is. Each file is named for its line and
// folds out of a build without the premium exercises
// (apps/mercurypitch/vite.config.ts, PREMIUM_VOICES).

import type { SpokenLines } from '@/components/room-kit/merc-speech'
import introEntry from './voice/merc-says-intro-entry.mp3'
import introStop from './voice/merc-says-intro-stop.mp3'
import lineSlide from './voice/merc-says-line-slide.mp3'

/** Each opening line's recording, by the line's id. */
export const FIRST_SPOKEN: SpokenLines = {
  'intro-stop': introStop,
  'intro-entry': introEntry,
  'line-slide': lineSlide,
}

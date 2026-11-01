// ============================================================
// Merc's recorded lines in Home note: his opening lines, aloud
// ============================================================
//
// The room's opening lines (merc-lines.ts `intro` and `introMatch`) in Merc's voice,
// said as his bubble shows them (room-kit merc-speech.ts): as the room
// opens, and after a run is stopped. ElevenLabs takes (eleven_v4, the
// "Merc V1 Gentle Whimsical D2" voice, 1 Nov 2026), heard back word for
// word, trimmed and levelled to -18 LUFS: placeholders until real
// recordings come, as his sung set is. Each file is named for its line and
// folds out of a build without the premium exercises
// (apps/mercurypitch/vite.config.ts, PREMIUM_VOICES).

import type { SpokenLines } from '@/components/room-kit/merc-speech'
import introFeels from './voice/merc-says-intro-feels.mp3'
import introKaraoke from './voice/merc-says-intro-karaoke.mp3'
import matchAfter from './voice/merc-says-match-after.mp3'

/** Each opening line's recording, by the line's id. */
export const HOME_SPOKEN: SpokenLines = {
  'intro-feels': introFeels,
  'intro-karaoke': introKaraoke,
  'match-after': matchAfter,
}

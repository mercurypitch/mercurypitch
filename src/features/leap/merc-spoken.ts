// ============================================================
// Merc's recorded lines in Leap: his opening lines, aloud
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
import introLantern from './voice/merc-says-intro-lantern.mp3'
import introLedges from './voice/merc-says-intro-ledges.mp3'
import matchBoth from './voice/merc-says-match-both.mp3'

/** Each opening line's recording, by the line's id. */
export const LEAP_SPOKEN: SpokenLines = {
  'intro-ledges': introLedges,
  'intro-lantern': introLantern,
  'match-both': matchBoth,
}

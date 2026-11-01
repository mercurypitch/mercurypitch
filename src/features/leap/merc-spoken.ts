// ============================================================
// Merc's recorded lines in Leap: what he says aloud at rest
// ============================================================
//
// The lines the room says at rest, in Merc's voice, said as his bubble
// shows them (room-kit merc-speech.ts): its opening lines (merc-lines.ts
// `intro` and `introMatch`), as the room opens and after a run is stopped, and its
// result lines, as a run ends. Never a line of the run itself.
// ElevenLabs takes (eleven_v4, the "Merc V1 Gentle Whimsical D2" voice,
// 1 Nov 2026), heard back word for word, trimmed and levelled to -18 LUFS:
// placeholders until real recordings come, as his sung set is. Each file
// is named for its line and folds out of a build without the premium
// exercises (apps/mercurypitch/vite.config.ts, PREMIUM_VOICES). The new
// best and the silent run are the same words in all three Ear rooms, and
// the same take.

import type { SpokenLines } from '@/components/room-kit/merc-speech'
import allLanded from './voice/merc-says-all-landed.mp3'
import bestNew from './voice/merc-says-best-new.mp3'
import introLantern from './voice/merc-says-intro-lantern.mp3'
import introLedges from './voice/merc-says-intro-ledges.mp3'
import matchBoth from './voice/merc-says-match-both.mp3'
import mostLanded from './voice/merc-says-most-landed.mp3'
import noneLearning from './voice/merc-says-none-learning.mp3'
import silentRun from './voice/merc-says-silent-run.mp3'
import someLanded from './voice/merc-says-some-landed.mp3'

/** Each line said at rest, by the line's id. */
export const LEAP_SPOKEN: SpokenLines = {
  'intro-ledges': introLedges,
  'intro-lantern': introLantern,
  'match-both': matchBoth,
  'all-landed': allLanded,
  'most-landed': mostLanded,
  'some-landed': someLanded,
  'none-learning': noneLearning,
  'best-new': bestNew,
  'silent-run': silentRun,
}

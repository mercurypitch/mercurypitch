// ============================================================
// Merc's recorded lines in Harmony: what he says aloud at rest
// ============================================================
//
// The lines the room says at rest, in Merc's voice, said as his bubble
// shows them (room-kit merc-speech.ts): its opening lines (merc-lines.ts
// `intro`, `introBoth`, `introTogether` and `introBothTogether`), as the
// room opens, after a run is stopped and as the way or level changes
// (shown then, not said), and its result lines, as a run ends. Never a
// line of the run itself: his calls, his cheers and the missed note's pair
// name notes he sings, and show in his bubble alone.
// ElevenLabs takes (eleven_v4, the "Merc V1 Gentle Whimsical D2" voice,
// 2 Nov 2026), heard back word for word, trimmed and levelled to -18 LUFS:
// placeholders until real recordings come, as his sung set is. Each file
// is named for its line and folds out of a build without the premium
// exercises (apps/mercurypitch/vite.config.ts, PREMIUM_VOICES). The new
// best and the silent run are the same words in every Ear room, and the
// same take.

import type { SpokenLines } from '@/components/room-kit/merc-speech'
import allHarmony from './voice/merc-says-all-harmony.mp3'
import bestNew from './voice/merc-says-best-new.mp3'
import bothFirst from './voice/merc-says-both-first.mp3'
import bothTogetherFirst from './voice/merc-says-both-together-first.mp3'
import introLamps from './voice/merc-says-intro-lamps.mp3'
import introThird from './voice/merc-says-intro-third.mp3'
import mostHarmony from './voice/merc-says-most-harmony.mp3'
import noneLearning from './voice/merc-says-none-learning.mp3'
import silentRun from './voice/merc-says-silent-run.mp3'
import someHarmony from './voice/merc-says-some-harmony.mp3'
import togetherFirst from './voice/merc-says-together-first.mp3'

/** Each line said at rest, by the line's id. */
export const HARMONY_SPOKEN: SpokenLines = {
  'intro-third': introThird,
  'intro-lamps': introLamps,
  'both-first': bothFirst,
  'together-first': togetherFirst,
  'both-together-first': bothTogetherFirst,
  'all-harmony': allHarmony,
  'most-harmony': mostHarmony,
  'some-harmony': someHarmony,
  'none-learning': noneLearning,
  'best-new': bestNew,
  'silent-run': silentRun,
}

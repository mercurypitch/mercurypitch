// ============================================================
// Merc's recorded lines in Ng slides: his opening lines, aloud
// ============================================================
//
// Ng slides' opening lines (merc-lines.ts `intro`, `routine` and
// `introAny`) in Merc's voice, said as his bubble shows them (room-kit
// merc-speech.ts, through glide/useGlideRoom.ts): as the room opens and
// after a run is stopped, never on a first visit, where the demo opens the
// room instead. They name no note, which the bridge names at the root and
// under each slide's top, so one take says each line for every singer.
// ElevenLabs takes (eleven_v4, the "Merc V1 Gentle Whimsical D2" voice,
// 2 Nov 2026), trimmed and levelled to -18 LUFS: placeholders until real
// recordings come. A speech recogniser heard every word but the hummed
// "ng", which it writes as a hum or not at all; each take keeps "Hum" and
// the hum apart. Each file folds out of a build without the premium
// exercises (apps/mercurypitch/vite.config.ts, PREMIUM_VOICES).

import type { SpokenLines } from '@/components/room-kit/merc-speech'
import anyBuild from './voice/merc-says-any-build.mp3'
import introFollow from './voice/merc-says-intro-follow.mp3'
import introSing from './voice/merc-says-intro-sing.mp3'
import routineSlide from './voice/merc-says-routine-slide.mp3'

/** Each opening line's recording, by the line's id. */
export const NG_SPOKEN: SpokenLines = {
  'intro-sing': introSing,
  'intro-follow': introFollow,
  'routine-slide': routineSlide,
  'any-build': anyBuild,
}

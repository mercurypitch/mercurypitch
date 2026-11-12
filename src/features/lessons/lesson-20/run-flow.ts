// ============================================================
// Lesson 20 run flow — the kit's rule, in Lesson 20's words
// ============================================================
//
// Sing it is Merc's run, or the smaller run, sung back a bead at a time
// (WEB-SPEC, Toys 6). What the card offers is the kit's pure rule
// (kit/ladder-flow.ts), Lesson 9's, moved into the kit with this page's
// two options: Move do's reach by voice and the faster pass. This is what
// Lesson 20 says with it: the Again buttons' names and the card's lines
// for the flow's states, LESSON.md's and the WEB-SPEC's own, Lesson 9's
// with the run in place of the ladder (FACTS 41 to 46, 57 to 63). With
// the sound off one hint serves every button that would have played.

import type { AgainNames, LadderLines, } from '@/features/lessons/kit/ladder-flow'

/** The Again buttons' names: the same run, either one, or the smaller after the full. */
export const AGAIN_NAMES: AgainNames = {
  full: 'Again: the run',
  smaller: 'Again: the smaller run',
  smallerAfterFull: 'Again, smaller run',
}

/** With the sound off, beside whichever button was pressed (WEB-SPEC, Toys 6, state 2). */
const SOUND_OFF =
  "Sound is off, so nothing played. Turn sound on to hear Merc's run, then press it again."

/** The lines the card shows for the flow's states. */
export const RUN_LINES: LadderLines = {
  voiceNone:
    'Choose a voice to sing with. If you chose one in an earlier lesson, pick it again:',
  voiceStored: 'Keep the voice you chose before, or change it:',
  voiceListen: 'Choose a voice: it picks who sings.',
  listen:
    'Good call. Merc sings the run, and nothing listens. Rest your voice.',
  nomic:
    'No microphone? Sing along anyway: Merc sings the run first, and nothing listens.',
  noAudio: "This browser can't play sound here.",
  soundOff: SOUND_OFF,
  soundOffStartAgain: SOUND_OFF,
  soundOffAgain: SOUND_OFF,
  take: "Start on do when you're ready.",
  noVoice:
    "We didn't hear you start that time. Start on do when its bead lights.",
  noVoiceLast: "We didn't hear you start that time.",
  feel: 'How did that feel?',
  gentle: 'Keep it gentle: rest before you sing again.',
  enough:
    "Thanks for saying so. That's enough singing for today: rest your voice.",
  passing: 'Sing along as each bead lights, if you like.',
  faster: "That's the run, faster.",
}

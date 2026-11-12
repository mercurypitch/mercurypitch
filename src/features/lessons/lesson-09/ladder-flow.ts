// ============================================================
// Lesson 9 ladder flow — the kit's rule, in Lesson 9's words
// ============================================================
//
// Sing it is one slow ladder, do-mi-so-do or the smaller do-mi-so-mi-do,
// sung back to Merc and read note by note (WEB-SPEC, Toys 4). What the
// card offers is the kit's pure rule (kit/ladder-flow.ts), which began as
// this page's and moved into the kit for Lesson 20's run: the comfort
// check, the voice, the sound, the ladder pressed and Move do, the takes,
// the one Again, "How did that feel?" and the Wrap's card (FACTS 77, 78
// and 83 hold its limits). This is what Lesson 9 says with it: the Again
// buttons' names and the card's lines for the flow's states, LESSON.md's
// and the WEB-SPEC's own, with the doctor lines the card prints. The
// rule's unit tests stay with this page, on its ladders and its words
// (ladder-flow.test.ts, ladder-flow-takes.test.ts,
// ladder-flow-sound-off.test.ts), as does the walk over every route a
// visit can take (ladder-flow-walk.test.ts).

import type { AgainNames } from '@/features/lessons/kit/ladder-flow'

/** The Again buttons' names: the same ladder, either one, or the smaller after the full. */
export const AGAIN_NAMES: AgainNames = {
  full: 'Again: do-mi-so-do',
  smaller: 'Again: the smaller ladder',
  smallerAfterFull: 'Again, smaller ladder',
}

/** The lines the card shows for the flow's states, LESSON.md's and the WEB-SPEC's own. */
export const LADDER_LINES = {
  voiceNone:
    'Choose a voice to sing with. If you chose one in an earlier lesson, pick it again:',
  voiceStored: 'Keep the voice you chose before, or change it:',
  voiceListen: 'Choose a voice: it picks the Merc who sings.',
  listen:
    'Good call. Merc sings the ladder, and nothing listens. Rest your voice.',
  doctor:
    "If hoarseness or discomfort lasts more than a couple of weeks, see a doctor (a GP or an ear, nose and throat specialist). If it's very painful, or breathing or swallowing is hard, get help straight away.",
  nomic:
    'No microphone? Sing along anyway: Merc sings the ladder first, and nothing listens.',
  noAudio: "This browser can't play sound here.",
  soundOff:
    "Sound is off, so nothing played. Turn sound on to hear Merc's ladder, then press Start.",
  soundOffStartAgain:
    "Sound is off, so nothing played. Turn sound on to hear Merc's ladder, then press Start again.",
  soundOffAgain:
    "Sound is off, so nothing played. Turn sound on to hear Merc's ladder, then press Again.",
  take: "Your turn: start on do when you're ready. Move on each time the next band lights up.",
  noVoice:
    "We didn't hear you start that time. Start on do when its band lights.",
  noVoiceLast: "We didn't hear you start that time.",
  feel: 'How did that feel?',
  gentle: 'Keep it gentle: rest before you sing again.',
  enough:
    "Thanks for saying so. That's enough singing for today: rest your voice.",
} as const

// ============================================================
// Lesson 5 page — "Breath and a steady note", booted in reading order
// ============================================================
//
// learn/05.html carries every word of the lesson; this module adds what the
// markup cannot: the sound, the step toys, Merc and Tavi, the recall and the
// quick check, the checkpoint that listens, the Wrap's free play and the
// season map. The renderer for Merc and Tavi loads last, as its own chunk; the
// hold reader when Step 5 is first shown; the listener only when Sing it's
// Start is pressed, so the page reads and plays before any of them arrive.
// A draft until the vocal coach signs it off (kit/drafts.ts).

import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import '@/features/lessons/kit/lesson-fonts.css'
import '@/features/lessons/kit/lesson-base.css'
import '@/features/lessons/kit/lesson-sections.css'
import '@/features/lessons/kit/lesson-stage.css'
import '@/features/lessons/kit/lesson-voice.css'
import './lesson-05.css'
import { q } from '@/features/lessons/kit/dom'
import { createExplorer } from '@/features/lessons/kit/explorer'
import { startFrameLoop } from '@/features/lessons/kit/frame-loop'
import { G_CLEF_PATH } from '@/features/lessons/kit/glyphs'
import { initMercs } from '@/features/lessons/kit/merc-duo'
import { Motion } from '@/features/lessons/kit/motion-switch'
import { createNextCard } from '@/features/lessons/kit/next-card'
import { engraveClefs, initMasthead, initMotionSwitch, initSoundSwitch, } from '@/features/lessons/kit/page-chrome'
import { createQuiz } from '@/features/lessons/kit/quiz'
import { initReveals } from '@/features/lessons/kit/reveal'
import { createStepDeck, registerToy } from '@/features/lessons/kit/step-deck'
import mercBlue from '@/features/lessons/lesson-01/assets/merc-blue.png'
import mercOrange from '@/features/lessons/lesson-01/assets/merc-orange.png'
import { initHook } from './hook'
import { initBreathPredict } from './predict-breath'
import { QUIZ_QUESTIONS } from './quiz-questions'
import { initRecall } from './recall'
import { initSing } from './sing'
import { mountBreath } from './toy-breath'
import { mountHoldDemo } from './toy-hold'
import { mountPush } from './toy-push'
import { mountStarts } from './toy-starts'
import { initWords } from './words'
import { initWrap } from './wrap'

const STILLS = { blue: mercBlue, orange: mercOrange }

// the gate's line while sound is off is the markup's (LESSON.md's); once it
// is on, the line still names the microphone
initSoundSwitch({
  on: 'Sound is on: nothing plays until you press play. We ask for the microphone only if you choose to sing.',
})
initMotionSwitch()
Motion.init()

initHook()
// the recall follows the cold open, as on Lesson 2
initRecall()
initWords()

// five steps, four toys: the breath toy shows its gauge for Step 2 and its figure for Step 3
const TOY_FOR: Readonly<Record<number, number>> = {
  1: 1,
  2: 2,
  3: 2,
  4: 3,
  5: 4,
}
const deck = createStepDeck({
  toyFor: (step) => TOY_FOR[step] ?? 1,
  after: { label: 'Sing it', selector: '#sing' },
})
const push = mountPush(q('#pushToy'), { active: deck.toyActive(1) })
const breath = mountBreath(q('#breathToy'), {
  stills: STILLS,
  active: deck.toyActive(2),
})
const starts = mountStarts(q('#startsToy'), { active: deck.toyActive(3) })
const hold = mountHoldDemo(q('#holdToy'), { active: deck.toyActive(4) })
registerToy({
  onStep: (n) => {
    if (n !== 1) push.stop()
    if (n === 2 || n === 3) breath.view(n === 2 ? 'gauge' : 'figure')
    else breath.stop()
    if (n !== 4) starts.stop()
    // the reader the demo's readouts come from loads as Step 5 comes near
    if (n >= 4) hold.prepare()
    if (n !== 5) hold.stop()
  },
})
deck.start()
initBreathPredict()

initSing(STILLS)
createQuiz({
  questions: QUIZ_QUESTIONS,
  lesson: 5,
  keys: { seed: 'fyp-l05-seed', record: 'fyp-l05-quiz-v1' },
  deck,
})
initWrap()
// the next lesson's card first: the explorer binds its link to the map
createNextCard(5)
createExplorer({ current: 5 })

engraveClefs(G_CLEF_PATH)
initMasthead(
  {
    recall: '#lesson',
    words: '#lesson',
    lesson: '#lesson',
    sing: '#sing',
    explorer: '#explorer',
  },
  { lesson: 5, deck },
)
initReveals()
startFrameLoop()
// Merc celebrates with no sparkles on this page (WEB-SPEC, Mercs)
void initMercs(q('#heroStage'), { sparkles: 'none' })

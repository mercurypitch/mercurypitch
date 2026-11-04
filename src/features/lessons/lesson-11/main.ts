// ============================================================
// Lesson 11 page — "Registers and the break", in reading order
// ============================================================
//
// learn/11.html carries every word of the lesson; this module adds what the
// markup cannot. A written lesson with no film, so there is no Watch section
// and the masthead's anchors are Lesson, Sing and Explorer. The hero is the
// cold open, in Lesson 2's order: the hook, the stage, the sound gate and the
// predict, then the recall (CURIOSITY-MOMENTS § 3.1). Merc and Tavi's
// renderer loads last, as its own chunk, so the page reads before it
// arrives. A draft until the vocal coach has signed it off (kit/drafts.ts).
//
// The switches, the cold open (cold-open.ts), the recall and the four
// words, the steps' deck with the range chart in each step's state
// (steps.ts, registers-toy.ts), Sing it (sing.ts), the quick check, the
// Wrap's practice card and free play (wrap.ts), the next lesson's card, the
// season map, the masthead and Merc and Tavi.

import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import '@/features/lessons/kit/lesson-fonts.css'
import '@/features/lessons/kit/lesson-base.css'
import '@/features/lessons/kit/lesson-sections.css'
import '@/features/lessons/kit/lesson-stage.css'
import '@/features/lessons/kit/lesson-parts.css'
// Sing it brings the kit's comfort check and voice choice, so taking the
// voice lessons' sheet here keeps it in the chunk it shares with them, and
// Lessons 3 and 5 to 10 still link it before their own sheets
import '@/features/lessons/kit/lesson-voice.css'
import './lesson-11.css'
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
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import mercBlue from '@/features/lessons/lesson-01/assets/merc-blue.png'
import mercOrange from '@/features/lessons/lesson-01/assets/merc-orange.png'
import { initColdOpen } from './cold-open'
import { QUIZ_KEYS, QUIZ_QUESTIONS } from './quiz-questions'
import { initRecall } from './recall'
import { initSing } from './sing'
import { initSteps } from './steps'
import { initWords } from './words'
import { initWrap } from './wrap'

initSoundSwitch()
initMotionSwitch()
Motion.init()

// the cold open comes first, the recall follows it, asked of everyone,
// and the four words come before the first step
initColdOpen()
initRecall()
initWords()

// five steps, one range chart
const deck = createStepDeck({
  toyFor: () => 1,
  after: { label: 'Sing it', selector: '#sing' },
})
initSteps(deck)
deck.start()

// Sing it: one slow siren, drawn as a line and read by nothing
initSing({ blue: mercBlue, orange: mercOrange })

// the quick check: answering all four marks Lesson 11 done; its step links
// move the deck
createQuiz({
  questions: QUIZ_QUESTIONS,
  lesson: 11,
  keys: QUIZ_KEYS,
  deck,
})

// the practice card Sing it picks, and free play: every state of the chart
initWrap()

// the next lesson's card first: the explorer binds its link to the map
createNextCard(11)
createExplorer({ current: 11 })

// the last screen's way back to the plan, for someone who answered its
// questions: a chunk of its own, after first paint (one that cannot load
// leaves the link hidden)
void import('@/features/lessons/kit/plan-back').then(
  ({ bootPlanBackLink }) => bootPlanBackLink(document),
  () => undefined,
)

engraveClefs(G_CLEF_PATH)
initMasthead(
  {
    recall: '#lesson',
    words: '#lesson',
    lesson: '#lesson',
    sing: '#sing',
    explorer: '#explorer',
  },
  { lesson: 11, deck },
)
initReveals()
startFrameLoop()
// Merc celebrates with no sparkles on this page (WEB-SPEC, Merc and Tavi)
void initMercs(q('#heroStage'), { sparkles: 'none' })

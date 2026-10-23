// ============================================================
// Lesson 7 page — "Slides, sirens and your range", in reading order
// ============================================================
//
// learn/07.html carries every word of the lesson; this module adds what the
// markup cannot: the sound, the range chart in all its copies (the hero's
// compact one, the steps' stage, Sing it's live chart and free play's), the
// recall check, the four words, the one gentle siren, the quick check and
// the season map. A written lesson with no film, so there is no Watch
// section and the masthead's anchors are Lesson, Sing and Explorer. The hero
// is the cold open, in Lesson 2's order: the hook, the stage, the sound gate
// and the predict, then the recall (CURIOSITY-MOMENTS § 3.1). Merc and Tavi's
// renderer loads last, as its own chunk, so the page reads and plays before
// it arrives. A draft until the owner has reviewed it (kit/drafts.ts).

import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import '@/features/lessons/kit/lesson-fonts.css'
import '@/features/lessons/kit/lesson-base.css'
import '@/features/lessons/kit/lesson-sections.css'
import '@/features/lessons/kit/lesson-stage.css'
import '@/features/lessons/kit/lesson-parts.css'
import '@/features/lessons/kit/lesson-voice.css'
import './lesson-07.css'
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
import { QUIZ_QUESTIONS, RECALL_QUESTIONS, recallStepHref, } from './quiz-questions'
import { initSing } from './sing'
import { initSteps } from './steps'
import { initWords } from './words'
import { initWrap } from './wrap'

initSoundSwitch()
initMotionSwitch()
Motion.init()

initColdOpen()

// the recall check: Lesson 3's questions 1 and 4, under Lesson 3's ids, marking no lesson done
createQuiz({
  questions: RECALL_QUESTIONS,
  keys: { seed: 'fyp-l07-recall-seed', record: 'fyp-l07-recall-v1' },
  prefix: 'recall-',
  // "Try Lesson 3, Step 1 again" opens Lesson 3's page at that step, in a new tab
  away: { href: recallStepHref },
})

initWords()

// five steps, one range chart
const deck = createStepDeck({
  toyFor: () => 1,
  after: { label: 'Sing it', selector: '#sing' },
})
initSteps(deck)
deck.start()

initSing({ blue: mercBlue, orange: mercOrange })
createQuiz({
  questions: QUIZ_QUESTIONS,
  lesson: 7,
  keys: { seed: 'fyp-l07-seed', record: 'fyp-l07-quiz-v1' },
  deck,
})

initWrap()

// the next lesson's card first: the explorer binds its link to the map
createNextCard(7)
createExplorer({ current: 7 })

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
  { lesson: 7, deck },
)
initReveals()
startFrameLoop()
// Merc celebrates with no sparkles on this page (WEB-SPEC, Merc and Tavi)
void initMercs(q('#heroStage'), { sparkles: 'none' })

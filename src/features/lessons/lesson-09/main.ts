// ============================================================
// Lesson 9 page — "Landing a leap", in reading order
// ============================================================
//
// learn/09.html carries every word of the lesson; this module adds what the
// markup cannot. A written lesson with no film, so there is no Watch section
// and the masthead's anchors are Lesson, Sing and Explorer. The hero is the
// cold open, in Lesson 2's order: the hook, the stage, the sound gate and the
// predict, then the recall (CURIOSITY-MOMENTS § 3.1). Merc and Tavi's
// renderer loads last, as its own chunk, so the page reads before it
// arrives. A draft until the vocal coach signs it off (kit/drafts.ts).
//
// The page shell: the switches, the steps' deck with its ladder chart in
// each step's state, the next lesson's card, the season map, the masthead
// and Merc and Tavi; the cold open, the four words, the recall, the steps
// and their sounds, Sing it with its take, and the quick check. Free play
// does nothing until it is wired.

import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import '@/features/lessons/kit/lesson-fonts.css'
import '@/features/lessons/kit/lesson-base.css'
import '@/features/lessons/kit/lesson-sections.css'
import '@/features/lessons/kit/lesson-stage.css'
// unused here: Lesson 6's questions bring Lesson 2's quiz modules onto this
// page, and taking this sheet too keeps it in their chunk, so Lessons 2, 4,
// 6 and 8 still link it before their own sheets and their guides keep
// their heights (MISTAKES.md, on the lessons' base stylesheet)
import '@/features/lessons/kit/lesson-guide.css'
import '@/features/lessons/kit/lesson-parts.css'
import '@/features/lessons/kit/lesson-voice.css'
import './lesson-09.css'
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
import { initColdOpen } from './cold-open'
import { QUIZ_QUESTIONS } from './quiz-questions'
import { initRecall } from './recall'
import { initSing } from './sing'
import { initSteps } from './steps'
import { initWords } from './words'

initSoundSwitch()
initMotionSwitch()
Motion.init()

initColdOpen()
initWords()

// five steps, one ladder chart
const deck = createStepDeck({
  toyFor: () => 1,
  after: { label: 'Sing it', selector: '#sing' },
})
initSteps(deck)
deck.start()

createQuiz({
  questions: QUIZ_QUESTIONS,
  lesson: 9,
  keys: { seed: 'fyp-l09-seed', record: 'fyp-l09-quiz-v1' },
  deck,
})

// Sing it: the comfort check, the voice, the ladder, Merc's ladder, the take
initSing()

// the next lesson's card first: the explorer binds its link to the map
createNextCard(9)
createExplorer({ current: 9 })

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
  { lesson: 9, deck },
)
initRecall()
initReveals()
startFrameLoop()
// Merc celebrates with no sparkles on this page (WEB-SPEC, Merc and Tavi)
void initMercs(q('#heroStage'), { sparkles: 'none' })

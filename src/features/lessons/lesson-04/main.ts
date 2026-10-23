// ============================================================
// Lesson 4 page — "The major scale and home", booted in reading order
// ============================================================
//
// learn/04.html carries every word of the lesson; this module adds what the
// markup cannot: the sound, the staircase in all its copies (the hero's,
// the cold open's, the steps' stage and free play's), the recall check
// after the cold open, the four words, the scale guide, the quick check
// and the season map. A written lesson with no film, so there is no Watch
// section and the masthead's anchors are Lesson and Explorer. Every part is
// the shared kit's, mounted per root, or this lesson's own toy built on it.
// Merc and Tavi's renderer loads last, as its own chunk, so the page reads and
// plays before it arrives.

import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import '@/features/lessons/kit/lesson-fonts.css'
import '@/features/lessons/kit/lesson-base.css'
import '@/features/lessons/kit/lesson-sections.css'
import '@/features/lessons/kit/lesson-stage.css'
import '@/features/lessons/kit/lesson-guide.css'
import '@/features/lessons/kit/lesson-parts.css'
import './lesson-04.css'
import { q } from '@/features/lessons/kit/dom'
import { createExplorer } from '@/features/lessons/kit/explorer'
import { startFrameLoop, watch } from '@/features/lessons/kit/frame-loop'
import { G_CLEF_PATH } from '@/features/lessons/kit/glyphs'
import { initMercs } from '@/features/lessons/kit/merc-duo'
import { Motion } from '@/features/lessons/kit/motion-switch'
import { createModeStore } from '@/features/lessons/kit/names'
import { createNextCard } from '@/features/lessons/kit/next-card'
import { engraveClefs, initMasthead, initMotionSwitch, initSoundSwitch, } from '@/features/lessons/kit/page-chrome'
import { createQuiz } from '@/features/lessons/kit/quiz'
import { initReveals } from '@/features/lessons/kit/reveal'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import mercBlue from '@/features/lessons/lesson-01/assets/merc-blue.png'
import mercOrange from '@/features/lessons/lesson-01/assets/merc-orange.png'
import { initColdOpen } from './cold-open'
import { initHero } from './hero'
import { drawLadderFigure } from './ladder-figure'
import { QUIZ_QUESTIONS, RECALL_QUESTIONS, recallStepHref, } from './quiz-questions'
import { bindQuizStop } from './quiz-stop'
import { initSing } from './sing'
import { mountStairsToy } from './stairs-toy'
import type { NamesMode } from './stairs-words'
import { NAMES_MODES } from './stairs-words'
import { initSteps } from './steps'
import { initWords } from './words'

initSoundSwitch()
initMotionSwitch()
Motion.init()

initHero()
// the cold open comes first, as on Lesson 2, and the recall follows it
initColdOpen()

// the recall check: Lesson 2's questions 1 and 3, under Lesson 2's ids, marking no lesson done
createQuiz({
  questions: RECALL_QUESTIONS,
  keys: { seed: 'fyp-l04-recall-seed', record: 'fyp-l04-recall-v1' },
  prefix: 'recall-',
  // "Try Lesson 2, Step 2 again" opens Lesson 2's page at Step 2, in a new tab
  away: { href: recallStepHref },
})

initWords()

// the names on the stairs: one page-wide choice, Letters on every visit
const names = createModeStore<NamesMode>(NAMES_MODES, 'letters')

// five steps, one staircase
const deck = createStepDeck({
  toyFor: () => 1,
  after: { label: 'Sing it', selector: '#sing' },
})
initSteps(deck, names)
deck.start()

initSing({ blue: mercBlue, orange: mercOrange })
const quiz = createQuiz({
  questions: QUIZ_QUESTIONS,
  lesson: 4,
  keys: { seed: 'fyp-l04-seed', record: 'fyp-l04-quiz-v1' },
  deck,
})
bindQuizStop(quiz.host)

drawLadderFigure()
// free play: every staircase control, on one stage
const freePlay = q('#freePlay')
mountStairsToy(freePlay, { active: watch(freePlay), names }).setStep('free')

// the next lesson's card first: the explorer binds its link to the map
createNextCard(4)

// the last screen's way back to the plan, for someone who answered its
// questions: a chunk of its own, after first paint (one that cannot load
// leaves the link hidden)
void import('@/features/lessons/kit/plan-back').then(
  ({ bootPlanBackLink }) => bootPlanBackLink(document),
  () => undefined,
)

createExplorer({ current: 4 })

engraveClefs(G_CLEF_PATH)
// Lesson 3's masthead: Lesson, Sing and Explorer
initMasthead(
  {
    recall: '#lesson',
    cold: '#lesson',
    words: '#lesson',
    lesson: '#lesson',
    sing: '#sing',
    explorer: '#explorer',
  },
  { lesson: 4, deck },
)
initReveals()
startFrameLoop()
void initMercs(q('#heroStage'))

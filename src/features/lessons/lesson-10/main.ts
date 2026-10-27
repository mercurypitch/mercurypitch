// ============================================================
// Lesson 10 page — "Major and minor", in reading order
// ============================================================
//
// learn/10.html carries every word of the lesson; this module adds what the
// markup cannot. A written lesson with no film, so there is no Watch section
// and the masthead's anchors are Lesson, Sing and Explorer. The hero is the
// cold open, in Lesson 2's order: the hook, the stage, the sound gate and the
// predict, then the recall (CURIOSITY-MOMENTS § 3.1). Merc and Tavi's
// renderer loads last, as its own chunk, so the page reads before it
// arrives. A draft until Lesson 6's page is live and the vocal coach has
// looked at the sung checkpoint (kit/drafts.ts).
//
// The page's names are flats, set before the cold open mounts: the hero's
// spiral is the only part that reads them, so its ring names every black
// key by its flat and each move lands on E flat or G flat (WEB-SPEC, Toys
// 2). They are never stored, and the page shows no switch for them.
//
// The switches, the cold open on the hero's spiral, the recall after it
// and the four words, the steps' deck with the chord beads in each step's
// state, the quick check, the next lesson's card, the season map, the
// masthead and Merc and Tavi. The rest does nothing until it is wired: the
// steps' controls and free play, the two games, Step 5's predict and Sing
// it.

import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import '@/features/lessons/kit/lesson-fonts.css'
import '@/features/lessons/kit/lesson-base.css'
import '@/features/lessons/kit/lesson-sections.css'
import '@/features/lessons/kit/lesson-stage.css'
// Sing it's guide, once it is wired; and Lesson 6's questions bring Lesson
// 2's quiz modules onto this page, so taking this sheet here keeps it in
// their chunk, and Lessons 2, 4, 6, 8 and 9 still link it before their own
// sheets (MISTAKES.md, on the lessons' base stylesheet)
import '@/features/lessons/kit/lesson-guide.css'
import '@/features/lessons/kit/lesson-parts.css'
// lesson-voice.css and lesson-ear-game.css come in by lesson-10.css's
// @import until the modules they share a chunk with are loaded here
// (lesson-10.css says why)
import './lesson-10.css'
import { q } from '@/features/lessons/kit/dom'
import { createExplorer } from '@/features/lessons/kit/explorer'
import { startFrameLoop } from '@/features/lessons/kit/frame-loop'
import { G_CLEF_PATH } from '@/features/lessons/kit/glyphs'
import { initMercs } from '@/features/lessons/kit/merc-duo'
import { Motion } from '@/features/lessons/kit/motion-switch'
import { Names } from '@/features/lessons/kit/names'
import { createNextCard } from '@/features/lessons/kit/next-card'
import { engraveClefs, initMasthead, initMotionSwitch, initSoundSwitch, } from '@/features/lessons/kit/page-chrome'
import { createQuiz } from '@/features/lessons/kit/quiz'
import { initReveals } from '@/features/lessons/kit/reveal'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { initColdOpen } from './cold-open'
import { bindQuizPlays } from './quiz-play'
import { QUIZ_QUESTIONS } from './quiz-questions'
import { initRecall } from './recall'
import { initSteps } from './steps'
import { initWords } from './words'

Names.set('flats')

initSoundSwitch()
initMotionSwitch()
Motion.init()

// the cold open comes first, the recall follows it, asked of everyone,
// and the four words come before the first step
initColdOpen()
initRecall()
initWords()

// five steps, one chord-beads toy
const deck = createStepDeck({
  toyFor: () => 1,
  after: { label: 'Sing it', selector: '#sing' },
})
initSteps(deck)
deck.start()

// the quick check: answering all four marks Lesson 10 done; question 2's
// chord plays from its slot
const check = createQuiz({
  questions: QUIZ_QUESTIONS,
  lesson: 10,
  keys: { seed: 'fyp-l10-seed', record: 'fyp-l10-quiz-v1' },
  deck,
})
bindQuizPlays(check.host)

// the next lesson's card first: the explorer binds its link to the map
createNextCard(10)
createExplorer({ current: 10 })

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
  { lesson: 10, deck },
)
initReveals()
startFrameLoop()
// Merc celebrates with no sparkles on this page (WEB-SPEC, Merc and Tavi)
void initMercs(q('#heroStage'), { sparkles: 'none' })

// ============================================================
// Lesson 24 page — "Harmony against a drone", in reading order
// ============================================================
//
// learn/24.html carries every word of the lesson; this module adds what the
// markup cannot. A written lesson with no film, so there is no Watch section
// and the masthead's anchors are Lesson, Sing and Explorer. The hero is the
// cold open, in Lesson 2's order: the hook, the stage, the sound gate and the
// predict, then the recall (CURIOSITY-MOMENTS § 3.1), which asks Lesson 10's
// and Lesson 23's own questions. One object carries the lesson: Lesson 5's
// band chart with a drone held under it, the drone chart. Merc and Tavi's
// renderer loads last, as its own chunk, so the page reads before it
// arrives. A voice lesson, so a draft until the lab's two tests and the
// vocal coach's sign-off (kit/drafts.ts).
//
// Season 2's page: it carries its season before anything draws
// (kit/page-state.ts `carrySeason`), so the masthead, the explorer, its
// links and the next-lesson card know Lessons 15 to 28, and the explorer
// opens on Season 2's tab. On this page a staff is always music, and it draws
// none: no section head carries the faint staff and its clef (no
// `engraveClefs`), and the body's `season-2` class drops the background's
// (WEB-SPEC, Look).

import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import '@/features/lessons/kit/lesson-fonts.css'
import '@/features/lessons/kit/lesson-base.css'
import '@/features/lessons/kit/lesson-sections.css'
import '@/features/lessons/kit/lesson-stage.css'
// the recall brings Lesson 6's quiz modules onto this page, through Lesson
// 10's questions and Lesson 23's, so taking the guide's sheet here keeps
// it in their chunk, which the other lessons link before their own sheets
// (MISTAKES.md, on the lessons' base stylesheet)
import '@/features/lessons/kit/lesson-guide.css'
import '@/features/lessons/kit/lesson-parts.css'
// Sing it brings the kit's comfort check and voice choice, so taking the
// voice lessons' sheet here keeps it in the chunk it shares with them
import '@/features/lessons/kit/lesson-voice.css'
import './lesson-24.css'
import { q } from '@/features/lessons/kit/dom'
import { createExplorer } from '@/features/lessons/kit/explorer'
import { startFrameLoop } from '@/features/lessons/kit/frame-loop'
import { initMercs } from '@/features/lessons/kit/merc-duo'
import { Motion } from '@/features/lessons/kit/motion-switch'
import { createNextCard } from '@/features/lessons/kit/next-card'
import { initMasthead, initMotionSwitch, initSoundSwitch, } from '@/features/lessons/kit/page-chrome'
import { carrySeason } from '@/features/lessons/kit/page-state'
import { initReveals } from '@/features/lessons/kit/reveal'
import { SEASON_2 } from '@/features/lessons/kit/season-2'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import mercBlue from '@/features/lessons/lesson-01/assets/merc-blue.png'
import mercOrange from '@/features/lessons/lesson-01/assets/merc-orange.png'
import { initColdOpen } from './cold-open'
import { initQuizzes } from './recall'
import { initSing } from './sing'
import { initSteps } from './steps'
import { initWords } from './words'
import { initWrap } from './wrap'

// Season 2, before anything draws
carrySeason(SEASON_2)

initSoundSwitch()
initMotionSwitch()
Motion.init()

// four steps, one drone chart, held back until the cold open's choice
const deck = createStepDeck({
  toyFor: () => 1,
  after: { label: 'Sing it', selector: '#sing' },
})
// the recall from Lessons 10 and 23 and the quick check, each on the kit's
// quiz; the quick check's question 4 plays a pure fifth, which rings
// still, so it waits for the cold open's choice
const quizzes = initQuizzes(deck)
// Sing it: do, so and mi over a drone, then so and mi for longer; "Just
// listen today"'s play, Merc's so and mi over the drone, waits for Step
// 2's choice
const sing = initSing({ blue: mercBlue, orange: mercOrange })
// the Wrap's practise card and free play, the steps' drone chart again on
// a card of its own, held back as the steps' is until the same two choices
const free = initWrap()
const steps = initSteps(deck, {
  onStep2: () => {
    sing.unlockListen()
    free.unlockStep2()
  },
})
deck.start()

// four words, each with a small figure that draws its play as it sounds;
// Pure's pure fifth rings still, so it waits for the cold open's choice
const words = initWords()

// the next lesson's card first: the explorer binds its link to the map
createNextCard(24)
createExplorer({ current: 24 })

// the last screen's way back to the plan, for someone who answered its
// questions: a chunk of its own, after first paint (one that cannot load
// leaves the link hidden)
void import('@/features/lessons/kit/plan-back').then(
  ({ bootPlanBackLink }) => bootPlanBackLink(document),
  () => undefined,
)

initMasthead(
  {
    recall: '#lesson',
    words: '#lesson',
    lesson: '#lesson',
    sing: '#sing',
    explorer: '#explorer',
  },
  { lesson: 24, deck },
)
// the cold open, in the masthead's task, so a first visit's tour waits for
// its choice; the choice opens the steps' drone chart, Step 2's predict, the
// Pure word's play, quick check 4's and free play, and the reveal shows
// Step 1's text
initColdOpen(deck, {
  onChoice: () => {
    steps.unlock()
    quizzes.unlockPure()
    words.unlockPure()
    free.unlock()
  },
  onReveal: () => {
    steps.revealStep1()
  },
})
initReveals()
startFrameLoop()
// Tavi gives a quiet "oh" as the reveal shows, with no sparkles: the reveal
// calls no choice right (WEB-SPEC, Merc and Tavi)
void initMercs(q('#heroStage'), { sparkles: 'none' })

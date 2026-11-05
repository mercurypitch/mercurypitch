// ============================================================
// Lesson 15 page — "The staff: where notes sit", Season 2's first, in reading order
// ============================================================
//
// learn/15.html carries every word of the lesson; this module adds what the
// markup cannot. A written lesson with no film, so there is no Watch section
// and the masthead's anchors are Lesson, Sing and Explorer. The hero is the
// cold open, in Lesson 2's order: the hook, the stage, the sound gate and the
// predict, then the recall (CURIOSITY-MOMENTS § 3.1). Merc and Tavi's
// renderer loads last, as its own chunk, so the page reads before it
// arrives. A draft until the vocal coach has looked at Sing it
// (kit/drafts.ts).
//
// Season 2's page: it carries its season before anything draws
// (kit/page-state.ts `carrySeason`), so the masthead, the explorer, its
// links and the next-lesson card know Lessons 15 to 28, and the explorer
// opens on Season 2's tab. On this page a staff is always music, so it
// draws no decorative one: no section head carries the faint staff and its
// clef (no `engraveClefs`), and the body's `season-2` class drops the
// background's (WEB-SPEC, Look).

import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import '@/features/lessons/kit/lesson-fonts.css'
import '@/features/lessons/kit/lesson-base.css'
import '@/features/lessons/kit/lesson-sections.css'
import '@/features/lessons/kit/lesson-stage.css'
// the recall brings Lesson 2's quiz modules onto this page, so taking this
// sheet here keeps it in their chunk, and Lessons 2, 4, 6, 8, 9, 10 and 12
// still link it before their own sheets (MISTAKES.md, on the lessons' base
// stylesheet)
import '@/features/lessons/kit/lesson-guide.css'
import '@/features/lessons/kit/lesson-parts.css'
// the voice lessons' sheet comes in by lesson-15.css's @import while this
// module loads none of the kit parts it sits beside in the other lessons'
// chunks, so those chunks keep their stylesheets in their order
import './lesson-15.css'
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
import { initColdOpen } from './cold-open'
import { initQuizzes } from './recall'
import { initSteps } from './steps'
import { initWords } from './words'

// Season 2, before anything draws
carrySeason(SEASON_2)

initSoundSwitch()
initMotionSwitch()
Motion.init()

// five steps, one staff toy
const deck = createStepDeck({
  toyFor: () => 1,
  after: { label: 'Sing it', selector: '#sing' },
})
initSteps()
deck.start()

// the recall from Lesson 2 and the quick check, each on the kit's quiz
initQuizzes(deck)
// four words, each figure a small staff
initWords()

// the next lesson's card first: the explorer binds its link to the map
createNextCard(15)
createExplorer({ current: 15 })

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
  { lesson: 15, deck },
)
// the hero's pitch line and the predict it folds into an answer; the
// welcome tour waits for its choice, so this runs after the masthead has
// started the tour, in the same task (kit/tour-gate.ts `holdTour`)
initColdOpen(deck)
initReveals()
startFrameLoop()
// Merc celebrates with no sparkles on this page (WEB-SPEC, Merc and Tavi)
void initMercs(q('#heroStage'), { sparkles: 'none' })

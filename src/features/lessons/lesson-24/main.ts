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
// the guide's and the voice lessons' sheets join with the recall and Sing
// it, the modules whose chunks they share: taken before them, each leaves
// its chunk for one of its own, which every lesson page would then link
// after its own sheet (MISTAKES.md, on the lessons' base stylesheet)
import '@/features/lessons/kit/lesson-parts.css'
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
import { initSteps } from './steps'

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
initSteps(deck)
deck.start()

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
initReveals()
startFrameLoop()
// Tavi gives a quiet "oh" as the reveal shows, with no sparkles: the reveal
// calls no choice right (WEB-SPEC, Merc and Tavi)
void initMercs(q('#heroStage'), { sparkles: 'none' })

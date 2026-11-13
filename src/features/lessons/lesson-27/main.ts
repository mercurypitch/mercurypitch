// ============================================================
// Lesson 27 page — "Seventh chords and inversions", in reading order
// ============================================================
//
// learn/27.html carries every word of the lesson; this module adds what the
// markup cannot. A written lesson with no film, so there is no Watch section
// and the masthead's anchors are Lesson, Sing and Explorer. The hero is the
// cold open, in Lesson 2's order: the hook, the stage, the sound gate and the
// predict, then the recall (CURIOSITY-MOMENTS § 3.1), which asks Lesson 12's
// and Lesson 23's own questions. One object carries the lesson: Lesson 12's
// ring of rooms, seen from above, beside the learner's staff (WEB-SPEC,
// Toys 1). Merc and Tavi's renderer loads last, as its own chunk, so the
// page reads before it arrives. A draft until Lessons 12 and 23's pages are
// live and the vocal coach has looked at its sung checkpoint and its sung
// drill (kit/drafts.ts).
//
// Season 2's page: it carries its season before anything draws
// (kit/page-state.ts `carrySeason`), so the masthead, the explorer, its
// links and the next-lesson card know Lessons 15 to 28, and the explorer
// opens on Season 2's tab. On this page a staff is always music: no section
// head carries the faint staff and its clef (no `engraveClefs`), and the
// body's `season-2` class drops the background's (WEB-SPEC, Look).

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
import './lesson-27.css'
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

// Season 2, before anything draws
carrySeason(SEASON_2)

initSoundSwitch()
initMotionSwitch()
Motion.init()

// four steps, one toy in four states: the ring of rooms beside the
// learner's staff
const deck = createStepDeck({
  toyFor: () => 1,
  after: { label: 'Sing it', selector: '#sing' },
})
deck.start()

// the next lesson's card first: the explorer binds its link to the map
createNextCard(27)
createExplorer({ current: 27 })

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
  { lesson: 27, deck },
)
initReveals()
startFrameLoop()
// Tavi celebrates at the reveal with no sparkles, as on Lesson 25's page
// (WEB-SPEC, Merc and Tavi)
void initMercs(q('#heroStage'), { sparkles: 'none' })

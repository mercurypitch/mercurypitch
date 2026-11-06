// ============================================================
// Lesson 19 page — "Threes, offbeats and syncopation", in reading order
// ============================================================
//
// learn/19.html carries every word of the lesson; this module adds what the
// markup cannot. A written lesson with no film, so there is no Watch section
// and the masthead's anchors are Lesson, Tap the beat and Explorer. The hero
// is the cold open, in Lesson 2's order: the hook, the stage, the sound gate
// and the predict, then the recall (CURIOSITY-MOMENTS § 3.1). One object
// carries the lesson: Lesson 8's pads, six in a row, the kit's rhythm bar in
// four states. Every sound goes through the beat clock and the page's one
// owner (kit/now-playing.ts); nothing listens and nothing is sung. Merc and
// Tavi's renderer loads last, as its own chunk, so the page reads before it
// arrives. A draft until Lesson 17's page is live (kit/drafts.ts).
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
import '@/features/lessons/kit/lesson-parts.css'
import './lesson-19.css'
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
import { initSteps } from './steps'

// Season 2, before anything draws
carrySeason(SEASON_2)

initSoundSwitch()
initMotionSwitch()
Motion.init()

// four steps, one rhythm bar: the toy before the deck starts, so an
// address that names a step opens it
const deck = createStepDeck({
  toyFor: () => 1,
  after: { label: 'Tap the beat', selector: '#tap' },
})
initSteps(deck)
deck.start()

// the next lesson's card first: the explorer binds its link to the map
createNextCard(19)
createExplorer({ current: 19 })

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
    tap: '#tap',
    explorer: '#explorer',
  },
  { lesson: 19, deck },
)
// the hero's six pads and the predict they answer; the welcome tour waits
// for its choice, since Step 1 states the answer, so this runs after the
// masthead has started the tour, in the same task (kit/tour-gate.ts
// `holdTour`)
initColdOpen(deck)
initReveals()
startFrameLoop()
// Merc celebrates with no sparkles, as on every page from Lesson 5 on
void initMercs(q('#heroStage'), { sparkles: 'none' })

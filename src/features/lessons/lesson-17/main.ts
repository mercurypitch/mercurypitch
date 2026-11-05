// ============================================================
// Lesson 17 page — "How long is a note?", in reading order
// ============================================================
//
// learn/17.html carries every word of the lesson; this module adds what the
// markup cannot. A written lesson with no film, so there is no Watch section
// and the masthead's anchors are Lesson, Tap it and Explorer. The hero is
// the cold open, in Lesson 2's order: the hook, the stage, the sound gate
// and the predict, then the recall (CURIOSITY-MOMENTS § 3.1). One object
// carries the lesson: Lesson 8's beat pads, written down, the kit's rhythm
// bar in five states. Every sound goes through the beat clock and the
// page's one owner (kit/now-playing.ts); nothing listens. Merc and Tavi's
// renderer loads last, as its own chunk, so the page reads before it
// arrives. A draft until the vocal coach has looked at the sung part
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
import '@/features/lessons/kit/lesson-parts.css'
// the kit's guide and voice sheets come in by lesson-17.css's @import while
// this module loads none of the kit parts they sit beside in the other
// lessons' chunks, so those chunks keep their stylesheets in their order
import './lesson-17.css'
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
import { initWords } from './words'

// Season 2, before anything draws
carrySeason(SEASON_2)

initSoundSwitch()
initMotionSwitch()
Motion.init()

// five steps, one rhythm bar: the toy registers before the deck starts, so
// an address that names a step opens its state
const deck = createStepDeck({
  toyFor: () => 1,
  after: { label: 'Tap it', selector: '#sing' },
})
initSteps()
deck.start()

// the recall from Lesson 8 and the quick check, whose step links use the
// deck: a chunk of their own, after first paint, since the kit's quiz and
// Lesson 8's play, with its beat machine and drum voices, are some 30 KB
// the hero never needs (one that cannot load leaves the two lists empty)
void import('./recall').then(
  ({ initQuizzes }) => initQuizzes(deck),
  () => undefined,
)
// four words, each figure a short rhythm written as it plays
initWords()
// Tap it: the two written bars, read from the page and tapped over the
// click; a chunk of its own, after first paint, since the take, its judge,
// the tap pad and the clap's drum voices are some 15 KB the first screen
// never needs (one that cannot load leaves the bars undrawn)
void import('./take').then(
  ({ initTake }) => initTake(q('#singCard')),
  () => undefined,
)

// the next lesson's card first: the explorer binds its link to the map
createNextCard(17)
createExplorer({ current: 17 })

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
  { lesson: 17, deck },
)
initColdOpen(deck)
initReveals()
startFrameLoop()
// Merc celebrates with no sparkles on this page (WEB-SPEC, Merc and Tavi)
void initMercs(q('#heroStage'), { sparkles: 'none' })

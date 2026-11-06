// ============================================================
// Lesson 23 page — "Perfect, major, minor and the tritone", in reading order
// ============================================================
//
// learn/23.html carries every word of the lesson; this module adds what the
// markup cannot. A written lesson with no film, so there is no Watch section
// and the masthead's anchors are Lesson, Sing and Explorer. The hero is the
// cold open, in Lesson 2's order: the hook, the stage, the sound gate and the
// predict, then the recall (CURIOSITY-MOMENTS § 3.1), which asks Lesson 6's
// own questions, as Lesson 10's page does. One object carries the lesson:
// the learner's staff and the pitch line side by side, the kit's staff toy in
// its interval state. Merc and Tavi's renderer loads last, as its own chunk,
// so the page reads before it arrives. A draft until Lesson 6's page is live
// and the vocal coach has looked at Sing it (kit/drafts.ts).
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
// the recall brings Lesson 6's quiz modules onto this page, so taking this
// sheet here keeps it in their chunk, and Lessons 2, 4, 6, 8, 9, 10, 12 and
// 15 still link it before their own sheets (MISTAKES.md, on the lessons'
// base stylesheet); the recall loads with the page for the same reason, as
// a chunk loaded after first paint would leave the sheet a chunk of its own
import '@/features/lessons/kit/lesson-guide.css'
import '@/features/lessons/kit/lesson-parts.css'
// Sing it brings the kit's comfort check and voice choice, so taking the
// voice lessons' sheet here keeps it in the chunk it shares with them
import '@/features/lessons/kit/lesson-voice.css'
import './lesson-23.css'
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
import { PitchLine } from '@/features/lessons/kit/staff'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { initColdOpen } from './cold-open'
import { initQuizzes } from './recall'
import { initSing } from './sing'
import { initSteps } from './steps'
import { initWords } from './words'

// Season 2, before anything draws
carrySeason(SEASON_2)

initSoundSwitch()
initMotionSwitch()
Motion.init()

// the semitones are what the page counts: every staff toy on it follows
// the one pitch-line switch, on before any mounts (WEB-SPEC, Toys 1)
PitchLine.set(true)

// four steps, one staff toy in its interval state, held back until the
// cold open's choice; mounted before the deck starts, so an address that
// names a step opens it
const deck = createStepDeck({
  toyFor: () => 1,
  after: { label: 'Sing it', selector: '#sing' },
})
const steps = initSteps()
deck.start()

// the recall from Lesson 6 and the quick check, each on the kit's quiz
initQuizzes(deck)

// four words, each figure a small staff in the learner's clef, written as
// it sounds
initWords()

// Sing it on the kit's flow, and then just listen, ti and fa
initSing()

// the next lesson's card first: the explorer binds its link to the map
createNextCard(23)
createExplorer({ current: 23 })

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
  { lesson: 23, deck },
)
// the hero's upright octave and the predict it answers; the choice offers
// the steps' toy what it held back, and the welcome tour waits for it,
// since the steps' stop would answer it, so this runs after the masthead
// has started the tour, in the same task (kit/tour-gate.ts `holdTour`)
initColdOpen(deck, () => steps.unlock())
initReveals()
startFrameLoop()
// Merc celebrates with no sparkles on this page (WEB-SPEC, Merc and Tavi)
void initMercs(q('#heroStage'), { sparkles: 'none' })

// ============================================================
// Lesson 18 page — "Read and sing a whole line", in reading order
// ============================================================
//
// learn/18.html carries every word of the lesson; this module adds what the
// markup cannot. A written lesson with no film, so there is no Watch section
// and the masthead's anchors are Lesson, Sing and Explorer. The hero is the
// cold open, in Lesson 2's order: the hook, the stage, the sound gate and the
// predict, then the recall (FACTS 7), which asks Lesson 16's and Lesson 17's
// own questions. One object carries the lesson: Lesson 16's staff over
// Lesson 17's beat grid, the reading staff, which a cursor crosses at tempo
// from the cold open through the four steps to Sing it and free play. Merc
// and Tavi's renderer loads last, as its own chunk, so the page reads before
// it arrives. Its Sing it reads the learner's voice in time with written
// notes, so a draft until Lessons 16 and 17 are live and the vocal coach has
// signed it off (kit/drafts.ts).
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
import '@/features/lessons/kit/lesson-voice.css'
import './lesson-18.css'
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
import { initSing } from './sing'
import { initSteps } from './steps'
import { initWords } from './words'

// Season 2, before anything draws
carrySeason(SEASON_2)

initSoundSwitch()
initMotionSwitch()
Motion.init()

// four steps on one toy: the reading staff, with each step's plays; the
// toy registers before the deck starts, so an address that names a step
// opens its state
const deck = createStepDeck({
  toyFor: () => 1,
  after: { label: 'Sing it', selector: '#sing' },
})
initSteps()
deck.start()

// the recall from Lessons 16 and 17 and the quick check, whose step links
// use the deck: a chunk of their own, after first paint, since the hero
// never needs the kit's quiz or Lessons 16's and 17's questions (one that
// cannot load leaves the two lists empty)
void import('./recall').then(
  ({ initQuizzes }) => initQuizzes(deck),
  () => undefined,
)
// four words, each figure a short line, or the count-in's pads, its mark
// written as it plays
initWords()
// Sing it: two tunes read from the page and sung in time, the take's
// reader and its pitch line loaded with the microphone at Start
initSing()

// the next lesson's card first: the explorer binds its link to the map
createNextCard(18)
createExplorer({ current: 18 })

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
  { lesson: 18, deck },
)
// the cold open's predict, in the masthead's task: its choice holds the
// first visit's tour and unlocks Step 1's toy
initColdOpen(deck)
initReveals()
startFrameLoop()
// neither celebrates at the reveal, which says what the read played and
// calls no choice right or wrong: no sparkles (WEB-SPEC, Merc and Tavi)
void initMercs(q('#heroStage'), { sparkles: 'none' })

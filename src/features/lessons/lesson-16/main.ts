// ============================================================
// Lesson 16 page — "Sing what you see", in reading order
// ============================================================
//
// learn/16.html carries every word of the lesson; this module adds what the
// markup cannot. A written lesson with no film, so there is no Watch section
// and the masthead's anchors are Lesson, Sing and Explorer. The hero is the
// cold open, in Lesson 2's order: the hook, the stage, the sound gate and the
// predict, then the recall (FACTS 5a), which asks Lesson 9's and Lesson 15's
// own questions. One object carries the lesson: Lesson 4's staircase, which
// turns into the learner's staff in Step 1 and stays a staff from then on.
// Merc and Tavi's renderer loads last, as its own chunk, so the page reads
// before it arrives. Its Sing it reads the learner's voice along written
// notes, so a draft until Lessons 9 and 15 are live and the vocal coach has
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
import './lesson-16.css'
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
import { initSing } from './sing'
import { initSteps, TOYS } from './steps'
import { initWords } from './words'

// Season 2, before anything draws
carrySeason(SEASON_2)

initSoundSwitch()
initMotionSwitch()
Motion.init()

// five steps on two toys: the staircase turning into the staff, then the
// staff toy with each step's plays, mounted before the deck starts so an
// address that names a step opens it
const deck = createStepDeck({
  toyFor: (step) => TOYS[step] ?? 1,
  after: { label: 'Sing it', selector: '#sing' },
})
initSteps(deck)
deck.start()

// the recall from Lessons 9 and 15 and the quick check, each on the kit's
// quiz, and the three words, each a small staff in the learner's clef
initQuizzes(deck)
initWords()
// Sing it: two phrases from the page, each found from do, the microphone
// asked for only by Start, the take's reader loaded with it
initSing()

// the next lesson's card first: the explorer binds its link to the map
createNextCard(16)
createExplorer({ current: 16 })

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
  { lesson: 16, deck },
)
// the cold open, in the masthead's task, so a first visit's tour waits for
// its choice
initColdOpen(deck)
initReveals()
startFrameLoop()
// Tavi gives a quiet "oh" as the reveal shows, with no sparkles: the reveal
// calls no choice right (WEB-SPEC, Merc and Tavi)
void initMercs(q('#heroStage'), { sparkles: 'none' })

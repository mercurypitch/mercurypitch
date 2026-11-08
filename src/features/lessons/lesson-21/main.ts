// ============================================================
// Lesson 21 page — "Keys and the circle of fifths", in reading order
// ============================================================
//
// learn/21.html carries every word of the lesson; this module adds what the
// markup cannot. A written lesson with no film, so there is no Watch section
// and the masthead's anchors are Lesson, Sing and Explorer. The hero is the
// cold open, in Lesson 2's order: the hook, the stage, the sound gate and the
// predict, then the recall (FACTS 5a), which asks Lesson 6's and Lesson 15's
// own questions. One object carries the lesson: Lesson 2's ring of twelve
// beads, which the steps thread by fifths into the circle of fifths. Merc
// and Tavi's renderer loads last, as its own chunk, so the page reads before
// it arrives. A theory lesson with an unscored sing-along, so a draft until
// Lessons 6 and 15 are live and the vocal coach has looked at Sing it
// (kit/drafts.ts).
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
// the recall brings Lesson 6's quiz modules onto this page, through Lesson
// 15's questions, so taking the guide's sheet here keeps it in their chunk,
// which the other lessons link before their own sheets (MISTAKES.md, on the
// lessons' base stylesheet)
import '@/features/lessons/kit/lesson-guide.css'
import '@/features/lessons/kit/lesson-parts.css'
// Sing it brings the kit's comfort check and voice choice, so taking the
// voice lessons' sheet here keeps it in the chunk it shares with them
import '@/features/lessons/kit/lesson-voice.css'
import './lesson-21.css'
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

// five steps on four toys (steps.ts), mounted before the deck starts, so
// an address that names a step opens it
const deck = createStepDeck({
  toyFor: (step) => TOYS[step] ?? 1,
  after: { label: 'Sing it', selector: '#sing' },
})
initSteps(deck)
// the recall from Lessons 6 and 15 and the quick check, each on the kit's
// quiz; the recall's Play the three notes is Lesson 15's own
initQuizzes(deck)
deck.start()

// four words, each figure lit as its sound plays: a small ring, a staff in
// the learner's clef, four keys round a small circle and thirteen tiles
initWords()

// Sing it on the kit's flow: so, la, ti and do in C and then in G, the
// staff turning to G between the two runs
initSing()

// the next lesson's card first: the explorer binds its link to the map
createNextCard(21)
createExplorer({ current: 21 })

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
  { lesson: 21, deck },
)
// the cold open, in the masthead's task, so a first visit's tour waits for
// its choice
initColdOpen(deck)
initReveals()
startFrameLoop()
// Tavi gives a quiet "oh" as the reveal shows, with no sparkles: the reveal
// calls no choice right (WEB-SPEC, Merc and Tavi)
void initMercs(q('#heroStage'), { sparkles: 'none' })

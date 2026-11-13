// ============================================================
// Lesson 26 page — "A second voice", in reading order
// ============================================================
//
// learn/26.html carries every word of the lesson; this module adds what the
// markup cannot. A written lesson with no film, so there is no Watch section
// and the masthead's anchors are Lesson, Sing and Explorer. The hero is the
// cold open, in Lesson 2's order: the hook, the stage, the sound gate and the
// predict, then the recall (CURIOSITY-MOMENTS § 3.1), which asks Lesson 12's
// and Lesson 24's own questions. One object carries the lesson: Lesson 6's
// tune line, "Twinkle" as beads on semitone rows, with a second part drawn
// beside it a third away (WEB-SPEC, Look). Merc and Tavi's renderer loads
// last, as its own chunk, so the page reads before it arrives. A draft until
// Lessons 12 and 24's pages are live, the lab test has passed and the vocal
// coach has signed off its voice lines and its checkpoint (kit/drafts.ts).
//
// Season 2's page: it carries its season before anything draws
// (kit/page-state.ts `carrySeason`), so the masthead, the explorer, its
// links and the next-lesson card know Lessons 15 to 28, and the explorer
// opens on Season 2's tab. This page draws no staff: no section head
// carries the faint staff and its clef (no `engraveClefs`), and the body's
// `season-2` class drops the background's (WEB-SPEC, Look).

import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import '@/features/lessons/kit/lesson-fonts.css'
import '@/features/lessons/kit/lesson-base.css'
import '@/features/lessons/kit/lesson-sections.css'
import '@/features/lessons/kit/lesson-stage.css'
import '@/features/lessons/kit/lesson-parts.css'
// the Wrap's rest line brings the kit's comfort check, and Sing it its
// voice choice, so taking the voice lessons' sheet here keeps it in the
// chunk it shares with them: a sheet left out leaves that chunk for one of
// its own, which every lesson page would then link after its own sheet
// (MISTAKES.md, on the lessons' base stylesheet)
import '@/features/lessons/kit/lesson-voice.css'
import './lesson-26.css'
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
import { initWrap } from './wrap'

// Season 2, before anything draws
carrySeason(SEASON_2)

initSoundSwitch()
initMotionSwitch()
Motion.init()

// four steps, one toy in four states: Lesson 6's tune line with a part a
// third from the tune
const deck = createStepDeck({
  toyFor: () => 1,
  after: { label: 'Sing it', selector: '#sing' },
})
// free play first, so the steps' choice and the cold open's reach it
const wrap = initWrap()
const steps = initSteps(deck)
deck.start()

// the recall from Lessons 12 and 24 and the quick check, each on the kit's
// quiz: question 2's answers and question 4's Play wait for the cold
// open's choice
const quizzes = initQuizzes(deck)

// three words, each a small figure of beads that draws its play as it
// sounds
initWords()

// the next lesson's card first: the explorer binds its link to the map
createNextCard(26)
createExplorer({ current: 26 })

// Sing it: a chunk of its own, after first paint, since its figure brings
// the band chart and its run the beat clock (sing.ts); the take, its reader
// and the quiet check load with the microphone at Start
void import('./sing').then(
  ({ initSing }) => {
    initSing()
  },
  () => undefined,
)

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
  { lesson: 26, deck },
)
// the cold open after the masthead, in the same task, so a first visit's
// tour waits for its choice (kit/tour-gate.ts)
initColdOpen(deck, {
  onChoice: () => {
    steps.unlock()
    wrap.free.unlock()
    quizzes.unlock()
  },
  onReveal: () => steps.reveal(),
})
initReveals()
startFrameLoop()
// Tavi gives a quiet "oh" at the reveal with no sparkles (WEB-SPEC, Merc
// and Tavi)
void initMercs(q('#heroStage'), { sparkles: 'none' })

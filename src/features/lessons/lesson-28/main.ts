// ============================================================
// Lesson 28 page — "Cadences, form and a song in two parts", in reading order
// ============================================================
//
// learn/28.html carries every word of the lesson; this module adds what the
// markup cannot. A written lesson with no film, so there is no Watch section
// and the masthead's anchors are Lesson, Sing and Explorer. The hero is the
// cold open, in Lesson 2's order: the hook, the stage, the sound gate and the
// predict, then the recall (CURIOSITY-MOMENTS § 3.1), which asks Lesson 18's
// and Lesson 26's own questions. One object carries the lesson: the song in
// two parts, a strip of ten bars in the hero and the song on two staffs in
// the steps, Tavi's part in the treble clef over Merc's in the bass (WEB-SPEC,
// Look). Merc and Tavi's renderer loads last, as its own chunk, so the page
// reads before it arrives. Season 2's last lesson: its next-lesson card is
// the season's close. A draft until Lessons 18 and 26's pages are live, the
// lab test has passed and the vocal coach has signed off its breath marks,
// its voice lines and its checkpoint (kit/drafts.ts).
//
// Season 2's page: it carries its season before anything draws
// (kit/page-state.ts `carrySeason`), so the masthead, the explorer, its
// links and the season's close know Lessons 15 to 28, and the explorer opens
// on Season 2's tab. No staff for show: no section head carries the faint
// staff and its clef (no `engraveClefs`), and the body's `season-2` class
// drops the background's (WEB-SPEC, Look).

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
import './lesson-28.css'
import { VisitEnding } from '@/features/lessons/kit/comfort'
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

// four steps, one toy in four states: the song on two staffs
const deck = createStepDeck({
  toyFor: () => 1,
  after: { label: 'Sing it', selector: '#sing' },
})
// free play first, so the steps' choice and the cold open's reach it
// the cold open's choice, which Sing it waits for: its chunk may load after it
let chose: () => void = () => undefined
const chosen = new Promise<void>((resolve) => {
  chose = resolve
})

const wrap = initWrap()
const steps = initSteps(deck)
deck.start()

// the recall from Lessons 18 and 26 and the quick check, each on the kit's
// quiz: question 4's answers and Play wait for the cold open's choice
const quizzes = initQuizzes(deck)

// three words: Cadence's small strip of bars 3 and 4, Section's still and
// Form's four blocks
initWords()

// the season's close first, where other pages name the next lesson: the
// explorer binds its link to the map. It follows Sing it's ending: after a
// rest it keeps its answer and the map alone (WEB-SPEC, Toys 7)
createNextCard(28, VisitEnding)
createExplorer({ current: 28 })

// Sing it: a chunk of its own, after first paint, since its staffs bring
// the score's drawing and its run the beat clock and the recorder (sing.ts);
// the take, its reader, the quiet check and the recording's onset load with
// the microphone at Start
void import('./sing').then(
  ({ initSing }) => {
    initSing({ chosen })
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
  { lesson: 28, deck },
)
// the cold open after the masthead, in the same task, so a first visit's
// tour waits for its choice (kit/tour-gate.ts)
initColdOpen(deck, {
  onChoice: () => {
    steps.unlock()
    wrap.free.unlock()
    quizzes.unlock()
    chose()
  },
  onReveal: () => steps.reveal(),
})
initReveals()
startFrameLoop()
// Tavi gives a quiet "oh" at the reveal with no sparkles (WEB-SPEC, Merc
// and Tavi)
void initMercs(q('#heroStage'), { sparkles: 'none' })

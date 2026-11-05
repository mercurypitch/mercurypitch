// ============================================================
// Lesson 14 page — "Phrasing: sing a whole song", in reading order
// ============================================================
//
// learn/14.html carries every word of the lesson; this module adds what the
// markup cannot. A written lesson with no film, so there is no Watch section
// and the masthead's anchors are Lesson, Sing and Explorer. The hero is the
// cold open, in Lesson 2's order: the hook, the stage, the sound gate and the
// predict, then the recall (CURIOSITY-MOMENTS § 3.1). Merc and Tavi's
// renderer loads last, as its own chunk, so the page reads before it
// arrives. A draft until the vocal coach signs it off (kit/drafts.ts).
//
// One object carries the lesson: the song line, the kit's band chart on a
// notes axis with each of Merc's notes a band over its own time, its words
// under it, its breath marks over it and its loudness drawn as light, never
// height (song-line.ts). It is the last lesson of Season 1, so its closing
// card is the season's close.
//
// In reading order: the switches, the cold open on the hero's song line,
// the four words, the steps' deck with the song line in each step's state,
// Sing it on the song line's live state, the quick check, the Wrap's
// practise card and the season's close with the song line's still, the
// season map, the masthead, the recall, and Merc and Tavi.

import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import '@/features/lessons/kit/lesson-fonts.css'
import '@/features/lessons/kit/lesson-base.css'
import '@/features/lessons/kit/lesson-sections.css'
import '@/features/lessons/kit/lesson-stage.css'
import '@/features/lessons/kit/lesson-parts.css'
// in the chunk of the kit's comfort check and voice choice, which the Wrap
// and the steps load, so every voice lesson links it where it did
import '@/features/lessons/kit/lesson-voice.css'
import './lesson-14.css'
import { q } from '@/features/lessons/kit/dom'
import { createExplorer } from '@/features/lessons/kit/explorer'
import { startFrameLoop } from '@/features/lessons/kit/frame-loop'
import { G_CLEF_PATH } from '@/features/lessons/kit/glyphs'
import { initMercs } from '@/features/lessons/kit/merc-duo'
import { Motion } from '@/features/lessons/kit/motion-switch'
import { engraveClefs, initMasthead, initMotionSwitch, initSoundSwitch, } from '@/features/lessons/kit/page-chrome'
import { createQuiz } from '@/features/lessons/kit/quiz'
import { initReveals } from '@/features/lessons/kit/reveal'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { initColdOpen } from './cold-open'
import { QUIZ_KEYS, QUIZ_QUESTIONS } from './quiz-questions'
import { initRecall } from './recall'
import { initSing } from './sing'
import { initSteps } from './steps'
import { initWords } from './words'
import { initWrap } from './wrap'

// the gate's line while sound is off is the markup's (LESSON.md's); once it
// is on, the line still names the microphone
initSoundSwitch({
  on: 'Sound is on: nothing plays until you press play. We ask for the microphone only if you choose to sing.',
})
initMotionSwitch()
Motion.init()

initColdOpen()
initWords()

// five steps, one song line
const deck = createStepDeck({
  toyFor: () => 1,
  after: { label: 'Sing it', selector: '#sing' },
})
initSteps(deck)
deck.start()

initSing()
createQuiz({ questions: QUIZ_QUESTIONS, lesson: 14, keys: QUIZ_KEYS, deck })

// the Wrap's practise card and the season's close first: the explorer
// binds the close's map link
initWrap()
createExplorer({ current: 14 })

// the last screen's way back to the plan, for someone who answered its
// questions: a chunk of its own, after first paint (one that cannot load
// leaves the link hidden)
void import('@/features/lessons/kit/plan-back').then(
  ({ bootPlanBackLink }) => bootPlanBackLink(document),
  () => undefined,
)

engraveClefs(G_CLEF_PATH)
initMasthead(
  {
    recall: '#lesson',
    words: '#lesson',
    lesson: '#lesson',
    sing: '#sing',
    explorer: '#explorer',
  },
  { lesson: 14, deck },
)
initRecall()
initReveals()
startFrameLoop()
// Merc celebrates with no sparkles on this page (WEB-SPEC, Merc and Tavi)
void initMercs(q('#heroStage'), { sparkles: 'none' })

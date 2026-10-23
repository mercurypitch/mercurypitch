// ============================================================
// Lesson 8 page — "Beat, tempo and the backbeat", in reading order
// ============================================================
//
// learn/08.html carries every word of the lesson; this module adds what the
// markup cannot: the sound, the beat machine in all its copies (the hero's
// compact strip, the steps' stage, Sing it's guide and take strip, and free
// play's), the recall check, the four words, Count the bar, the tap take,
// the sing-along guide, the quick check and the season map. A written
// lesson with no film, so there is no Watch section and the masthead's
// anchors are Lesson, Sing and Explorer. The hero is the cold open, in
// Lesson 2's order: the hook, the stage, the sound gate and the predict,
// then the recall (CURIOSITY-MOMENTS § 3.1). The recall runs once the
// masthead has settled the page's state, which takes it out where Lesson 6
// is not live. Every sound goes through the beat clock and the page's one
// owner (kit/now-playing.ts); nothing listens. Merc and Tavi's renderer loads
// last, as its own chunk, so the page reads and plays before it arrives. A
// draft until the vocal coach signs off its sung line (kit/drafts.ts).

import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import '@/features/lessons/kit/lesson-fonts.css'
import '@/features/lessons/kit/lesson-base.css'
import '@/features/lessons/kit/lesson-sections.css'
import '@/features/lessons/kit/lesson-stage.css'
import '@/features/lessons/kit/lesson-guide.css'
import '@/features/lessons/kit/lesson-parts.css'
import '@/features/lessons/kit/lesson-voice.css'
import '@/features/lessons/kit/lesson-ear-game.css'
import '@/features/lessons/kit/lesson-beat-machine.css'
import './lesson-08.css'
import { q } from '@/features/lessons/kit/dom'
import { createExplorer } from '@/features/lessons/kit/explorer'
import { startFrameLoop } from '@/features/lessons/kit/frame-loop'
import { G_CLEF_PATH } from '@/features/lessons/kit/glyphs'
import { initMercs } from '@/features/lessons/kit/merc-duo'
import { Motion } from '@/features/lessons/kit/motion-switch'
import { createNextCard } from '@/features/lessons/kit/next-card'
import { engraveClefs, initMasthead, initMotionSwitch, initSoundSwitch, } from '@/features/lessons/kit/page-chrome'
import { createQuiz } from '@/features/lessons/kit/quiz'
import { initReveals } from '@/features/lessons/kit/reveal'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import mercBlue from '@/features/lessons/lesson-01/assets/merc-blue.png'
import mercOrange from '@/features/lessons/lesson-01/assets/merc-orange.png'
import { initColdOpen } from './cold-open'
import { bindQuizPlays } from './quiz-play'
import { QUIZ_QUESTIONS } from './quiz-questions'
import { initRecall } from './recall'
import { initSing } from './sing'
import { initSteps } from './steps'
import { initWords } from './words'
import { initWrap } from './wrap'

initSoundSwitch()
initMotionSwitch()
Motion.init()

initColdOpen()
initWords()

// five steps, one beat machine
const deck = createStepDeck({
  toyFor: () => 1,
  after: { label: 'Sing it', selector: '#sing' },
})
initSteps(deck)
deck.start()

initSing({ blue: mercBlue, orange: mercOrange })
const quiz = createQuiz({
  questions: QUIZ_QUESTIONS,
  lesson: 8,
  keys: { seed: 'fyp-l08-seed', record: 'fyp-l08-quiz-v1' },
  deck,
})
bindQuizPlays(quiz.host)

initWrap()

// the next lesson's card first: the explorer binds its link to the map
createNextCard(8)
createExplorer({ current: 8 })

engraveClefs(G_CLEF_PATH)
initMasthead(
  {
    recall: '#lesson',
    words: '#lesson',
    lesson: '#lesson',
    sing: '#sing',
    explorer: '#explorer',
  },
  { lesson: 8, deck },
)
// after the masthead: where Lesson 6 is not live, the page state has taken the recall out
initRecall()
initReveals()
startFrameLoop()
// Merc celebrates with no sparkles on this page (WEB-SPEC, Mercs)
void initMercs(q('#heroStage'), { sparkles: 'none' })

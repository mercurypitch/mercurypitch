// ============================================================
// Lesson 6 page — "Intervals: the distance between notes", in reading order
// ============================================================
//
// learn/06.html carries every word of the lesson; this module adds what the
// markup cannot: the sound, the tune line in all its copies (the hero's
// compact one, the steps' stage and free play's), the recall check, the
// four words, the two ear games, the anchor board, the sing-along guide,
// the quick check and the season map. A written lesson with no film, so
// there is no Watch section and the masthead's anchors are Lesson, Sing and
// Explorer. The hero is the cold open, in Lesson 2's order: the hook, the
// stage, the sound gate and the predict, then the recall
// (CURIOSITY-MOMENTS § 3.1). Merc and Tavi's renderer loads last, as its own
// chunk, so the page reads and plays before it arrives. A draft until the
// owner has reviewed it (kit/drafts.ts).

import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import '@/features/lessons/kit/lesson-fonts.css'
import '@/features/lessons/kit/lesson-base.css'
import '@/features/lessons/kit/lesson-sections.css'
import '@/features/lessons/kit/lesson-stage.css'
import '@/features/lessons/kit/lesson-guide.css'
import '@/features/lessons/kit/lesson-parts.css'
import '@/features/lessons/kit/lesson-voice.css'
import '@/features/lessons/kit/lesson-tune-line.css'
import '@/features/lessons/kit/lesson-ear-game.css'
import './lesson-06.css'
import { q } from '@/features/lessons/kit/dom'
import { createExplorer } from '@/features/lessons/kit/explorer'
import { startFrameLoop } from '@/features/lessons/kit/frame-loop'
import { G_CLEF_PATH } from '@/features/lessons/kit/glyphs'
import { initMercs } from '@/features/lessons/kit/merc-duo'
import { Motion } from '@/features/lessons/kit/motion-switch'
import { createModeStore } from '@/features/lessons/kit/names'
import { createNextCard } from '@/features/lessons/kit/next-card'
import { engraveClefs, initMasthead, initMotionSwitch, initSoundSwitch, } from '@/features/lessons/kit/page-chrome'
import { createQuiz } from '@/features/lessons/kit/quiz'
import { initReveals } from '@/features/lessons/kit/reveal'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import mercBlue from '@/features/lessons/lesson-01/assets/merc-blue.png'
import mercOrange from '@/features/lessons/lesson-01/assets/merc-orange.png'
import { initColdOpen } from './cold-open'
import { bindQuizPlays } from './quiz-play'
import { QUIZ_QUESTIONS, RECALL_AWAY, RECALL_QUESTIONS } from './quiz-questions'
import { initSing } from './sing'
import { initSteps } from './steps'
import type { NamesMode } from './tune-words'
import { NAMES_MODES } from './tune-words'
import { initWords } from './words'
import { initWrap } from './wrap'

initSoundSwitch()
initMotionSwitch()
Motion.init()

initColdOpen()

// the recall check: Lesson 4's questions 1 and 4, under Lesson 4's ids, marking no lesson done
createQuiz({
  questions: RECALL_QUESTIONS,
  keys: { seed: 'fyp-l06-recall-seed', record: 'fyp-l06-recall-v1' },
  prefix: 'recall-',
  // "Try Lesson 4, Step 1 again" opens Lesson 4's page at Step 1, in a new tab
  away: RECALL_AWAY,
})

initWords()

// the names under the beads: one page-wide choice, Letters on every visit
const names = createModeStore<NamesMode>(NAMES_MODES, 'letters')

// five steps, one tune line
const deck = createStepDeck({
  toyFor: () => 1,
  after: { label: 'Sing it', selector: '#sing' },
})
initSteps(deck, names)
deck.start()

initSing({ blue: mercBlue, orange: mercOrange })
const quiz = createQuiz({
  questions: QUIZ_QUESTIONS,
  lesson: 6,
  keys: { seed: 'fyp-l06-seed', record: 'fyp-l06-quiz-v1' },
  deck,
})
bindQuizPlays(quiz.host)

initWrap(names)

// the next lesson's card first: the explorer binds its link to the map
createNextCard(6)
createExplorer({ current: 6 })

engraveClefs(G_CLEF_PATH)
initMasthead(
  {
    recall: '#lesson',
    words: '#lesson',
    lesson: '#lesson',
    sing: '#sing',
    explorer: '#explorer',
  },
  { lesson: 6, deck },
)
initReveals()
startFrameLoop()
// Merc celebrates with no sparkles on this page (WEB-SPEC, Mercs)
void initMercs(q('#heroStage'), { sparkles: 'none' })

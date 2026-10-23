// ============================================================
// Lesson 2 page — "Twelve notes", booted in reading order
// ============================================================
//
// learn/02.html carries every word of the lesson; this module adds what the
// markup cannot: the sound, the cold open on the hero spiral, the recall
// check, the step toys, the slide guide, the quiz, free play, the episode
// and the season map. Every part is the shared kit's, mounted per root, or
// this lesson's own toy built on it. Merc and Tavi's renderer loads last, as
// its own chunk, so the page reads and plays before it arrives.

import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import '@/features/lessons/kit/lesson-fonts.css'
import '@/features/lessons/kit/lesson-base.css'
import '@/features/lessons/kit/lesson-sections.css'
import '@/features/lessons/kit/lesson-stage.css'
import '@/features/lessons/kit/lesson-guide.css'
import './lesson-02.css'
import { q } from '@/features/lessons/kit/dom'
import { createEpisode } from '@/features/lessons/kit/episode'
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
import posterLesson1 from '@/features/lessons/lesson-01/assets/poster.jpg'
import { QUIZ_QUESTIONS as LESSON_1_QUESTIONS } from '@/features/lessons/lesson-01/quiz-questions'
import vttUrl from './assets/lesson-02.en.vtt?url'
import poster from './assets/poster.jpg'
import { initColdOpen } from './cold-open'
import { initEntrance } from './entrance'
import { FILM_CAPTIONS_TEXT, FILM_CHAPTERS, FILM_SOURCES } from './film'
import { initFreePlay } from './free-play'
import { bindQuizPair } from './quiz-pair'
import { QUIZ_QUESTIONS } from './quiz-questions'
import { initSing } from './sing'
import { initSteps } from './steps'
import { initWords } from './words'

initSoundSwitch()
initMotionSwitch()
Motion.init()

initColdOpen()

// the recall check: Lesson 1's questions 2 and 4, under Lesson 1's ids, marking no lesson done
createQuiz({
  questions: LESSON_1_QUESTIONS.filter(
    (question) => question.id === 'l01-q2' || question.id === 'l01-q4',
  ),
  keys: { seed: 'fyp-l02-recall-seed', record: 'fyp-l02-recall-v1' },
  prefix: 'recall-',
})

initWords()

// six steps, five toys: steps 1 and 2 share the spiral
const deck = createStepDeck({
  toyFor: (step) => (step === 2 ? 1 : step),
  after: { label: 'Sing it', selector: '#sing' },
})
initSteps(deck)
deck.start()

initSing({ blue: mercBlue, orange: mercOrange })
const quiz = createQuiz({
  questions: QUIZ_QUESTIONS,
  lesson: 2,
  keys: { seed: 'fyp-l02-seed', record: 'fyp-l02-quiz-v1' },
  deck,
})
bindQuizPair(quiz.host)
initFreePlay()

// the next lesson's card first: the explorer binds its link to the map
createNextCard(2)
const explorer = createExplorer({
  current: 2,
  posters: { 1: posterLesson1, 2: poster },
})
createEpisode({
  film: FILM_SOURCES,
  captions: vttUrl,
  vtt: FILM_CAPTIONS_TEXT,
  chapters: FILM_CHAPTERS,
  onDuration: (len) => explorer.setLength(2, len),
})

engraveClefs(G_CLEF_PATH)
initMasthead(
  {
    recall: '#lesson',
    words: '#lesson',
    lesson: '#lesson',
    sing: '#lesson',
    check: '#lesson',
    wrap: '#lesson',
    watch: '#watch',
    explorer: '#explorer',
  },
  { lesson: 2, deck },
)
initEntrance()
initReveals()
startFrameLoop()
void initMercs(q('#heroStage'))

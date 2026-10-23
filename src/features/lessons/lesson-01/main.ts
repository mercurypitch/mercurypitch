// ============================================================
// Lesson 1 page — "What is a note?", booted in reading order
// ============================================================
//
// learn/01.html carries every word of the lesson; this module adds what the
// markup cannot: the sound, the figure toys, Merc and Tavi, the quiz, the
// episode and the season map. The renderer for Merc and Tavi loads last, as its
// own chunk, so the page reads and plays before it arrives.

import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import '@/features/lessons/kit/lesson-fonts.css'
import '@/features/lessons/kit/lesson-base.css'
import '@/features/lessons/kit/lesson-sections.css'
import '@/features/lessons/kit/lesson-stage.css'
import './lesson-01.css'
import { mountDial } from '@/features/lessons/kit/dial'
import { q } from '@/features/lessons/kit/dom'
import { createEpisode } from '@/features/lessons/kit/episode'
import { createExplorer } from '@/features/lessons/kit/explorer'
import { startFrameLoop } from '@/features/lessons/kit/frame-loop'
import { G_CLEF_PATH } from '@/features/lessons/kit/glyphs'
import { mountLoud } from '@/features/lessons/kit/loud'
import { initMercs } from '@/features/lessons/kit/merc-duo'
import { Motion } from '@/features/lessons/kit/motion-switch'
import { createNextCard } from '@/features/lessons/kit/next-card'
import { engraveClefs, initMasthead, initMotionSwitch, initSoundSwitch, } from '@/features/lessons/kit/page-chrome'
import { createQuiz } from '@/features/lessons/kit/quiz'
import { initReveals } from '@/features/lessons/kit/reveal'
import { createStepDeck, registerToy } from '@/features/lessons/kit/step-deck'
import vttUrl from './assets/lesson-01.en.vtt?url'
import mercBlue from './assets/merc-blue.png'
import mercOrange from './assets/merc-orange.png'
import poster from './assets/poster.jpg'
import { initEntrance } from './entrance'
import { FILM_CAPTIONS_TEXT, FILM_CHAPTERS, FILM_SOURCES } from './film'
import { initHero } from './hero'
import { initPredict } from './predict'
import { QUIZ_QUESTIONS } from './quiz-questions'
import { initSing } from './sing'
import { initOctaveToy } from './toy-octave'
import { initSpiralToy } from './toy-spiral'
import { initStringToy } from './toy-string'
import { initWords } from './words'

initSoundSwitch()
initMotionSwitch()
Motion.init()

initHero()
initPredict()
initWords()

// six steps, five toys: the spiral (Fig. 5) unrolls into the keyboard for step 6
const deck = createStepDeck({
  toyFor: (step) => (step === 6 ? 5 : step),
  after: { label: 'Sing it', selector: '#sing' },
})
initStringToy(deck)
const dial = mountDial(q('[data-toy="2"]'), { active: deck.toyActive(2) })
registerToy({
  onStep: (n) => {
    if (n !== 2) dial.stop()
  },
})
const loud = mountLoud(q('[data-toy="3"]'), { active: deck.toyActive(3) })
registerToy({
  onStep: (n) => {
    if (n !== 3) loud.stop()
  },
})
initOctaveToy(deck)
initSpiralToy(deck)
deck.start()

initSing({ blue: mercBlue, orange: mercOrange })
createQuiz({
  questions: QUIZ_QUESTIONS,
  lesson: 1,
  keys: { seed: 'fyp-l01-seed', record: 'fyp-l01-quiz-v3' },
  deck,
})
// the next lesson's card first: the explorer binds its link to the map
createNextCard(1)

// the last screen's way back to the plan, for someone who answered its
// questions: a chunk of its own, after first paint (one that cannot load
// leaves the link hidden)
void import('@/features/lessons/kit/plan-back').then(
  ({ bootPlanBackLink }) => bootPlanBackLink(document),
  () => undefined,
)

const explorer = createExplorer({ current: 1, posters: { 1: poster } })
createEpisode({
  film: FILM_SOURCES,
  captions: vttUrl,
  vtt: FILM_CAPTIONS_TEXT,
  chapters: FILM_CHAPTERS,
  onDuration: (len) => explorer.setLength(1, len),
})

engraveClefs(G_CLEF_PATH)
initMasthead(
  {
    words: '#lesson',
    lesson: '#lesson',
    sing: '#lesson',
    check: '#lesson',
    watch: '#watch',
    explorer: '#explorer',
  },
  { lesson: 1, deck },
)
initEntrance()
initReveals()
startFrameLoop()
void initMercs(q('#heroStage'))

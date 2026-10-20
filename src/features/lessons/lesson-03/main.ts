// ============================================================
// Lesson 3 page — "Match a note", booted in reading order
// ============================================================
//
// learn/03.html carries every word of the lesson; this module adds what the
// markup cannot: the sound, the five step toys, the Mercs, the recall and
// the quick check, the checkpoint that listens, the Wrap's free play and the
// season map. The renderer for the Mercs loads last, as its own chunk, and
// the listener only when Sing it's Start is pressed, so the page reads and
// plays before either arrives. A draft until the vocal coach signs it off
// (kit/drafts.ts).

import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import '@/features/lessons/kit/lesson-fonts.css'
import '@/features/lessons/kit/lesson-base.css'
import '@/features/lessons/kit/lesson-sections.css'
import '@/features/lessons/kit/lesson-stage.css'
import '@/features/lessons/kit/lesson-voice.css'
import './lesson-03.css'
import { q } from '@/features/lessons/kit/dom'
import { createExplorer } from '@/features/lessons/kit/explorer'
import { startFrameLoop } from '@/features/lessons/kit/frame-loop'
import { G_CLEF_PATH } from '@/features/lessons/kit/glyphs'
import { mountLoud } from '@/features/lessons/kit/loud'
import { initMercs } from '@/features/lessons/kit/merc-duo'
import { Motion } from '@/features/lessons/kit/motion-switch'
import { engraveClefs, initMasthead, initMotionSwitch, initSoundSwitch, } from '@/features/lessons/kit/page-chrome'
import { rememberSteps } from '@/features/lessons/kit/position'
import { createQuiz } from '@/features/lessons/kit/quiz'
import { initReveals } from '@/features/lessons/kit/reveal'
import { createStepDeck, registerToy } from '@/features/lessons/kit/step-deck'
import { bindVoiceButtons } from '@/features/lessons/kit/voice-choice'
import mercBlue from '@/features/lessons/lesson-01/assets/merc-blue.png'
import mercOrange from '@/features/lessons/lesson-01/assets/merc-orange.png'
import { initHook } from './hook'
import { QUIZ_QUESTIONS } from './quiz-questions'
import { initRecall } from './recall'
import { initSing } from './sing'
import { mountBandToy } from './toy-band'
import { mountFolds } from './toy-folds'
import { mountMatch } from './toy-match'
import { mountOctaves } from './toy-octaves'
import { initWords } from './words'
import { initWrap } from './wrap'

// the gate's line while sound is off is the markup's (LESSON.md's); once it
// is on, the line still names the microphone
initSoundSwitch({
  on: 'Sound is on: nothing plays until you press play. We ask for the microphone only if you choose to sing.',
})
initMotionSwitch()
Motion.init()

initHook()
initRecall()
initWords()

// five steps, one toy each
const deck = createStepDeck({
  toyFor: (step) => step,
  after: { label: 'Sing it', selector: '#sing' },
})
const folds = mountFolds(q('#foldsToy'), { active: deck.toyActive(1) })
const loud = mountLoud(q('#loudToy'), {
  active: deck.toyActive(2),
  kind: 'merc',
  flags: {
    far: 'Louder: the note stayed put',
    up: 'Higher: the note moved up',
    down: 'Higher: the note moved down',
  },
})
const match = mountMatch(q('#matchToy'), { active: deck.toyActive(3) })
mountOctaves(q('#octaveToy'), { active: deck.toyActive(4) })
const band = mountBandToy(q('#bandToy'), {
  active: deck.toyActive(5),
  chase: true,
})
registerToy({
  onStep: (n) => {
    if (n !== 1) folds.stop()
    if (n !== 2) loud.stop()
    if (n !== 3) match.stop()
    if (n !== 5) band.stop()
  },
})
bindVoiceButtons(q('#step-4'))
deck.start()
rememberSteps(3, deck)

initSing({ blue: mercBlue, orange: mercOrange })
createQuiz({
  questions: QUIZ_QUESTIONS,
  lesson: 3,
  keys: { seed: 'fyp-l03-seed', record: 'fyp-l03-quiz-v1' },
  deck,
})
initWrap()
createExplorer({ current: 3 })

engraveClefs(G_CLEF_PATH)
initMasthead({
  words: '#lesson',
  lesson: '#lesson',
  sing: '#sing',
  explorer: '#explorer',
})
initReveals()
startFrameLoop()
void initMercs(q('#heroStage'))

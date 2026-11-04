// ============================================================
// Lesson 11 page — "Registers and the break", in reading order
// ============================================================
//
// learn/11.html carries every word of the lesson; this module adds what the
// markup cannot. A written lesson with no film, so there is no Watch section
// and the masthead's anchors are Lesson, Sing and Explorer. The hero is the
// cold open, in Lesson 2's order: the hook, the stage, the sound gate and the
// predict, then the recall (CURIOSITY-MOMENTS § 3.1). Merc and Tavi's
// renderer loads last, as its own chunk, so the page reads before it
// arrives. A draft until the vocal coach has signed it off (kit/drafts.ts).
//
// The page shell: the switches, the steps' deck with each step's controls,
// the next lesson's card, the season map, the masthead and Merc and Tavi.
// Each toy does nothing until it is wired: the range chart on the stage and
// in free play, the cold open on the hero's chart, the recall and the quick
// check, the four words and Sing it.

import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import '@/features/lessons/kit/lesson-fonts.css'
import '@/features/lessons/kit/lesson-base.css'
import '@/features/lessons/kit/lesson-sections.css'
import '@/features/lessons/kit/lesson-stage.css'
import '@/features/lessons/kit/lesson-parts.css'
// lesson-voice.css comes in by lesson-11.css's @import until the modules
// it shares a chunk with are loaded here (lesson-11.css says why)
import './lesson-11.css'
import { q } from '@/features/lessons/kit/dom'
import { createExplorer } from '@/features/lessons/kit/explorer'
import { startFrameLoop } from '@/features/lessons/kit/frame-loop'
import { G_CLEF_PATH } from '@/features/lessons/kit/glyphs'
import { initMercs } from '@/features/lessons/kit/merc-duo'
import { Motion } from '@/features/lessons/kit/motion-switch'
import { createNextCard } from '@/features/lessons/kit/next-card'
import { engraveClefs, initMasthead, initMotionSwitch, initSoundSwitch, } from '@/features/lessons/kit/page-chrome'
import { initReveals } from '@/features/lessons/kit/reveal'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { initSteps } from './steps'

initSoundSwitch()
initMotionSwitch()
Motion.init()

// five steps, one range chart
const deck = createStepDeck({
  toyFor: () => 1,
  after: { label: 'Sing it', selector: '#sing' },
})
initSteps()
deck.start()

// the next lesson's card first: the explorer binds its link to the map
createNextCard(11)
createExplorer({ current: 11 })

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
  { lesson: 11, deck },
)
initReveals()
startFrameLoop()
// Merc celebrates with no sparkles on this page (WEB-SPEC, Merc and Tavi)
void initMercs(q('#heroStage'), { sparkles: 'none' })

// ============================================================
// Lesson 13 page — "Resonance and vowels", in reading order
// ============================================================
//
// learn/13.html carries every word of the lesson; this module adds what the
// markup cannot. A written lesson with no film, so there is no Watch section
// and the masthead's anchors are Lesson, Sing and Explorer. The hero is the
// cold open, in Lesson 2's order: the hook, the stage, the sound gate and the
// predict, then the recall (CURIOSITY-MOMENTS § 3.1). Merc and Tavi's
// renderer loads last, as its own chunk, so the page reads before it
// arrives. A draft until the vocal coach signs it off (kit/drafts.ts).
//
// One object carries the lesson: the vowel figure, the kit's band chart
// with Merc's line level at its centre over an LED strip of his note's
// harmonics (figure.ts). It is Merc's model, labelled so, and never the
// viewer's voice: nothing on the page reads anything from the microphone
// but pitch frames.
//
// The switches, the steps' deck with the vowel figure in each step's state,
// the next lesson's card, the season map, the masthead and Merc and Tavi.
// The rest does nothing until it is wired: the cold open on the hero's
// figure, the recall and the quick check, the four words, Sing it and free
// play.

import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import '@/features/lessons/kit/lesson-fonts.css'
import '@/features/lessons/kit/lesson-base.css'
import '@/features/lessons/kit/lesson-sections.css'
import '@/features/lessons/kit/lesson-stage.css'
import '@/features/lessons/kit/lesson-parts.css'
// lesson-voice.css comes in by lesson-13.css's @import until Sing it loads
// the modules it shares a chunk with (lesson-13.css says why)
import './lesson-13.css'
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

// the gate's line while sound is off is the markup's (LESSON.md's); once it
// is on, the line still names the microphone
initSoundSwitch({
  on: 'Sound is on: nothing plays until you press play. We ask for the microphone only if you choose to sing.',
})
initMotionSwitch()
Motion.init()

// five steps, one vowel figure
const deck = createStepDeck({
  toyFor: () => 1,
  after: { label: 'Sing it', selector: '#sing' },
})
initSteps(deck)
deck.start()

// the next lesson's card first: the explorer binds its link to the map
createNextCard(13)
createExplorer({ current: 13 })

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
  { lesson: 13, deck },
)
initReveals()
startFrameLoop()
// Merc celebrates with no sparkles on this page (WEB-SPEC, Merc and Tavi)
void initMercs(q('#heroStage'), { sparkles: 'none' })

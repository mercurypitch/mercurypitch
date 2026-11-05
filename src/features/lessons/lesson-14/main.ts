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
// The switches, the steps' deck with the song line in each step's state,
// the season's close, the season map, the masthead and Merc and Tavi. The
// rest does nothing until it is wired: the song line on the hero, the cold
// open, the recall and the quick check, the four words, Sing it and the
// closing card's still.

import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import '@/features/lessons/kit/lesson-fonts.css'
import '@/features/lessons/kit/lesson-base.css'
import '@/features/lessons/kit/lesson-sections.css'
import '@/features/lessons/kit/lesson-stage.css'
import '@/features/lessons/kit/lesson-parts.css'
// lesson-voice.css comes in by lesson-14.css's @import until Sing it loads
// the modules it shares a chunk with (lesson-14.css says why)
import './lesson-14.css'
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

// five steps, one song line
const deck = createStepDeck({
  toyFor: () => 1,
  after: { label: 'Sing it', selector: '#sing' },
})
initSteps(deck)
deck.start()

// the season's close first: the explorer binds its map link
createNextCard(14)
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
initReveals()
startFrameLoop()
// Merc celebrates with no sparkles on this page (WEB-SPEC, Merc and Tavi)
void initMercs(q('#heroStage'), { sparkles: 'none' })

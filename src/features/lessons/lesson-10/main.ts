// ============================================================
// Lesson 10 page — "Major and minor", in reading order
// ============================================================
//
// learn/10.html carries every word of the lesson; this module adds what the
// markup cannot. A written lesson with no film, so there is no Watch section
// and the masthead's anchors are Lesson, Sing and Explorer. The hero is the
// cold open, in Lesson 2's order: the hook, the stage, the sound gate and the
// predict, then the recall (CURIOSITY-MOMENTS § 3.1). Merc and Tavi's
// renderer loads last, as its own chunk, so the page reads before it
// arrives. A draft until Lesson 6's page is live and the vocal coach has
// looked at the sung checkpoint (kit/drafts.ts).
//
// The page's names are flats, set before the cold open mounts: the hero's
// spiral is the only part that reads them, so its ring names every black
// key by its flat and each move lands on E flat or G flat (WEB-SPEC, Toys
// 2). They are never stored, and the page shows no switch for them.
//
// The switches, the cold open on the hero's spiral, the steps' deck with
// the chord beads in each step's state, the next lesson's card, the season
// map, the masthead and Merc and Tavi. The rest does nothing until it is
// wired: the steps' controls and free play, the recall and the quick
// check, the four words, the two games, Step 5's predict and Sing it.

import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import '@/features/lessons/kit/lesson-fonts.css'
import '@/features/lessons/kit/lesson-base.css'
import '@/features/lessons/kit/lesson-sections.css'
import '@/features/lessons/kit/lesson-stage.css'
import '@/features/lessons/kit/lesson-parts.css'
// lesson-guide.css, lesson-voice.css and lesson-ear-game.css come in by
// lesson-10.css's @import until the modules they share a chunk with are
// loaded here (lesson-10.css says why)
import './lesson-10.css'
import { q } from '@/features/lessons/kit/dom'
import { createExplorer } from '@/features/lessons/kit/explorer'
import { startFrameLoop } from '@/features/lessons/kit/frame-loop'
import { G_CLEF_PATH } from '@/features/lessons/kit/glyphs'
import { initMercs } from '@/features/lessons/kit/merc-duo'
import { Motion } from '@/features/lessons/kit/motion-switch'
import { Names } from '@/features/lessons/kit/names'
import { createNextCard } from '@/features/lessons/kit/next-card'
import { engraveClefs, initMasthead, initMotionSwitch, initSoundSwitch, } from '@/features/lessons/kit/page-chrome'
import { initReveals } from '@/features/lessons/kit/reveal'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { initColdOpen } from './cold-open'
import { initSteps } from './steps'

Names.set('flats')

initSoundSwitch()
initMotionSwitch()
Motion.init()

initColdOpen()

// five steps, one chord-beads toy
const deck = createStepDeck({
  toyFor: () => 1,
  after: { label: 'Sing it', selector: '#sing' },
})
initSteps(deck)
deck.start()

// the next lesson's card first: the explorer binds its link to the map
createNextCard(10)
createExplorer({ current: 10 })

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
  { lesson: 10, deck },
)
initReveals()
startFrameLoop()
// Merc celebrates with no sparkles on this page (WEB-SPEC, Merc and Tavi)
void initMercs(q('#heroStage'), { sparkles: 'none' })

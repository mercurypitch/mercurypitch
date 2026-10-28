// ============================================================
// Lesson 12 page — "Chords and the four-chord song", in reading order
// ============================================================
//
// learn/12.html carries every word of the lesson; this module adds what the
// markup cannot. A written lesson with no film, so there is no Watch section
// and the masthead's anchors are Lesson, Sing and Explorer. The hero is the
// cold open, in Lesson 2's order: the hook, the stage, the sound gate and the
// predict, then the recall (CURIOSITY-MOMENTS § 3.1). Merc and Tavi's
// renderer loads last, as its own chunk, so the page reads before it
// arrives. A draft until Lesson 10's page is live and the vocal coach has
// looked at the sung checkpoint (kit/drafts.ts).
//
// The page's names stay the kit's default, sharps, so the rings name the
// black keys C sharp to A sharp and G major's F sharp is spelled as its key
// spells it (WEB-SPEC, Toys 1). They are never stored, and the page shows no
// switch for them. The ring's names switch, Letters · Do-re-mi, is one
// page-wide choice: Letters on every visit, held for the visit in memory
// and never stored, so every copy of the ring follows it.
//
// The switches, the steps' deck with the ring of rooms in each step's
// state, its chord strip, Step 2's key switch, Step 3's slide and names
// switch, Step 4's loop and roots and their Slow, the next lesson's card,
// the season map, the masthead and Merc and Tavi. The rest does nothing
// until it is wired: Step 5's tunes and free play, the cold open on the
// hero's ring, the recall and the quick check, the four words and Sing it.

import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import '@/features/lessons/kit/lesson-fonts.css'
import '@/features/lessons/kit/lesson-base.css'
import '@/features/lessons/kit/lesson-sections.css'
import '@/features/lessons/kit/lesson-stage.css'
import '@/features/lessons/kit/lesson-parts.css'
// lesson-guide.css and lesson-voice.css come in by lesson-12.css's @import
// until the modules they share a chunk with are loaded here (lesson-12.css
// says why)
import './lesson-12.css'
import { q } from '@/features/lessons/kit/dom'
import { createExplorer } from '@/features/lessons/kit/explorer'
import { startFrameLoop } from '@/features/lessons/kit/frame-loop'
import { G_CLEF_PATH } from '@/features/lessons/kit/glyphs'
import { initMercs } from '@/features/lessons/kit/merc-duo'
import { Motion } from '@/features/lessons/kit/motion-switch'
import { createModeStore } from '@/features/lessons/kit/names'
import type { LettersSolfegeMode } from '@/features/lessons/kit/names-modes'
import { LETTERS_SOLFEGE_MODES } from '@/features/lessons/kit/names-modes'
import { createNextCard } from '@/features/lessons/kit/next-card'
import { engraveClefs, initMasthead, initMotionSwitch, initSoundSwitch, } from '@/features/lessons/kit/page-chrome'
import { initReveals } from '@/features/lessons/kit/reveal'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { initSteps } from './steps'

initSoundSwitch()
initMotionSwitch()
Motion.init()

// the names on the ring and its chips: one page-wide choice, Letters on
// every visit, never stored
const ringNames = createModeStore<LettersSolfegeMode>(
  LETTERS_SOLFEGE_MODES,
  'letters',
)

// five steps, one ring of rooms
const deck = createStepDeck({
  toyFor: () => 1,
  after: { label: 'Sing it', selector: '#sing' },
})
initSteps(deck, ringNames)
deck.start()

// the next lesson's card first: the explorer binds its link to the map
createNextCard(12)
createExplorer({ current: 12 })

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
  { lesson: 12, deck },
)
initReveals()
startFrameLoop()
// Merc celebrates with no sparkles on this page (WEB-SPEC, Merc and Tavi)
void initMercs(q('#heroStage'), { sparkles: 'none' })

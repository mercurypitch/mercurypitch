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
// switch, Step 4's loop and roots, Step 5's tunes and their Slow, the next
// lesson's card, the season map, the masthead and Merc and Tavi; the cold
// open on the hero's ring, with its predict; the recall from Lesson 10,
// the four words, Sing it whole (its comfort check, voice choice, Merc's
// notes, Move do, the guide and "How did that feel?") with the Wrap's
// card its ending picks, and the quick check. Free play does nothing
// until it is wired.

import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import '@/features/lessons/kit/lesson-fonts.css'
import '@/features/lessons/kit/lesson-base.css'
import '@/features/lessons/kit/lesson-sections.css'
import '@/features/lessons/kit/lesson-stage.css'
// Sing it's guide; and Lesson 10's questions bring Lesson 2's quiz modules
// onto this page, so taking this sheet here keeps it in their chunk, and
// Lessons 2, 4, 6, 8, 9 and 10 still link it before their own sheets
// (MISTAKES.md, on the lessons' base stylesheet)
import '@/features/lessons/kit/lesson-guide.css'
import '@/features/lessons/kit/lesson-parts.css'
// Sing it brings the kit's comfort check and voice choice, so taking the
// voice lessons' sheet here keeps it in the chunk it shares with them, and
// Lessons 3 and 5 to 11 and 13 still link it before their own sheets
import '@/features/lessons/kit/lesson-voice.css'
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
import { createQuiz } from '@/features/lessons/kit/quiz'
import { initReveals } from '@/features/lessons/kit/reveal'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import mercBlue from '@/features/lessons/lesson-01/assets/merc-blue.png'
import mercOrange from '@/features/lessons/lesson-01/assets/merc-orange.png'
import { initColdOpen } from './cold-open'
import { QUIZ_KEYS, QUIZ_QUESTIONS } from './quiz-questions'
import { initRecall } from './recall'
import { initSing } from './sing'
import { initSteps } from './steps'
import { initWords } from './words'

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

// the cold open on the hero's ring, which a step change of the deck ends;
// the recall follows it, asked of everyone; then the four words
initColdOpen(deck)
initRecall()
initWords()

initSteps(deck, ringNames)
deck.start()

// Sing it: nothing listens, and only the voice is stored; it mounts the
// Wrap's practise card, in the version the visit's ending picks
initSing({ blue: mercBlue, orange: mercOrange })

// the quick check: answering all four marks Lesson 12 done; its step links
// open the deck at their step
createQuiz({ questions: QUIZ_QUESTIONS, lesson: 12, keys: QUIZ_KEYS, deck })

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

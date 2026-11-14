// ============================================================
// Lesson 28 page — "Cadences, form and a song in two parts", in reading order
// ============================================================
//
// learn/28.html carries every word of the lesson; this module adds what the
// markup cannot. A written lesson with no film, so there is no Watch section
// and the masthead's anchors are Lesson, Sing and Explorer. The hero is the
// cold open, in Lesson 2's order: the hook, the stage, the sound gate and the
// predict, then the recall (CURIOSITY-MOMENTS § 3.1), which asks Lesson 18's
// and Lesson 26's own questions. One object carries the lesson: the song in
// two parts, a strip of ten bars in the hero and the song on two staffs in
// the steps, Tavi's part in the treble clef over Merc's in the bass (WEB-SPEC,
// Look). Merc and Tavi's renderer loads last, as its own chunk, so the page
// reads before it arrives. Season 2's last lesson: its next-lesson card is
// the season's close. A draft until Lessons 18 and 26's pages are live, the
// lab test has passed and the vocal coach has signed off its breath marks,
// its voice lines and its checkpoint (kit/drafts.ts).
//
// Season 2's page: it carries its season before anything draws
// (kit/page-state.ts `carrySeason`), so the masthead, the explorer, its
// links and the season's close know Lessons 15 to 28, and the explorer opens
// on Season 2's tab. No staff for show: no section head carries the faint
// staff and its clef (no `engraveClefs`), and the body's `season-2` class
// drops the background's (WEB-SPEC, Look).

import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import '@/features/lessons/kit/lesson-fonts.css'
import '@/features/lessons/kit/lesson-base.css'
import '@/features/lessons/kit/lesson-sections.css'
import '@/features/lessons/kit/lesson-stage.css'
// the guide's and the voice lessons' sheets join with the recall and Sing
// it, the modules whose chunks they share: taken before them, each leaves
// its chunk for one of its own, which every lesson page would then link
// after its own sheet (MISTAKES.md, on the lessons' base stylesheet)
import '@/features/lessons/kit/lesson-parts.css'
import './lesson-28.css'
import { q } from '@/features/lessons/kit/dom'
import { createExplorer } from '@/features/lessons/kit/explorer'
import { startFrameLoop } from '@/features/lessons/kit/frame-loop'
import { initMercs } from '@/features/lessons/kit/merc-duo'
import { Motion } from '@/features/lessons/kit/motion-switch'
import { createNextCard } from '@/features/lessons/kit/next-card'
import { initMasthead, initMotionSwitch, initSoundSwitch, } from '@/features/lessons/kit/page-chrome'
import { carrySeason } from '@/features/lessons/kit/page-state'
import { initReveals } from '@/features/lessons/kit/reveal'
import { SEASON_2 } from '@/features/lessons/kit/season-2'
import { createStepDeck } from '@/features/lessons/kit/step-deck'

// Season 2, before anything draws
carrySeason(SEASON_2)

initSoundSwitch()
initMotionSwitch()
Motion.init()

// four steps, one toy in four states: the song on two staffs
const deck = createStepDeck({
  toyFor: () => 1,
  after: { label: 'Sing it', selector: '#sing' },
})
deck.start()

// the season's close first, where other pages name the next lesson: the
// explorer binds its link to the map
createNextCard(28)
createExplorer({ current: 28 })

// the last screen's way back to the plan, for someone who answered its
// questions: a chunk of its own, after first paint (one that cannot load
// leaves the link hidden)
void import('@/features/lessons/kit/plan-back').then(
  ({ bootPlanBackLink }) => bootPlanBackLink(document),
  () => undefined,
)

initMasthead(
  {
    recall: '#lesson',
    words: '#lesson',
    lesson: '#lesson',
    sing: '#sing',
    explorer: '#explorer',
  },
  { lesson: 28, deck },
)
initReveals()
startFrameLoop()
// Tavi gives a quiet "oh" at the reveal with no sparkles (WEB-SPEC, Merc
// and Tavi)
void initMercs(q('#heroStage'), { sparkles: 'none' })

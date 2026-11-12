// ============================================================
// Lesson 18 free play — the reading staff with every play from the steps
// ============================================================
//
// In the Wrap (WEB-SPEC, Toys 2, state 5): the steps' reading staff under
// its own rules, every play from the four steps at once, each drawing its
// own tune, with the clef, Names, Count and the pitch-line switch, and no
// reveal or quiz attached. It follows Sing it's voice choice. Step 1's two
// reads stay locked under the same lock line until the predict's choice,
// since the Wrap can be reached before it, or open for a learner who has
// done the lesson. It has no tap pad: Step 3 keeps the page's one. Leaving
// it stops what it plays. It loads after first paint, as a chunk of its own
// (main.ts).

import { q } from '@/features/lessons/kit/dom'
import { onLeave } from '@/features/lessons/kit/leave'
import { Done } from '@/features/lessons/kit/progress'
import { Choice } from './choice'
import type { ReadingStaff } from './reading-staff'
import { mountReadingStaff } from './reading-staff'

export function initFreePlay(): ReadingStaff {
  const root = q('#freePlay')
  const staff = mountReadingStaff(root, { free: true, unlocked: Done.has(18) })
  Choice.whenMade(() => staff.unlock())
  onLeave(root, () => staff.stop())
  return staff
}

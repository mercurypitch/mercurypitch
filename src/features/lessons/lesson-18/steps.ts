// ============================================================
// Lesson 18 steps — four steps, one reading staff
// ============================================================
//
// Every step shows the one reading staff (reading-staff.ts) in its own
// state (WEB-SPEC, Toys 2): Step 1's two reads of the cold open's tune,
// locked until the predict's choice; Step 2's tunes A and B with their
// brackets; Step 3's tune C, counted in, with Count and the tap pad; Step
// 4's five marks. The figure's label, the tune and the controls follow the
// step through the deck's `onStep`, whatever the route, and leaving a step
// stops what it plays.

import { q } from '@/features/lessons/kit/dom'
import { Done } from '@/features/lessons/kit/progress'
import { registerToy } from '@/features/lessons/kit/step-deck'
import { Choice } from './choice'
import type { Part, ReadingStaff } from './reading-staff'
import { mountReadingStaff } from './reading-staff'

/**
 * Mounts the stage's reading staff and follows the deck: called before
 * `deck.start()`, so an address that names a step opens it.
 */
export function initSteps(): ReadingStaff {
  const staff = mountReadingStaff(q('#toyRead'), {
    free: false,
    unlocked: Done.has(18),
  })
  Choice.whenMade(() => staff.unlock())
  registerToy({
    onStep(n, previous) {
      if (n === previous) return
      staff.setPart(Math.min(4, Math.max(1, n)) as Part)
    },
  })
  return staff
}

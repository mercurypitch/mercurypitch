// ============================================================
// Lesson 12 sing flow — the kit's flow, with the loop's roots as its line
// ============================================================
//
// Sing it has no microphone: Merc sings the loop's roots, do, so, la, fa
// and do, over the chords, the viewer sings them with the guide, and "How
// did that feel?" follows every sweep (WEB-SPEC, Toys 6). The rule is the
// kit's (kit/sing-flow.ts), which moved there from here when Lesson 15
// took it; this page binds it with its own line after Easy and Workable,
// LESSON.md's, marked `data-after="roots"` in the markup. Move do and the
// guide's drawing are this page's controller's (sing.ts), as the flow
// holds neither, and Effortful, Uncomfortable and Just listen today pick
// the rest card, as before (spec Decisions 6).

import type { After as KitAfter, SingView as KitSingView, } from '@/features/lessons/kit/sing-flow'
import { singFlow } from '@/features/lessons/kit/sing-flow'

export type {
  Comfort,
  Hint,
  Panel,
  SingEvent,
  SingState,
} from '@/features/lessons/kit/sing-flow'
export {
  HINT,
  nextState,
  openState,
  STATUS,
} from '@/features/lessons/kit/sing-flow'

/** The line after an answer: LESSON.md's for Easy and Workable, or Lesson 3's gentle and enough-for-today lines. */
export type After = KitAfter<'roots'>

export type SingView = KitSingView<'roots'>

const flow = singFlow({
  sung: 'roots',
  line: "Do, so, la, fa, do: you just sang the loop's roots.",
})

/** The lines after an answer (LESSON.md, Sing it; FACTS 63). */
export const AFTER = flow.AFTER

export const singView = flow.singView

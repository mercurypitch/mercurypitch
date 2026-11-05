// ============================================================
// Lesson 15 wrap — the practice card in the version Sing it's ending picks
// ============================================================
//
// The practice card is Compose, in Sheet Music, in every version, since
// Compose asks for no voice (WEB-SPEC, Practice links; Toys 5). After
// "Effortful", "Uncomfortable" or "Just listen today" it shows Lesson 8's
// rest line above its text, which puts off only this page's sung line.
// Sing it's ending is held in memory for the visit (kit/comfort.ts
// `VisitEnding`), never stored, so a new visit opens with no rest line.

import { VisitEnding } from '@/features/lessons/kit/comfort'
import { q } from '@/features/lessons/kit/dom'

export function initWrap(): void {
  const rest = q('#practiseCard [data-ending="rest"]')
  VisitEnding.subscribe((ending) => {
    rest.hidden = ending !== 'rest'
  })
}

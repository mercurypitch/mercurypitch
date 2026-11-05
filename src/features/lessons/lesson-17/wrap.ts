// ============================================================
// Lesson 17 wrap — the practice card's rest line
// ============================================================
//
// The practice card is Ear Lab's The Chart, with Pulse beside it, in every
// version, since neither asks for a voice (WEB-SPEC, Practice links; FACTS
// 56). After "Effortful", "Uncomfortable" or "Just listen today" in the
// sung bars it shows Lesson 8's rest line above its text, which puts off
// only this page's sung bars. The ending is held in memory for the visit
// (kit/comfort.ts `VisitEnding`), never stored, so a new visit opens with
// no rest line.

import { VisitEnding } from '@/features/lessons/kit/comfort'
import { q } from '@/features/lessons/kit/dom'

export function initWrap(): void {
  const rest = q('#practiseCard [data-ending="rest"]')
  VisitEnding.subscribe((ending) => {
    rest.hidden = ending !== 'rest'
  })
}

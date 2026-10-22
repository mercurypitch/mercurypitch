// ============================================================
// Lesson 7 wrap — the practise card Sing it picks, and free play
// ============================================================
//
// The practise card comes in two versions (WEB-SPEC, Sections; Toys 4):
// the Vocal Range Test's, or, after "Effortful", "Uncomfortable" or "Just
// listen today", Lesson 3's rest card. Sing it's ending is held in memory
// for the visit (kit/comfort.ts `VisitEnding`), never stored, so a new
// visit opens on the Vocal Range Test card.
//
// Free play unlocks after the lesson (playbook rule 17): the range chart in
// all five states on one stage, under one switch.

import { mountPractiseCard } from '@/features/lessons/kit/comfort'
import { q } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import type { RangeToy } from './range-toy'
import { mountRangeToy } from './range-toy'

export function initWrap(): RangeToy {
  mountPractiseCard(q('#practiseCard'))
  const free = q('#freePlay')
  return mountRangeToy(free, { active: watch(free) })
}

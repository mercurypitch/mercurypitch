// ============================================================
// Lesson 6 wrap — the practise card Sing it picks, and free play
// ============================================================
//
// The practise card comes in two versions (WEB-SPEC, Sections 9; Toys 6):
// Interval Trainer's, or, after "Effortful", "Uncomfortable" or "Just
// listen today", Lesson 3's rest card with Interval Trainer named for
// later; Ear Lab's Leap, which needs no voice, follows either. Sing it's
// ending is held in memory for the visit (kit/comfort.ts `VisitEnding`),
// never stored, so a new visit opens on the Interval Trainer card.
//
// Free play unlocks after the lesson (playbook rule 17): every tune-line
// control on one stage.

import { VisitEnding } from '@/features/lessons/kit/comfort'
import { q } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import type { ModeStore } from '@/features/lessons/kit/names'
import { mountTuneToy } from './tune-toy'
import type { NamesMode } from './tune-words'

export function initWrap(names: ModeStore<NamesMode>): void {
  const practise = q('#practiseCard [data-ending="practise"]')
  const rest = q('#practiseCard [data-ending="rest"]')
  VisitEnding.subscribe((ending) => {
    practise.hidden = ending !== 'practise'
    rest.hidden = ending !== 'rest'
  })
  const free = q('#freePlay')
  mountTuneToy(free, { active: watch(free), names }).setStep('free')
}

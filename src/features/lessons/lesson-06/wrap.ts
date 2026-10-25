// ============================================================
// Lesson 6 wrap — the practise card Sing it picks, and free play
// ============================================================
//
// The practise card comes in two versions (WEB-SPEC, Sections 9; Toys 6):
// Interval Trainer's, or, after "Effortful", "Uncomfortable" or "Just
// listen today", Lesson 3's rest card, which links nowhere and names
// Interval Trainer for later (kit/comfort.ts `mountPractiseCard`); Ear
// Lab's Leap, which needs no voice, follows either. Sing it's ending is
// held in memory for the visit (kit/comfort.ts `VisitEnding`), never
// stored, so a new visit opens on the Interval Trainer card.
//
// Free play unlocks after the lesson (playbook rule 17): every tune-line
// control on one stage.

import { mountPractiseCard } from '@/features/lessons/kit/comfort'
import { q } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import type { ModeStore } from '@/features/lessons/kit/names'
import type { LettersSolfegeMode } from '@/features/lessons/kit/names-modes'
import { mountTuneToy } from './tune-toy'

export function initWrap(names: ModeStore<LettersSolfegeMode>): void {
  mountPractiseCard(q('#practiseCard'))
  const free = q('#freePlay')
  mountTuneToy(free, { active: watch(free), names }).setStep('free')
}

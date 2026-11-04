// ============================================================
// Lesson 11 wrap — the practice card Sing it picks, and free play
// ============================================================
//
// The practice card comes in two versions (WEB-SPEC, Sections; Toys 4):
// the Siren exercise's, or, after "Effortful", "Uncomfortable" or "Just
// listen today", the rest card. Sing it's ending is held in memory for the
// visit (kit/comfort.ts `VisitEnding`), never stored, so a new visit opens
// on the Siren card.
//
// Free play comes after the lesson (playbook rule 17): the steps' range
// chart in all five states on one stage, under one state switch, with a
// voice switch of its own that stores nothing (registers-toy.ts).

import { mountPractiseCard } from '@/features/lessons/kit/comfort'
import { q } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import type { RegistersToy } from './registers-toy'
import { mountRegistersToy } from './registers-toy'

export function initWrap(): RegistersToy {
  mountPractiseCard(q('#practiseCard'))
  const free = q('#freePlay')
  return mountRegistersToy(free, { active: watch(free) })
}

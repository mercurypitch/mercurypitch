// ============================================================
// Lesson 17 checkpoint — Tap it, then sing it, on one card
// ============================================================
//
// The checkpoint's two parts (WEB-SPEC, Toys 7): the tap take (take.ts),
// which uses no voice, then the sung bars (sing.ts), nothing listening.
// main.ts loads this module after first paint, as a chunk of its own: the
// take, its judge, the tap pad, the clap's drum voices and the sung part
// are some 20 KB the first screen never needs.

import { q } from '@/features/lessons/kit/dom'
import { initSing } from './sing'
import { initTake } from './take'

/** Binds both parts of the checkpoint's card. */
export function initCheckpoint(): void {
  const card = q('#singCard')
  initTake(card)
  initSing(card)
}

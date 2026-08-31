// ============================================================
// Reveal pacing — what happens after a verdict, shared by the three
// run engines (threshold, identification, Home) so every drill obeys
// one rule. Auto-advance on: the verdict holds for the rack's
// setting, then the next trial sounds by itself. Off: the run parks
// on the verdict until Next — the lead pad, or Space. Flipping the
// switch on while parked resumes the run after one hold, so nobody
// is stranded on a verdict with the Next pad gone.
//
// useLastCall is the view's half: the verdict snapshot the Last call
// plate keeps until the next one.
// ============================================================

import { createEffect, createSignal, untrack } from 'solid-js'
import { earAutoAdvance, earRevealHoldMs } from '@/stores/ear-lab-store'
import type { LastCall } from './EarStage'

export interface RevealPacer {
  /** True while the run waits for Next. */
  parked: () => boolean
  /** Call once the verdict — and any replay — is on the stage. */
  hold: () => void
  /** The Next pad: starts the next trial, only while parked. */
  next: () => void
  /** Stop and unmount: drop the timer and the parked state. */
  cancel: () => void
}

export function createRevealPacer(
  advance: () => void,
  isCancelled: () => boolean,
): RevealPacer {
  const [parked, setParked] = createSignal(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  function hold(): void {
    clearTimeout(timer)
    if (!untrack(earAutoAdvance)) {
      setParked(true)
      return
    }
    setParked(false)
    timer = setTimeout(() => {
      timer = undefined
      if (isCancelled()) return
      advance()
    }, untrack(earRevealHoldMs))
  }

  function next(): void {
    if (!parked() || isCancelled()) return
    setParked(false)
    advance()
  }

  function cancel(): void {
    clearTimeout(timer)
    timer = undefined
    setParked(false)
  }

  createEffect(() => {
    if (earAutoAdvance() && parked()) hold()
  })

  return { parked, hold, next, cancel }
}

/** "1.5 s", "2 s", "10 s" — the slider's readout. */
export function formatRevealHold(ms: number): string {
  const seconds = ms / 1000
  const text = Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1)
  return `${text} s`
}

/** The verdict a view keeps on its Last call plate: taken as the
 *  reveal opens (untracked, so the next round cannot rewrite it) and
 *  dropped when the run ends. */
export function useLastCall(
  phase: () => string,
  snapshot: () => LastCall,
): () => LastCall | null {
  const [call, setCall] = createSignal<LastCall | null>(null)
  createEffect(() => {
    const now = phase()
    if (now === 'reveal') setCall(untrack(snapshot))
    else if (now === 'idle' || now === 'done') setCall(null)
  })
  return call
}

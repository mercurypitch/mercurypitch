// ============================================================
// Reveal pacing — what happens after a verdict, shared by the three
// run engines (threshold, identification, Home) so every drill obeys
// one rule. Auto-advance on: the verdict holds for the rack's
// setting, then the next trial sounds by itself. Off: the run parks
// on the verdict until Next — the lead pad, or Space. Flipping the
// switch on while parked resumes the run after one hold, so nobody
// is stranded on a verdict with the Next pad gone.
//
// The native room (EAR_LAB_WITH_MERC) has no switch in its header. It
// paces by Merc's rule instead: a right answer moves on after the hold,
// a wrong one waits for Next, and touching the replay or the instrument
// pauses a hold that was counting down. The room sets the rule while it
// is up; the web's stages never change it.
//
// useLastCall is the view's half: the verdict snapshot the Last call
// plate keeps until the next one.
// ============================================================

import { createEffect, createSignal, untrack } from 'solid-js'
import { earAutoAdvance, earRevealHoldMs } from '@/stores/ear-lab-store'
import type { LastCall } from './EarStage'

/** Who paces the verdicts: the rack's switch, or Merc's rule. */
export type RevealRule = 'switch' | 'merc'

const [revealRule, setRevealRuleSignal] = createSignal<RevealRule>('switch')

/** The native room sets 'merc' while it is up and 'switch' as it goes. */
export function setRevealRule(rule: RevealRule): void {
  setRevealRuleSignal(rule)
}

/** What a verdict does next. `correct` is undefined for a round that
 *  had no answer to judge (Home's skipped take), which moves on. */
export function revealStep(
  rule: RevealRule,
  autoAdvance: boolean,
  correct: boolean | undefined,
): 'advance' | 'park' {
  if (rule === 'merc') return correct === false ? 'park' : 'advance'
  return autoAdvance ? 'advance' : 'park'
}

export interface RevealPacer {
  /** True while the run waits for Next. */
  parked: () => boolean
  /** Call once the verdict — and any replay — is on the stage, with
   *  whether the answer was right. */
  hold: (correct?: boolean) => void
  /** The Next pad: starts the next trial, only while parked. */
  next: () => void
  /** A hold counting down stops and waits for Next instead: the singer
   *  reached for the replay or the instrument. */
  pause: () => void
  /** Stop and unmount: drop the timer and the parked state. */
  cancel: () => void
}

export function createRevealPacer(
  advance: () => void,
  isCancelled: () => boolean,
): RevealPacer {
  const [parked, setParked] = createSignal(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  function hold(correct?: boolean): void {
    clearTimeout(timer)
    timer = undefined
    if (
      revealStep(untrack(revealRule), untrack(earAutoAdvance), correct) ===
      'park'
    ) {
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

  function pause(): void {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
    setParked(true)
  }

  function cancel(): void {
    clearTimeout(timer)
    timer = undefined
    setParked(false)
  }

  // The switch turned on while parked: resume after one hold. Merc's
  // rule has no switch, and a verdict it parked stays parked.
  createEffect(() => {
    if (revealRule() === 'switch' && earAutoAdvance() && parked()) hold()
  })

  return { parked, hold, next, pause, cancel }
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

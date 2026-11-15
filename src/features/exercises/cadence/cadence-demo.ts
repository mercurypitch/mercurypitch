// ============================================================
// Name the Cadence's example: one cadence, played and named
// ============================================================
//
// "Hear it first" (the shell's `demo`): before a run, Merc plays what a
// round sounds like, the key's own chord and then an ending, and says which
// ending it is. A perfect cadence in C, the one every level asks for.
//
// It strikes the chords as a round does (use-cadence-controller.ts), with
// the first struck where `play` is called, not on a timer: a browser lets a
// page make its first sound only from inside a tap.

import type { CadenceRound } from './cadence-rounds'
import { CADENCE_NAME, CADENCE_SAYS, chordsOf, stepsOf } from './cadence-rounds'
import { CHORD_MS, GAP_MS, LAST_CHORD_MS } from './use-cadence-controller'

/** The cadence the example plays: V to I in C major. */
export const EXAMPLE_CADENCE: CadenceRound = {
  type: 'perfect',
  tonicMidi: 60,
  degrees: [5, 1],
}

/** What Merc says while the example sounds. */
export const exampleLine = (round: CadenceRound = EXAMPLE_CADENCE): string =>
  `Listen: home, then ${chordsOf(round)}. A ${CADENCE_NAME[round.type].toLowerCase()} cadence: ${CADENCE_SAYS[round.type]}.`

export interface CadenceDemoDeps {
  /** Sound one chord: its notes as MIDI numbers, and how long it rings. */
  playChord: (midis: readonly number[], ms: number) => void
  stopSound: () => void
  /**
   * Which of the three chords is sounding, or -1 once none is; `last` when
   * it is the ending's second chord, the one that makes the cadence heard.
   */
  onSounding?: (index: number, last: boolean) => void
}

export function createCadenceDemo(deps: CadenceDemoDeps) {
  let timers: ReturnType<typeof setTimeout>[] = []
  let settle: (() => void) | null = null

  /** Cut the example short. The promise `play` gave still resolves. */
  function stop(): void {
    // Nothing playing, nothing to silence: a drill that never played its
    // example must not reach for the engine on its way out.
    if (settle === null && timers.length === 0) return
    for (const timer of timers) clearTimeout(timer)
    timers = []
    deps.stopSound()
    deps.onSounding?.(-1, false)
    const done = settle
    settle = null
    done?.()
  }

  /** Play the round's three chords; resolves when the last has rung out. */
  function play(round: CadenceRound = EXAMPLE_CADENCE): Promise<void> {
    stop()
    return new Promise<void>((resolve) => {
      settle = resolve
      const steps = stepsOf(round)
      let at = 0
      steps.forEach((step, i) => {
        const last = i === steps.length - 1
        const ms = last ? LAST_CHORD_MS : CHORD_MS
        const strike = (): void => {
          deps.onSounding?.(i, last)
          deps.playChord(step.midis, ms)
        }
        if (at === 0) strike()
        else timers.push(setTimeout(strike, at))
        at += ms + (last ? 0 : GAP_MS)
      })
      timers.push(
        setTimeout(() => {
          timers = []
          settle = null
          deps.onSounding?.(-1, false)
          resolve()
        }, at),
      )
    })
  }

  return { play, stop }
}

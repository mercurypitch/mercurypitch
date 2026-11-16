// ============================================================
// Sing It in Time: Merc plays a tune, or its do, before or after a run
// ============================================================
//
// "Hear it first" plays the tune on the sheet in time with the click: Merc's
// do, the count-in, then the tune sung on the beat with the click under it,
// the staff's cursor moving with it (the shell's `demo`, beside
// stage/note-demo.ts, which plays a row of notes on timers: a tune in time
// needs the beat clock's booking instead). "Hear do" plays the do alone,
// and after a run each tune can be heard again, as it should have gone.
//
// One thing plays at a time: a new play cuts the last one short, and every
// play's promise settles when it ends, however it ends.

import { createSignal, onCleanup } from 'solid-js'
import type { InTimeSound } from './beat-sound'
import type { FrameScheduler, TunePlay } from './tune-clock'
import { animationFrames, createTuneClock, playTune, startFrames, } from './tune-clock'
import type { Tune } from './tune-plan'

/** What is playing: the tune on the sheet, its do, or a sung tune by its place in the run. */
export type Playing =
  | { readonly kind: 'demo' }
  | { readonly kind: 'do' }
  | { readonly kind: 'again'; readonly tune: number }

export interface TunePlayerDeps {
  readonly sound: InTimeSound
  readonly frame?: FrameScheduler
}

export function createTunePlayer(deps: TunePlayerDeps) {
  const clock = createTuneClock(deps.sound)
  const frame = deps.frame ?? animationFrames
  const [playing, setPlaying] = createSignal<Playing | null>(null)
  /** Beats from bar 1's first beat as heard: the cursor's place while a tune plays. */
  const [beat, setBeat] = createSignal<number | null>(null)
  let play: TunePlay | null = null
  let stopFrames: (() => void) | null = null
  let settle: (() => void) | null = null
  let generation = 0

  function end(): void {
    stopFrames?.()
    stopFrames = null
    play = null
    setPlaying(null)
    setBeat(null)
    const done = settle
    settle = null
    done?.()
  }

  /** Cut whatever plays short; its promise still settles. */
  function stop(): void {
    if (play === null && settle === null) return
    generation += 1
    play?.stop()
    end()
  }

  function start(
    tune: Tune,
    what: Playing,
    parts: { lead: boolean; tune: boolean },
  ): Promise<void> {
    stop()
    const mine = ++generation
    setPlaying(what)
    return new Promise<void>((resolve) => {
      settle = resolve
      const current = playTune(clock, deps.sound, tune, {
        ...parts,
        click: true,
        voiced: true,
      })
      play = current
      stopFrames = startFrames(frame, () => {
        clock.pump()
        setBeat(current.beat())
      })
      void current.done.then(() => {
        if (mine === generation) end()
      })
    })
  }

  onCleanup(stop)

  return {
    playing,
    beat,
    /** Merc's do, the count-in, and the tune on the beat with the click. */
    demo: (tune: Tune): Promise<void> =>
      start(tune, { kind: 'demo' }, { lead: true, tune: true }),
    /** The do alone. */
    hearDo: (tune: Tune): Promise<void> =>
      start(tune, { kind: 'do' }, { lead: true, tune: false }),
    /** A tune of the run again, as it should have gone: its count-in, then the tune. */
    again: (tune: Tune, index: number): Promise<void> =>
      start(tune, { kind: 'again', tune: index }, { lead: true, tune: true }),
    stop,
  }
}

export type TunePlayer = ReturnType<typeof createTunePlayer>

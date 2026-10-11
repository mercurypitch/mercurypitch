// ============================================================
// useLongNoteDemo — "how it works": Merc sings Long note twice
// ============================================================
//
// A first visit opens on it, and the "?" button plays it again from the
// start or a result. Merc sings two takes through the room itself
// (scripted-take.ts): take 1 drifts off the line and stops for a breath,
// take 2 holds the line to the goal (half full, Merc steps out), then
// steady to the brim, its two long stretches at 4x. Every tooltip waits
// for the engine event it explains (demo-cues.ts).
//
// The demo never opens the mic, fires a haptic or keeps a result, and its
// sound stops on Skip, on the way out and when the app goes to the
// background. Sound needs a running audio clock: a first visit that cannot
// start one without a tap opens on a play card instead of a silent demo.

import type { Accessor } from 'solid-js'
import { createEffect, createSignal, on, onCleanup, onMount, untrack, } from 'solid-js'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { ScriptedTake } from '../scripted-take'
import type { LongNoteController } from '../useLongNoteController'
import { longNoteDemoAutoPlays } from './demo-auto-play'
import type { DemoCue, DemoMark, DemoTarget, LongNoteDemoPlan, } from './demo-cues'
import { DEMO_BEATS, DEMO_COPY, DEMO_CUES, demoCueText, planLongNoteDemo, } from './demo-cues'
import type { DemoTake, DemoTakeId } from './demo-script'
import { markLongNoteDemoSeen } from './demo-seen'
import type { LongNoteDemoSound } from './demo-sound'
import { createDemoSound } from './demo-sound'

export type DemoMode = 'idle' | 'card' | 'playing' | 'end'

export interface DemoTip {
  readonly id: DemoCue['id'] | 'mic'
  readonly text: string
  readonly target: DemoTarget
}

export interface LongNoteDemo {
  /** Off, offering itself (play card), playing, or on its end card. */
  mode: Accessor<DemoMode>
  /** The take on the pill; null outside the takes. */
  take: Accessor<DemoTakeId | null>
  tip: Accessor<DemoTip | null>
  /** One of take 2's fast-forwards is running. */
  fast: Accessor<boolean>
  /** The progress bar's run and length; null when there is none. */
  run: Accessor<{ readonly id: number; readonly seconds: number } | null>
  /** The mic's one pulse after Try it. */
  micPulse: Accessor<boolean>
  /** What the live region last said. */
  said: Accessor<string>
  /** The "?" button: at the start and on a result, never mid-take. */
  canAsk: Accessor<boolean>
  /** Reduced motion: no hops, sparkles or pulses. */
  readonly still: boolean
  /** "?", Watch and Watch again: the demo from the start (a tap). */
  ask: () => void
  /** Not now, on the play card. */
  dismiss: () => void
  skip: () => void
  tryIt: () => void
}

/** A first visit waits for Merc to land before the demo starts. */
const AUTO_PLAY_MS = 1200
/** How long a first visit waits for sound before the play card. */
const AUDIO_WAIT_MS = 700
/** The mic hint after Try it, seconds. */
const HINT_SECONDS = 3.2

function prefersStill(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** One take as the room sings it: its frames released on its own clock. */
function scriptedTake(
  take: DemoTake,
  note: number,
  startsAt: number,
  still: boolean,
  onMark: (mark: DemoMark) => void,
): ScriptedTake {
  const released: PitchFrame[] = []
  // Each fast-forward's start and end, in order, marked as the clock
  // passes them.
  const turns = take.fast.flatMap((stretch) => [
    { at: stretch.from, mark: 'fast' as const },
    { at: stretch.to, mark: 'slow' as const },
  ])
  let turned = 0
  const clock = (): number =>
    Math.max(0, take.engineAt((performance.now() - startsAt) / 1000))
  return {
    targetMidi: note,
    toResult: take.id === 'on',
    // Sheepish: he glances about, out of the glass.
    after: 'idle',
    still,
    now: clock,
    frames: () => {
      const t = clock()
      const all = take.frames
      while (released.length < all.length && all[released.length].t <= t) {
        released.push(all[released.length])
      }
      while (turned < turns.length && t >= turns[turned].at) {
        onMark(turns[turned].mark)
        turned += 1
      }
      return released
    },
    onEvent: onMark,
  }
}

export function useLongNoteDemo(room: LongNoteController): LongNoteDemo {
  const script = room.script
  const still = prefersStill()
  const [mode, setMode] = createSignal<DemoMode>('idle')
  const [take, setTake] = createSignal<DemoTakeId | null>(null)
  const [tip, setTip] = createSignal<DemoTip | null>(null)
  const [fast, setFast] = createSignal(false)
  const [run, setRun] = createSignal<{ id: number; seconds: number } | null>(
    null,
  )
  const [micPulse, setMicPulse] = createSignal(false)
  const [said, setSaid] = createSignal('')

  let alive = true
  /** Bumped by every start and stop: older timers fall silent. */
  let generation = 0
  /** Bumped by every request for sound: older answers are dropped. */
  let request = 0
  let sound: LongNoteDemoSound | null = null
  let plan: LongNoteDemoPlan | null = null
  /** The tooltips already cued this run: each shows once. */
  const cued = new Set<DemoCue['id']>()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const later = (seconds: number, fn: () => void): void => {
    const mine = generation
    const id = setTimeout(() => {
      timers.delete(id)
      if (alive && mine === generation) fn()
    }, seconds * 1000)
    timers.add(id)
  }

  const show = (next: DemoTip | null): void => {
    setTip(next)
    if (next !== null) setSaid(next.text)
  }

  /** Every sound off and every beat dropped; the room as it stands. */
  const halt = (): void => {
    generation += 1
    for (const id of timers) clearTimeout(id)
    timers.clear()
    sound?.stop()
    sound = null
    setFast(false)
    setTip(null)
  }

  const showCue = (cue: DemoCue): void => {
    const own = untrack(room.state).targetMidi !== null
    show({
      id: cue.id,
      text: demoCueText(cue.id, untrack(room.noteName), own),
      target: cue.target,
    })
  }

  const toEnd = (): void => {
    halt()
    setTake(null)
    setMode('end')
    markLongNoteDemoSeen()
    setSaid(DEMO_COPY.endTitle)
  }

  /** A take's event or mark: its tooltips, and what comes after it. */
  const onMark = (id: DemoTakeId, mark: DemoMark): void => {
    for (const cue of DEMO_CUES) {
      const trigger = cue.trigger
      if (trigger.take === id && trigger.mark === mark && !cued.has(cue.id)) {
        cued.add(cue.id)
        later(cue.delay, () => showCue(cue))
      }
    }
    if (mark === 'fast') setFast(true)
    if (mark === 'slow') setFast(false)
    // The goal: the room steps Merc out of the glass to cheer, with no
    // tooltip over him until the next one explains the top.
    if (mark === 'goal') setTip(null)
    if (mark !== 'end') return
    if (id === 'off') later(DEMO_BEATS.afterOff, rest)
    else later(DEMO_BEATS.afterOn, toEnd)
  }

  const sing = (id: DemoTakeId): void => {
    if (plan === null) return
    const take = plan.takes[id]
    setTip(null)
    const lead = sound?.lead ?? DEMO_BEATS.lead
    sound?.sing(take, plan.note)
    script.play(
      scriptedTake(
        take,
        plan.note,
        performance.now() + lead * 1000,
        still,
        (mark) => onMark(id, mark),
      ),
    )
  }

  /** Between the takes: the light empties and the pill turns. */
  function rest(): void {
    setTip(null)
    script.rest()
    setTake('on')
    setSaid(DEMO_COPY.on)
    later(DEMO_BEATS.reset, () => sing('on'))
  }

  const begin = (ctx: AudioContext | null): void => {
    halt()
    const note = script.note()
    if (!script.enter(DEMO_COPY.watch)) {
      setMode('idle')
      return
    }
    plan = planLongNoteDemo(note)
    cued.clear()
    sound = ctx === null ? null : createDemoSound(ctx, DEMO_BEATS.lead)
    setTake(null)
    setMicPulse(false)
    setMode('playing')
    setRun({ id: generation, seconds: plan.total })
    setSaid(DEMO_COPY.watch)
    sound?.tone(note)
    for (const cue of DEMO_CUES) {
      if (cue.trigger.take === 'intro') later(cue.delay, () => showCue(cue))
    }
    later(DEMO_BEATS.intro, () => {
      setTake('off')
      setSaid(DEMO_COPY.off)
      sing('off')
    })
  }

  /** The room's clock, asked for inside the tap that wants sound. */
  const soundNow = (): Promise<AudioContext | null> => {
    try {
      return script.audio()
    } catch {
      return Promise.resolve(null)
    }
  }

  const ask = (): void => {
    const mine = ++request
    void soundNow().then(
      (ctx) => {
        if (alive && mine === request) begin(ctx)
      },
      () => {
        if (alive && mine === request) begin(null)
      },
    )
  }

  // ── A first visit ──────────────────────────────────────────
  let autoTimer: ReturnType<typeof setTimeout> | undefined
  let audioWait: ReturnType<typeof setTimeout> | undefined
  /** The room is free for a demo it was not asked for. */
  const idleIntro = (): boolean =>
    untrack(mode) === 'idle' &&
    !untrack(script.active) &&
    untrack(room.state).phase === 'intro'

  const autoPlay = (): void => {
    autoTimer = undefined
    if (!idleIntro()) return
    const mine = ++request
    const offer = (): void => {
      clearTimeout(audioWait)
      if (!alive || mine !== request) return
      request += 1
      if (idleIntro()) setMode('card')
    }
    audioWait = setTimeout(offer, AUDIO_WAIT_MS)
    void soundNow().then((ctx) => {
      if (ctx === null || mine !== request) return offer()
      clearTimeout(audioWait)
      if (alive && idleIntro()) begin(ctx)
    }, offer)
  }

  const cancelAuto = (): void => {
    if (autoTimer !== undefined) clearTimeout(autoTimer)
    autoTimer = undefined
  }

  onMount(() => {
    if (!longNoteDemoAutoPlays()) return
    autoTimer = setTimeout(autoPlay, AUTO_PLAY_MS)
  })

  // The singer got there first (a tap on the mic, a new note): no demo.
  createEffect(
    on(
      () => `${room.state().phase}:${room.state().targetMidi}`,
      () => {
        cancelAuto()
        // The mic hint is done once the singer starts.
        if (untrack(tip)?.id === 'mic' && room.state().phase !== 'intro') {
          show(null)
          setMicPulse(false)
        }
      },
      { defer: true },
    ),
  )

  // The app went to the background: the demo stops where it is and offers
  // itself again; it has not been seen.
  const onVisibility = (): void => {
    if (document.visibilityState !== 'hidden') return
    const playing = untrack(mode) === 'playing'
    if (!playing && autoTimer === undefined) return
    cancelAuto()
    request += 1
    halt()
    script.leave()
    setTake(null)
    setRun(null)
    setMode('card')
  }
  document.addEventListener('visibilitychange', onVisibility)

  onCleanup(() => {
    alive = false
    cancelAuto()
    clearTimeout(audioWait)
    halt()
    document.removeEventListener('visibilitychange', onVisibility)
  })

  return {
    mode,
    take,
    tip,
    fast,
    run,
    micPulse,
    said,
    canAsk: () => {
      if (mode() !== 'idle' || script.active()) return false
      const phase = room.state().phase
      return phase === 'intro' || phase === 'result'
    },
    still,
    ask,
    dismiss: () => {
      setMode('idle')
      markLongNoteDemoSeen()
    },
    skip: () => {
      if (untrack(mode) !== 'playing') return
      script.leave()
      setRun(null)
      toEnd()
    },
    tryIt: () => {
      halt()
      script.leave()
      setTake(null)
      setRun(null)
      setMode('idle')
      show({ id: 'mic', text: DEMO_COPY.micHint, target: 'mic' })
      setMicPulse(!still)
      later(HINT_SECONDS, () => {
        show(null)
        setMicPulse(false)
      })
    },
  }
}

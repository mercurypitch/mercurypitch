// ============================================================
// useExerciseDemo: "how it works", Merc singing a room's exercise twice
// ============================================================
//
// A first visit opens on it, and the room's "?" plays it again from the
// start or a result. Merc sings two takes through the room itself (the
// room's DemoScript, fed by takeClock in demo-plan.ts): take 1 the way not
// to, take 2 the way to. Every tooltip waits for the engine event it
// explains, the first time that event fires.
//
// The demo never opens the mic, fires a haptic or keeps a result, and its
// sound stops on Skip, on the way out and when the app goes to the
// background. Sound needs a running audio clock: a first visit that cannot
// start one without a tap opens on a play card instead of a silent demo.
//
// A first visit's demo that has not started when the app goes (Control
// Center, the lock screen, the app switcher) is held, the room left as it
// was: no card, no hint, no clock. It starts AUTO_PLAY_MS after the singer
// is back, the app active and the page showing, if the room is still at its
// intro. One that had started ends on its card, and nothing plays by itself
// on the way back.
//
// Its mic hint ("Tap the mic to start.") is the room's at rest: it stays
// over the mic whenever the room waits for the tap that starts a take
// (the mic's ready state, room-kit mic-state.ts) and the demo is not on.
// The owner asked for it in every room after seeing it under Lip roll's
// Try it (15 Oct 2026). It is not said out loud: the mic's own name says
// what a tap does, and Try it says the hint once.

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, on, onCleanup, onMount, untrack, } from 'solid-js'
import { onAppLeave, onAppReturn } from '@/components/room-kit/app-leave'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import { tellDemoAuto } from './demo-auto'
import type { DemoBeats, DemoCue, DemoMark, DemoTakeId, DemoTakeShape, TakeClock, } from './demo-plan'
import { takeClock } from './demo-plan'
import type { DemoSoundtrack } from './demo-sound'

export type DemoMode = 'idle' | 'card' | 'playing' | 'end'

/** A tooltip: one of the room's cues, or the mic hint after Try it. */
export interface DemoTip<C extends string, T extends string> {
  readonly id: C | 'mic'
  readonly text: string
  readonly target: T
}

/** The demo's way into the room: the room plays its takes. */
export interface DemoScript<S> {
  /** From `enter` to `leave`: the mic stays shut and nothing is kept. */
  active: Accessor<boolean>
  /** The room's audio clock, running (call it inside a tap), or null. */
  audio: () => Promise<AudioContext | null>
  /**
   * What the demo's sound needs loaded before it starts, if anything
   * (Echo's: Merc's recorded voice). The demo waits for it, at most
   * READY_WAIT_MS, once the clock is running; without it, the room's
   * fallback sings.
   */
  ready?: () => Promise<unknown>
  /** The note the demo sings: the room's own, else the voice type's. */
  note: () => number
  /**
   * Clear the room for the demo, with `line` in Merc's bubble. False, and
   * nothing changed, while the singer is mid-take or the mic is opening.
   */
  enter: (line: string) => boolean
  play: (take: S) => void
  /** Between takes: the room empties and its trace clears. */
  rest: () => void
  /** Back to the room's start, as it was before the demo. */
  leave: () => void
  /**
   * Whether the demo is playing. The screen stays on while it does: a demo
   * plays about 20 s, and Android's shortest screen timeout is 15 s.
   */
  playing: (on: boolean) => void
}

/** What the demo reads of the room. */
export interface DemoRoom<S> {
  readonly script: DemoScript<S>
  /** The room's phase: the demo offers itself at 'intro' and 'result'. */
  phase: Accessor<string>
  /** The note's name, for the tooltips' words. */
  noteName: Accessor<string>
  /** The singer has a note of their own, not the room's "any easy note". */
  ownNote: Accessor<boolean>
  /** Changes whenever the singer moves first: a take starts, a new note. */
  moment: Accessor<string>
}

/** The demo as one room plays it. */
export interface ExerciseDemoConfig<
  C extends string,
  T extends string,
  E extends string,
  Take extends DemoTakeShape<E>,
  S,
> {
  readonly room: DemoRoom<S>
  /** The takes on a note, and when the end card comes. */
  plan: (note: number) => {
    readonly note: number
    readonly takes: Readonly<Record<DemoTakeId, Take>>
    readonly total: number
  }
  readonly cues: readonly DemoCue<C, E, T>[]
  readonly beats: DemoBeats
  /** A tooltip's words. `own` is false when the room has no note yet. */
  cueText: (id: C, note: string, own: boolean) => string
  /** What the live region says at the start, at each take and at the end. */
  readonly copy: {
    readonly watch: string
    readonly off: string
    readonly on: string
    readonly endTitle: string
    readonly micHint: string
  }
  /** What the mic hint after Try it points at. */
  readonly micTarget: T
  /** The engine event that ends a take. */
  readonly endMark: E
  /** Marks that take the tooltip down until the next cue. */
  readonly clearTipOn: readonly DemoMark<E>[]
  /** A first visit opens on the demo. */
  autoPlays: () => boolean
  /** The device has seen the demo: its end card, Skip or Not now. */
  markSeen: () => void
  sound: (ctx: AudioContext, minLead: number) => DemoSoundtrack<Take>
  /** One take as the room's script plays it, on `clock`. */
  take: (take: Take, note: number, clock: TakeClock<E>, still: boolean) => S
}

export interface ExerciseDemo<C extends string, T extends string> {
  /** Off, offering itself (play card), playing, or on its end card. */
  mode: Accessor<DemoMode>
  /** The take on the pill; null outside the takes. */
  take: Accessor<DemoTakeId | null>
  /** The tooltip showing: one of the takes', or the mic hint at rest. */
  tip: Accessor<DemoTip<C, T> | null>
  /** One of a take's fast-forwards is running. */
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

/**
 * A first visit waits for Merc to land before the demo starts, and a demo
 * the app's leaving held back waits as long once the singer is back.
 */
const AUTO_PLAY_MS = 1200
/** How long a first visit waits for sound before the play card. */
const AUDIO_WAIT_MS = 700
/** The longest a demo waits for its sound to be ready (DemoScript.ready). */
export const READY_WAIT_MS = 3000
/** The mic's nudge after Try it, seconds. */
const HINT_SECONDS = 3.2

export function useExerciseDemo<
  C extends string,
  T extends string,
  E extends string,
  Take extends DemoTakeShape<E>,
  S,
>(config: ExerciseDemoConfig<C, T, E, Take, S>): ExerciseDemo<C, T> {
  const { room, cues, beats, copy } = config
  const script = room.script
  const still = prefersReducedMotion()
  const [mode, setMode] = createSignal<DemoMode>('idle')
  const [take, setTake] = createSignal<DemoTakeId | null>(null)
  const [tip, setTip] = createSignal<DemoTip<C, T> | null>(null)
  const [fast, setFast] = createSignal(false)
  const [run, setRun] = createSignal<{ id: number; seconds: number } | null>(
    null,
  )
  const [micPulse, setMicPulse] = createSignal(false)
  const [said, setSaid] = createSignal('')
  /** A first visit's demo is about to start: no hint to flash before it. */
  const [autoPending, setAutoPending] = createSignal(false)
  /** The mic hint: one object, so the tooltip is not placed again. */
  const micHint: DemoTip<C, T> = {
    id: 'mic',
    text: copy.micHint,
    target: config.micTarget,
  }
  /** The room waits for the singer's tap, and nothing else is on. */
  const atRest = (): boolean =>
    mode() === 'idle' &&
    !autoPending() &&
    !script.active() &&
    room.phase() === 'intro'
  const shownTip = createMemo(() => tip() ?? (atRest() ? micHint : null))

  let alive = true
  /** Bumped by every start and stop: older timers fall silent. */
  let generation = 0
  /** Bumped by every request for sound: older answers are dropped. */
  let request = 0
  /**
   * The app left with the page showing, and no tap since, nor the start of
   * a demo it held back.
   */
  let away = false
  /** The app left, and the shell has not said it is back (app-leave.ts). */
  let appAway = false
  /** A first visit's demo the app or the page took away before it started. */
  let held = false
  let sound: DemoSoundtrack<Take> | null = null
  let plan: ReturnType<typeof config.plan> | null = null
  /** The tooltips already cued this run: each shows once. */
  const cued = new Set<C>()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const later = (seconds: number, fn: () => void): void => {
    const mine = generation
    const id = setTimeout(() => {
      timers.delete(id)
      if (alive && mine === generation) fn()
    }, seconds * 1000)
    timers.add(id)
  }

  const show = (next: DemoTip<C, T> | null): void => {
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

  const showCue = (cue: DemoCue<C, E, T>): void => {
    const own = untrack(room.ownNote)
    show({
      id: cue.id,
      text: config.cueText(cue.id, untrack(room.noteName), own),
      target: cue.target,
    })
  }

  const toEnd = (): void => {
    halt()
    setTake(null)
    setMode('end')
    config.markSeen()
    setSaid(copy.endTitle)
  }

  /** A take's event or mark: its tooltips, and what comes after it. */
  const onMark = (id: DemoTakeId, mark: DemoMark<E>): void => {
    for (const cue of cues) {
      const trigger = cue.trigger
      if (trigger.take === id && trigger.mark === mark && !cued.has(cue.id)) {
        cued.add(cue.id)
        later(cue.delay, () => showCue(cue))
      }
    }
    if (mark === 'fast') setFast(true)
    if (mark === 'slow') setFast(false)
    // A moment the room fills itself (Long note's goal, where Merc steps
    // out of the glass to cheer): no tooltip until the next one.
    if (config.clearTipOn.includes(mark)) setTip(null)
    if (mark !== config.endMark) return
    if (id === 'off') later(beats.afterOff, rest)
    else later(beats.afterOn, toEnd)
  }

  const sing = (id: DemoTakeId): void => {
    if (plan === null) return
    const take = plan.takes[id]
    setTip(null)
    const lead = sound?.lead ?? beats.lead
    sound?.sing(take, plan.note)
    script.play(
      config.take(
        take,
        plan.note,
        takeClock(take, performance.now() + lead * 1000, (mark) =>
          onMark(id, mark),
        ),
        still,
      ),
    )
  }

  /** Between the takes: the room empties and the pill turns. */
  function rest(): void {
    setTip(null)
    script.rest()
    setTake('on')
    setSaid(copy.on)
    later(beats.reset, () => sing('on'))
  }

  const begin = (ctx: AudioContext | null): void => {
    halt()
    setAutoPending(false)
    // The sound answered while the app was in the background (a first
    // visit's wait, or a Watch), or once it had left with the page still
    // showing (`away`): no demo behind the singer's back. It offers itself
    // again, unseen, as a hide mid-demo leaves it.
    if (document.visibilityState === 'hidden' || away) {
      setMode('card')
      return
    }
    const note = script.note()
    if (!script.enter(copy.watch)) {
      setMode('idle')
      return
    }
    plan = config.plan(note)
    cued.clear()
    sound = ctx === null ? null : config.sound(ctx, beats.lead)
    setTake(null)
    setMicPulse(false)
    setMode('playing')
    setRun({ id: generation, seconds: plan.total })
    setSaid(copy.watch)
    sound?.tone(note)
    for (const cue of cues) {
      if (cue.trigger.take === 'intro') later(cue.delay, () => showCue(cue))
    }
    later(beats.intro, () => {
      setTake('off')
      setSaid(copy.off)
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

  /** `fn` once the script's sound is ready, if request `mine` stands. */
  const whenReady = (mine: number, fn: () => void): void => {
    const wait = script.ready
    if (wait === undefined) return fn()
    let done = false
    const go = (): void => {
      if (done) return
      done = true
      clearTimeout(cap)
      if (alive && mine === request) fn()
    }
    const cap = setTimeout(go, READY_WAIT_MS)
    void wait().then(go, go)
  }

  const ask = (): void => {
    // A tap: the singer is here.
    away = false
    const mine = ++request
    void soundNow().then(
      (ctx) => {
        if (alive && mine === request) whenReady(mine, () => begin(ctx))
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
    untrack(room.phase) === 'intro'

  const autoPlay = (): void => {
    autoTimer = undefined
    if (!idleIntro()) {
      setAutoPending(false)
      return
    }
    // Only a singer who is here gets this far: a demo held for the app
    // waits for its return.
    away = false
    tellDemoAuto({ step: 'starting' })
    const mine = ++request
    const offer = (): void => {
      clearTimeout(audioWait)
      if (!alive || mine !== request) return
      request += 1
      if (idleIntro()) setMode('card')
      setAutoPending(false)
    }
    audioWait = setTimeout(offer, AUDIO_WAIT_MS)
    void soundNow().then((ctx) => {
      if (ctx === null || mine !== request) return offer()
      clearTimeout(audioWait)
      whenReady(mine, () => {
        if (idleIntro()) begin(ctx)
        setAutoPending(false)
      })
    }, offer)
  }

  const cancelAuto = (): void => {
    if (autoTimer !== undefined) clearTimeout(autoTimer)
    autoTimer = undefined
    held = false
    setAutoPending(false)
  }

  const armAuto = (): void => {
    setAutoPending(true)
    autoTimer = setTimeout(autoPlay, AUTO_PLAY_MS)
    tellDemoAuto({ step: 'waiting', ms: AUTO_PLAY_MS })
  }

  onMount(() => {
    if (config.autoPlays()) armAuto()
  })

  // The room keeps the screen on while the demo plays, and only then: not
  // on its card or its end, and not once it is skipped, left or hidden.
  createEffect(() => script.playing(mode() === 'playing'))

  // The singer got there first (a tap on the mic, a new note): no demo.
  createEffect(
    on(
      room.moment,
      () => {
        cancelAuto()
        // The nudge is done once the singer starts; the hint goes with
        // the room's rest by itself.
        if (room.phase() !== 'intro') setMicPulse(false)
      },
      { defer: true },
    ),
  )

  // The app went to the background: the demo stops where it is and offers
  // itself again; it has not been seen. One that had not started yet, on
  // its timer or still waiting for its sound, is held for the singer's
  // return instead, with every answer on its way dropped.
  const leaveWithTheApp = (): void => {
    const playing = untrack(mode) === 'playing'
    if (!playing && untrack(autoPending)) {
      if (autoTimer !== undefined) clearTimeout(autoTimer)
      autoTimer = undefined
      clearTimeout(audioWait)
      request += 1
      if (!held) tellDemoAuto({ step: 'held' })
      held = true
      return
    }
    if (!playing) return
    cancelAuto()
    request += 1
    halt()
    script.leave()
    setTake(null)
    setRun(null)
    setMode('card')
  }
  // The singer is back, the app active and the page showing: a held demo
  // starts as a first visit's does, while the room is still at its intro.
  const comeBack = (): void => {
    if (!held || appAway || document.visibilityState === 'hidden') return
    held = false
    if (idleIntro() && config.autoPlays()) armAuto()
    else setAutoPending(false)
  }
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') leaveWithTheApp()
    else comeBack()
  }
  document.addEventListener('visibilitychange', onVisibility)
  // Or it went with the page still showing (Control Center, the
  // notification shade): the same, and a demo asked for in the tap just
  // before does not start while the singer is away (`begin`).
  const stopAppLeave = onAppLeave(() => {
    away = true
    appAway = true
    leaveWithTheApp()
  })
  const stopAppReturn = onAppReturn(() => {
    appAway = false
    comeBack()
  })

  onCleanup(() => {
    alive = false
    cancelAuto()
    clearTimeout(audioWait)
    halt()
    document.removeEventListener('visibilitychange', onVisibility)
    stopAppLeave()
    stopAppReturn()
  })

  return {
    mode,
    take,
    tip: shownTip,
    fast,
    run,
    micPulse,
    said,
    canAsk: () => {
      if (mode() !== 'idle' || script.active()) return false
      const phase = room.phase()
      return phase === 'intro' || phase === 'result'
    },
    still,
    ask,
    dismiss: () => {
      setMode('idle')
      config.markSeen()
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
      // The room is back at rest, so the mic hint is up: said once here.
      setSaid(copy.micHint)
      setMicPulse(!still)
      later(HINT_SECONDS, () => setMicPulse(false))
    },
  }
}

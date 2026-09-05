// The tap tuner: a metronome plays on the audio clock, the player taps
// along anywhere on the card, and the median tap-vs-tick offset becomes
// the device's input-latency compensation for rhythm play (WebView
// audio latency on Android makes honest taps register late). All the
// math lives in games/glass/tap-latency.ts (pure, tested); this
// component only schedules ticks and stamps taps with the audio clock.
//
// That clock is the app's shared AudioContext (audio/shared-audio-context.ts):
// the latency measured here is spent judging taps in rhythm play, so both
// have to be read from the same stopwatch.

import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { acquireSharedAudioContext } from '@/audio/shared-audio-context'
import { JOURNEY_CONFIG } from '@/games/glass/journey-config'
import { computeTapLatency, tapOffsets } from '@/games/glass/tap-latency'

const T = JOURNEY_CONFIG.tap
const beatS = 60 / T.calBpm

/** One sharp metronome tick, scheduled at an exact audio-clock time,
 *  through the bus that Cancel can take off the output. */
const tickSound = (
  ctx: AudioContext,
  bus: GainNode,
  at: number,
): OscillatorNode => {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.frequency.value = 880
  g.gain.setValueAtTime(0.4, at)
  g.gain.exponentialRampToValueAtTime(0.001, at + 0.08)
  osc.connect(g)
  g.connect(bus)
  osc.start(at)
  osc.stop(at + 0.1)
  return osc
}

type Phase = 'ready' | 'tapping' | 'result' | 'short'

export function TapTuner(props: {
  onSaved: (ms: number) => void
  onClose: () => void
}) {
  const [phase, setPhase] = createSignal<Phase>('ready')
  const [tapCount, setTapCount] = createSignal(0)
  const [beatsLeft, setBeatsLeft] = createSignal<number>(T.calBeats)
  const [resultMs, setResultMs] = createSignal(0)
  const [gridTaps, setGridTaps] = createSignal(0)

  const lease = acquireSharedAudioContext('tap-tuner')
  let ctx: AudioContext | null = null
  /** The ticks on the clock and the bus they play through, so Cancel --
   *  or the next Start -- can take them off it. Sixteen ticks are eleven
   *  seconds of metronome that used to play on over the next screen. */
  let bus: GainNode | null = null
  let ticks: OscillatorNode[] = []
  let raf = 0
  let firstBeatAt = 0
  let taps: number[] = []

  const silenceTicks = (): void => {
    const audio = ctx
    const out = bus
    const scheduled = ticks
    bus = null
    ticks = []
    if (audio === null || out === null) return
    const now = audio.currentTime
    // Anchor, then decay: a step to zero would click on a tick mid-ring.
    out.gain.cancelScheduledValues(now)
    out.gain.setValueAtTime(out.gain.value, now)
    out.gain.setTargetAtTime(0, now, 0.012)
    for (const osc of scheduled) osc.stop(now + 0.08)
    setTimeout(() => out.disconnect(), 100)
  }

  const finish = (): void => {
    const lat = computeTapLatency(taps, firstBeatAt, beatS, {
      minTaps: T.calMinTaps,
      maxOffFrac: T.calMaxOffFrac,
      clampMs: T.calClampMs,
    })
    if (lat === null) {
      setGridTaps(tapOffsets(taps, firstBeatAt, beatS, T.calMaxOffFrac).length)
      setPhase('short')
      return
    }
    setResultMs(lat.offsetMs)
    setGridTaps(lat.taps)
    setPhase('result')
  }

  const watch = (): void => {
    cancelAnimationFrame(raf)
    const done = firstBeatAt + (T.calBeats - 1) * beatS + 0.6
    const loop = (): void => {
      if (ctx === null) return
      setBeatsLeft(
        Math.max(0, Math.ceil((done - 0.6 - ctx.currentTime) / beatS)),
      )
      if (ctx.currentTime >= done) {
        finish()
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
  }

  /** Runs inside the button click so the AudioContext starts unmuted. */
  const begin = (): void => {
    ctx = lease.ensure()
    if (ctx === null) return
    void lease.unlock().then((ready) => {
      if (!ready || ctx === null) return
      silenceTicks()
      taps = []
      setTapCount(0)
      setBeatsLeft(T.calBeats)
      firstBeatAt = ctx.currentTime + 1
      const out = ctx.createGain()
      out.connect(ctx.destination)
      bus = out
      for (let i = 0; i < T.calBeats; i++) {
        ticks.push(tickSound(ctx, out, firstBeatAt + i * beatS))
      }
      setPhase('tapping')
      watch()
    })
  }

  onMount(() => {
    if (import.meta.env.DEV) {
      ;(window as unknown as { __tt?: () => Record<string, unknown> }).__tt =
        () => ({
          firstBeatAt,
          beatS,
          now: ctx?.currentTime ?? -1,
          taps: taps.length,
          phase: phase(),
        })
    }
  })
  onCleanup(() => {
    cancelAnimationFrame(raf)
    silenceTicks()
    ctx = null
    // The context is the app's; closing it would cost a gesture to get back.
    lease.release()
  })

  const onTap = (e: PointerEvent): void => {
    if (phase() !== 'tapping' || ctx === null) return
    if ((e.target as HTMLElement).closest('button') !== null) return
    taps.push(ctx.currentTime)
    setTapCount(taps.length)
  }

  return (
    <div
      class="range-finder tap-tuner"
      role="group"
      aria-label="Tune tap timing"
      onPointerDown={onTap}
    >
      <Show when={phase() === 'ready'}>
        <p class="range-finder__title">Tap along with the tick</p>
        <p class="range-finder__sub">
          {T.calBeats} ticks will play — tap anywhere on this card, on every
          tick. The offset between your taps and the ticks becomes this device's
          tap timing.
        </p>
        <div class="range-finder__row">
          <button class="games-range__pick" type="button" onClick={begin}>
            Start the ticks
          </button>
          <button
            class="games-range__pick"
            type="button"
            onClick={() => props.onClose()}
          >
            Cancel
          </button>
        </div>
      </Show>

      <Show when={phase() === 'tapping'}>
        <p class="range-finder__title">Keep tapping on the tick</p>
        <p class="range-finder__sub">
          {beatsLeft()} ticks to go — taps so far: {tapCount()}.
        </p>
        <div class="range-finder__row">
          <button
            class="games-range__pick"
            type="button"
            onClick={() => props.onClose()}
          >
            Cancel
          </button>
        </div>
      </Show>

      <Show when={phase() === 'result'}>
        <p class="range-finder__title">
          {resultMs() === 0
            ? 'Your taps sit right on the tick'
            : `Your taps land ${Math.abs(resultMs())} ms ${
                resultMs() > 0 ? 'late' : 'early'
              }`}
        </p>
        <p class="range-finder__sub">
          Measured over {gridTaps()} taps — rhythm play will judge with this
          offset.
        </p>
        <div class="range-finder__row">
          <button
            class="games-range__pick"
            type="button"
            onClick={() => props.onSaved(resultMs())}
          >
            Save
          </button>
          <button class="games-range__pick" type="button" onClick={begin}>
            Again
          </button>
          <button
            class="games-range__pick"
            type="button"
            onClick={() => props.onClose()}
          >
            Cancel
          </button>
        </div>
      </Show>

      <Show when={phase() === 'short'}>
        <p class="range-finder__title">Not enough taps landed on the grid</p>
        <p class="range-finder__sub">
          Only {gridTaps()} lined up with the ticks ({T.calMinTaps} needed) —
          one more try?
        </p>
        <div class="range-finder__row">
          <button class="games-range__pick" type="button" onClick={begin}>
            Again
          </button>
          <button
            class="games-range__pick"
            type="button"
            onClick={() => props.onClose()}
          >
            Cancel
          </button>
        </div>
      </Show>
    </div>
  )
}

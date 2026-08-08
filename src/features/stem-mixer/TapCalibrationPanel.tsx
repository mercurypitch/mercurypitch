// ============================================================
// TapCalibrationPanel — measure the operator's reaction offset
// ============================================================
//
// Plays a steady click, collects taps, and reports the median signed error as
// a reaction offset in ms. The mapper then subtracts that from every tap.
//
// Two details that decide whether the number means anything:
//
//  - Taps are timed against the *audio* clock (`ctx.currentTime`), not
//    `Date.now()`, because the clicks themselves are scheduled on it.
//  - The click is heard one output-latency later than it is scheduled, so the
//    reference time adds `outputLatency`. Without that the measurement folds
//    the device's own buffer delay into the operator's reaction time and
//    over-corrects every tap for the rest of the session.

import { createSignal, For, onCleanup, Show } from 'solid-js'
import { spreadMs } from '@/lib/calibration-stats'
import { buildClickSchedule, CALIBRATION_CLICK_COUNT, CALIBRATION_INTERVAL_SEC, CALIBRATION_LEAD_IN_SEC, medianOffsetMs, MIN_CALIBRATION_TAPS, nearestClickDelta, } from '@/lib/tap-calibration'

export interface TapCalibrationPanelProps {
  currentOffsetMs: number
  onApply: (offsetMs: number) => void
  onClose: () => void
}

type Phase = 'idle' | 'running' | 'done'

export function TapCalibrationPanel(props: TapCalibrationPanelProps) {
  const [phase, setPhase] = createSignal<Phase>('idle')
  const [hits, setHits] = createSignal(0)
  const [result, setResult] = createSignal<number | null>(null)
  const [spread, setSpread] = createSignal<number | null>(null)

  let ctx: AudioContext | null = null
  let schedule: number[] = []
  let deltas: number[] = []
  let finishTimer: ReturnType<typeof setTimeout> | undefined
  let keyHandler: ((e: KeyboardEvent) => void) | undefined
  // Plain mirror of `phase() === 'running'`. The timer and the key handler
  // fire outside any tracked scope, so they must not read the signal.
  let running = false

  const teardown = () => {
    running = false
    if (finishTimer !== undefined) {
      clearTimeout(finishTimer)
      finishTimer = undefined
    }
    if (keyHandler !== undefined) {
      window.removeEventListener('keydown', keyHandler, true)
      keyHandler = undefined
    }
    if (ctx !== null) {
      void ctx.close().catch(() => {})
      ctx = null
    }
  }

  onCleanup(teardown)

  /** Short sine burst with ramps at both ends — a bare start/stop pops. */
  const scheduleClick = (audio: AudioContext, at: number) => {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'sine'
    osc.frequency.value = 1000
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(0.35, at + 0.004)
    gain.gain.linearRampToValueAtTime(0, at + 0.045)
    osc.connect(gain).connect(audio.destination)
    osc.start(at)
    osc.stop(at + 0.06)
  }

  const finish = () => {
    if (!running) return
    teardown()
    setResult(medianOffsetMs(deltas))
    setSpread(spreadMs(deltas))
    setPhase('done')
  }

  const registerTap = () => {
    if (!running || ctx === null) return
    const delta = nearestClickDelta(schedule, ctx.currentTime)
    if (delta === null) return
    deltas.push(delta)
    setHits(deltas.length)
  }

  const start = () => {
    teardown()
    deltas = []
    setHits(0)
    setResult(null)
    setSpread(null)

    const audio = new AudioContext()
    ctx = audio
    void audio.resume().catch(() => {})

    // The click sounds one output-latency after it is scheduled; the operator
    // reacts to what they hear, so that is what taps are measured against.
    const latency = audio.outputLatency || audio.baseLatency || 0
    const firstClick = audio.currentTime + CALIBRATION_LEAD_IN_SEC
    const scheduled = buildClickSchedule(firstClick)
    for (const at of scheduled) scheduleClick(audio, at)
    schedule = scheduled.map((at) => at + latency)

    keyHandler = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return
      // Keydown, not the button's own click: a focused button fires click on
      // key*up* for Space, which would add release time to every sample.
      e.preventDefault()
      e.stopPropagation()
      registerTap()
    }
    window.addEventListener('keydown', keyHandler, true)

    const runFor =
      CALIBRATION_LEAD_IN_SEC +
      CALIBRATION_CLICK_COUNT * CALIBRATION_INTERVAL_SEC
    running = true
    finishTimer = setTimeout(finish, runFor * 1000)
    setPhase('running')
  }

  return (
    <div class="sm-lyrics-calib" role="group" aria-label="Reaction calibration">
      <div class="sm-lyrics-calib-head">
        <span class="sm-lyrics-calib-title">Reaction calibration</span>
        <button
          class="sm-lyrics-calib-close"
          onClick={() => {
            teardown()
            props.onClose()
          }}
          aria-label="Close calibration"
        >
          <svg viewBox="0 0 24 24" width="11" height="11">
            <path
              fill="currentColor"
              d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"
            />
          </svg>
        </button>
      </div>

      <Show when={phase() === 'idle'}>
        <p class="sm-lyrics-calib-copy">
          Tap once on each of {CALIBRATION_CLICK_COUNT} clicks — space, enter,
          or the button. Everyone taps a little after the sound they are
          reacting to; this measures by how much, and the mapper then subtracts
          it so your marks land on the word instead of just after it. There is
          no good or bad score.
        </p>
        <button class="sm-lyrics-calib-start" onClick={start}>
          Start
        </button>
      </Show>

      <Show when={phase() === 'running'}>
        <div class="sm-lyrics-calib-dots" aria-hidden="true">
          <For each={Array.from({ length: CALIBRATION_CLICK_COUNT })}>
            {(_, i) => (
              <span
                classList={{
                  'sm-lyrics-calib-dot': true,
                  'sm-lyrics-calib-dot--hit': i() < hits(),
                }}
              />
            )}
          </For>
        </div>
        <button
          class="sm-lyrics-calib-tap"
          onClick={registerTap}
          aria-label="Tap with the click"
        >
          Tap
        </button>
        <span class="sm-lyrics-calib-count" aria-live="polite">
          {hits()}/{CALIBRATION_CLICK_COUNT}
        </span>
      </Show>

      <Show when={phase() === 'done'}>
        <Show
          when={result() !== null}
          fallback={
            <p class="sm-lyrics-calib-copy">
              Only {hits()} taps landed near a click — {MIN_CALIBRATION_TAPS}{' '}
              are needed. Try again.
            </p>
          }
        >
          <p class="sm-lyrics-calib-result">
            <strong>{result()} ms</strong>
            <span class="sm-lyrics-calib-spread">
              your reaction time — 150-250 ms is typical
            </span>
          </p>
          <Show when={spread() !== null}>
            <span class="sm-lyrics-calib-was">
              {/* The warning belongs to consistency, not to the offset itself:
                  a 150ms reaction is perfectly normal, ten scattered taps are
                  what make the median untrustworthy. */}
              taps varied by {spread()} ms
              {(spread() ?? 0) > 80
                ? ' — scattered, so this median is shaky; worth another run'
                : ' — consistent'}
            </span>
          </Show>
          <span class="sm-lyrics-calib-was">
            replaces {props.currentOffsetMs} ms
          </span>
        </Show>
        <div class="sm-lyrics-calib-actions">
          <button class="sm-lyrics-calib-start" onClick={start}>
            Again
          </button>
          <Show when={result() !== null}>
            <button
              class="sm-lyrics-calib-apply"
              onClick={() => {
                const value = result()
                if (value !== null) props.onApply(value)
                props.onClose()
              }}
            >
              Apply
            </button>
          </Show>
        </div>
      </Show>
    </div>
  )
}

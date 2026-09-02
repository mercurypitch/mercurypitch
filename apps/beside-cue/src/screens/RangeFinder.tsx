// The guided range-finder: hum a comfortable note, then your lowest,
// then your highest — the "Songs sit" setting is computed from the
// measured range (computeRangeFit) instead of picked as a preference.
// All decisions live in games/glass/range-finder.ts (pure, tested);
// this component feeds it mic pitch through the sing driver and renders
// the three asks. The mic stops the moment the last note locks.

import { applyPreferredInput } from '@irchiinnuss/audio-io'
import { MicInput } from '@irchiinnuss/audio-io/solid'
import { midiToNoteNameOctave } from '@irchiinnuss/pitch-engine'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { createSingDriver } from '@/games/glass/drivers/sing'
import type { InteractionDriver } from '@/games/glass/drivers/types'
import { createGameVoice } from '@/games/glass/game-voice'
import { JOURNEY_CONFIG } from '@/games/glass/journey-config'
import type { RangeFit } from '@/games/glass/range-finder'
import { computeRangeFit, createSteadyDetector, } from '@/games/glass/range-finder'

const RF = JOURNEY_CONFIG.rangeFinder
const name = (midi: number): string => midiToNoteNameOctave(Math.round(midi))

type Step = 'comfy' | 'low' | 'high' | 'result' | 'error'

const ASK: Record<'comfy' | 'low' | 'high', { title: string; sub: string }> = {
  comfy: {
    title: 'Hum a comfortable note',
    sub: 'Wherever your voice naturally sits — hold it steady.',
  },
  low: {
    title: 'Now your lowest note',
    sub: 'Slide down as far as stays comfortable, and hold.',
  },
  high: {
    title: 'Now your highest note',
    sub: 'Slide up as far as stays comfortable, and hold.',
  },
}

const biasSentence = (n: number): string => {
  if (n === 0)
    return 'Your hum already sits at the center of your range — songs stay centered.'
  const s = Math.abs(n) === 1 ? 'semitone' : 'semitones'
  return n < 0
    ? `Songs will sit ${-n} ${s} lower to fit your voice.`
    : `Songs will sit ${n} ${s} higher to fit your voice.`
}

export function RangeFinder(props: {
  onFit: (fit: RangeFit) => void
  onClose: () => void
}) {
  const [step, setStep] = createSignal<Step>('comfy')
  const [live, setLive] = createSignal<string | null>(null)
  const [held, setHeld] = createSignal(0)
  const [resultTitle, setResultTitle] = createSignal('')
  const [resultSub, setResultSub] = createSignal('')

  let driver: InteractionDriver | null = null
  let raf = 0
  let det = createSteadyDetector(RF.holdMs, RF.tolSemis)
  let comfy = 0
  let lo = 0
  let fitVal: RangeFit | null = null
  // after each lock: require a beat of silence so one held note cannot
  // lock two steps in a row
  let waitSilence = false
  let silenceStart: number | null = null

  const hum = (midi: number): void => {
    voice.note(midi, RF.humSeconds)
  }

  const stopDriver = (): void => {
    driver?.stop()
    driver = null
  }

  const finish = (hi: number): void => {
    cancelAnimationFrame(raf)
    // let the confirmation hum ring out before the mic context closes
    window.setTimeout(stopDriver, RF.humSeconds * 1000 + 150)
    fitVal = computeRangeFit(comfy, lo, hi, RF.clampSemis)
    setResultTitle(
      `Your range: ${name(fitVal.loMidi)} – ${name(fitVal.hiMidi)}`,
    )
    setResultSub(biasSentence(fitVal.biasSemis))
    setStep('result')
  }

  const tick = (): void => {
    raf = requestAnimationFrame(tick)
    const t = performance.now()
    const sample = driver?.latestPitch() ?? null
    setLive(sample !== null ? name(sample.midi) : null)
    if (waitSilence) {
      if (sample !== null) {
        silenceStart = null
      } else {
        silenceStart ??= t
        if (t - silenceStart >= RF.stepSilenceMs) waitSilence = false
      }
      setHeld(0)
      return
    }
    const locked = det.push(t, sample?.midi ?? null)
    setHeld(det.progress(t))
    if (locked === null) return
    hum(locked)
    det = createSteadyDetector(RF.holdMs, RF.tolSemis)
    waitSilence = true
    silenceStart = null
    const at = step()
    if (at === 'comfy') {
      comfy = locked
      setStep('low')
    } else if (at === 'low') {
      lo = locked
      setStep('high')
    } else if (at === 'high') {
      finish(locked)
    }
  }

  // The same instrument the games play, so a note demonstrated here and
  // the same note in a level are recognisably one sound.
  const voice = createGameVoice('range-finder-voice')

  /** Open (or re-open) the microphone on the remembered input. */
  const listen = (): void => {
    stopDriver()
    const next = createSingDriver('range-finder')
    driver = next
    void applyPreferredInput()
      .then(() => next.start())
      .then(() => {
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(tick)
      })
      .catch(() => {
        stopDriver()
        setStep('error')
      })
  }

  onMount(() => {
    voice.start()
    listen()
  })
  onCleanup(() => {
    cancelAnimationFrame(raf)
    voice.dispose()
    stopDriver()
  })

  const singing = (): boolean =>
    step() === 'comfy' || step() === 'low' || step() === 'high'
  const ask = () => ASK[step() as 'comfy' | 'low' | 'high']

  return (
    <div class="range-finder" role="group" aria-label="Find my range">
      <Show when={singing()}>
        <p class="range-finder__title">{ask().title}</p>
        <p class="range-finder__sub">{ask().sub}</p>
        <div class="range-finder__meter">
          <span class="range-finder__note">{live() ?? '···'}</span>
          <span class="range-finder__bar" aria-hidden="true">
            <span style={{ width: `${held() * 100}%` }} />
          </span>
        </div>
        <MicInput listening onChoose={() => listen()} />
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

      <Show when={step() === 'result'}>
        <p class="range-finder__title">{resultTitle()}</p>
        <p class="range-finder__sub">{resultSub()}</p>
        <div class="range-finder__row">
          <button
            class="games-range__pick"
            type="button"
            onClick={() => {
              if (fitVal !== null) props.onFit(fitVal)
            }}
          >
            Use this fit
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

      <Show when={step() === 'error'}>
        <p class="range-finder__title">The microphone is not available</p>
        <p class="range-finder__sub">
          Allow mic access to sing your range — the presets above work without
          it.
        </p>
        <div class="range-finder__row">
          <button
            class="games-range__pick"
            type="button"
            onClick={() => props.onClose()}
          >
            Close
          </button>
        </div>
      </Show>
    </div>
  )
}

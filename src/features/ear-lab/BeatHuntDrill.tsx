// ============================================================
// BeatHuntDrill — 2AFC beat detection.
//
// Two pairs of tones, one in tune with itself and one detuned by the
// staircase's level in cents; which pair was beating. The base is
// roved so the beat rate — the difference of the two frequencies —
// is what the ear has to find, not a remembered tone. Order is a
// coin flip; the pairs go through dyad-synth so the in-tune pair's
// loudness is no clue.
//
// The instrument is two pairs of pendulums: the sounding pair
// swings, both bobs together; only the reveal hangs the detuned
// pair's second bob out of phase and names the rate.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { beatRateHz, beatWord, detuneHz } from '@/lib/ear/beat'
import { findThresholdDrill } from '@/lib/ear/drills'
import { BEAT_TIMING } from '@/lib/ear/timing'
import { latestThresholdReading } from '@/stores/ear-lab-store'
import { BeatPendulums } from './BeatPendulums'
import type { ScheduledDyad } from './dyad-synth'
import { randomPhaseS, scheduleDyad } from './dyad-synth'
import { useEarRoom } from './ear-room-context'
import type { PadState } from './EarStage'
import { Pads, StagePad } from './EarStage'
import { ThresholdDrillView } from './ThresholdDrillView'
import type { StimulusApi } from './use-threshold-run'
import { useThresholdRun } from './use-threshold-run'

interface BeatHuntDrillProps {
  onBack: () => void
}

/** Rove the base log-uniformly across A2..~E4: low enough that a
 *  few cents beat slowly, high enough to hear cleanly on a phone. */
function roveBaseHz(random: () => number): number {
  return 110 * 2 ** (random() * 1.5)
}

export function BeatHuntDrill(props: BeatHuntDrillProps): JSX.Element {
  const { audioEngine } = useEngines()
  const room = useEarRoom()
  const drill = findThresholdDrill('beat-hunt')
  if (!drill) throw new Error('beat-hunt drill missing from catalogue')

  const [detunedFirst, setDetunedFirst] = createSignal(false)
  const [picked, setPicked] = createSignal<1 | 2 | null>(null)
  const [sounding, setSounding] = createSignal<0 | 1 | 2>(0)
  const [rateHz, setRateHz] = createSignal(0)
  let scheduled: ScheduledDyad[] = []
  let timers: Array<ReturnType<typeof setTimeout>> = []

  function cancelStimulus(): void {
    for (const timer of timers) clearTimeout(timer)
    timers = []
    for (const dyad of scheduled) dyad.cancel()
    scheduled = []
    setSounding(0)
  }

  async function playStimulus(level: number, api: StimulusApi): Promise<void> {
    await audioEngine.init()
    await audioEngine.resume()
    const ctx = audioEngine.getAudioContext()
    if (!ctx || api.cancelled()) return

    cancelStimulus()
    const base = roveBaseHz(Math.random)
    const first = Math.random() < 0.5
    setDetunedFirst(first)
    setPicked(null)
    setRateHz(beatRateHz(base, level))

    const start = ctx.currentTime + BEAT_TIMING.leadInS
    const lenS = BEAT_TIMING.dyadMs / 1000
    const gapS = BEAT_TIMING.gapMs / 1000
    const gainLevel = room.volume() * audioEngine.getVolume()

    for (const pair of [1, 2] as const) {
      const detuned = (pair === 1) === first
      const hzB = detuned ? detuneHz(base, level) : base
      const at = start + (pair - 1) * (lenS + gapS)
      scheduled.push(
        scheduleDyad(ctx, at, {
          hzA: base,
          hzB,
          lenS,
          gainLevel,
          phaseS: randomPhaseS(hzB, Math.random),
        }),
      )
      const onMs = (BEAT_TIMING.leadInS + (pair - 1) * (lenS + gapS)) * 1000
      timers.push(
        setTimeout(() => {
          if (api.cancelled()) return
          setSounding(pair)
          api.step(pair)
        }, onMs),
      )
      timers.push(
        setTimeout(() => {
          if (!api.cancelled()) setSounding(0)
        }, onMs + BEAT_TIMING.dyadMs),
      )
    }

    await new Promise<void>((resolve) => {
      timers.push(
        setTimeout(
          () => resolve(),
          (BEAT_TIMING.leadInS + 2 * lenS + gapS) * 1000 + BEAT_TIMING.tailMs,
        ),
      )
    })
  }

  const run = useThresholdRun(drill, playStimulus, { cancelStimulus })

  const detunedPair = (): 1 | 2 => (detunedFirst() ? 1 : 2)
  const pairWord = () => (detunedFirst() ? 'first' : 'second')

  const answer = (pair: 1 | 2) => {
    if (run.phase() !== 'answer') return
    setPicked(pair)
    run.answerCorrect(pair === detunedPair())
  }

  const padState = (pair: 1 | 2): PadState => {
    if (run.phase() !== 'reveal') return null
    if (pair === detunedPair()) return 'right'
    if (pair === picked()) return 'wrong'
    return null
  }

  const detune = () => `${run.level().toFixed(1)}¢`

  return (
    <ThresholdDrillView
      title="Beat Hunt"
      drillId="beat-hunt"
      measures="Resolution · beats"
      description="Two pairs of tones. One pair is in tune with itself; in the other, one tone is pulled a few cents off, and the pair beats — a slow swell and fade where the two waves fall in and out of step. Find the beating pair. The detune shrinks toward the finest beat your ear still catches; that number, in cents, is your reading."
      prompt="Two pairs of tones — which pair was beating?"
      listenHint="Listen…"
      answerHint="Which pair was beating — the first, or the second?"
      levelCaption="Detune"
      levelLabel={detune}
      formatValue={(value) => value.toFixed(1)}
      unitLabel="cents detune"
      unitShort="¢"
      latestValue={() => latestThresholdReading('beat-hunt')?.value ?? null}
      run={run}
      instrument={() => (
        <BeatPendulums
          sounding={run.phase() === 'stimulus' ? sounding() : 0}
          reveal={
            run.phase() === 'reveal'
              ? { pair: detunedPair(), rateHz: rateHz() }
              : null
          }
        />
      )}
      pads={() => (
        <Pads columns={2} label="Which pair was beating?">
          <StagePad
            keycap="1"
            label="The first"
            state={padState(1)}
            disabled={run.phase() !== 'answer'}
            onClick={() => answer(1)}
          />
          <StagePad
            keycap="2"
            label="The second"
            state={padState(2)}
            disabled={run.phase() !== 'answer'}
            onClick={() => answer(2)}
          />
        </Pads>
      )}
      keys={() => [
        { key: '1', action: () => answer(1) },
        { key: '2', action: () => answer(2) },
      ]}
      revealLine={() =>
        run.lastCorrect() === true
          ? `Right — the ${pairWord()} pair was beating, ${beatWord(rateHz())} at ${detune()}.`
          : `The ${pairWord()} pair was beating, ${beatWord(rateHz())} at ${detune()}. The detune widens.`
      }
      onBack={props.onBack}
    />
  )
}

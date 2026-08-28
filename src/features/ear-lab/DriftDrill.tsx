// ============================================================
// DriftDrill — tempo drift detection, three ways.
//
// A click train holds its tempo for five clicks, then for six more
// it gains the staircase's level in percent, loses it, or holds —
// a third each, the steady third being the catch. Steady, faster or
// slower. The reading is the smallest drift the ear still catches,
// in percent of tempo.
//
// The instrument is a metronome whose lamps light click by click at
// even spacing and whose arm stays upright until the reveal, when it
// leans the way the tempo went.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import type { DriftWay } from '@/lib/ear/beat'
import { driftOnsetsMs, pickDriftWay } from '@/lib/ear/beat'
import { findThresholdDrill } from '@/lib/ear/drills'
import { DRIFT_TIMING } from '@/lib/ear/timing'
import { latestThresholdReading } from '@/stores/ear-lab-store'
import type { ScheduledClick } from './click-synth'
import { scheduleClick } from './click-synth'
import { useEarRoom } from './ear-room-context'
import type { PadState } from './EarStage'
import { Pads, StagePad } from './EarStage'
import { MetronomeColumn } from './MetronomeColumn'
import { ThresholdDrillView } from './ThresholdDrillView'
import type { StimulusApi } from './use-threshold-run'
import { useThresholdRun } from './use-threshold-run'

interface DriftDrillProps {
  onBack: () => void
}

const WAYS: ReadonlyArray<{ way: DriftWay; label: string; key: string }> = [
  { way: 'steady', label: 'Steady', key: '1' },
  { way: 'faster', label: 'Faster', key: '2' },
  { way: 'slower', label: 'Slower', key: '3' },
]

const CLICKS = DRIFT_TIMING.steadyClicks + DRIFT_TIMING.driftClicks

export function DriftDrill(props: DriftDrillProps): JSX.Element {
  const { audioEngine } = useEngines()
  const room = useEarRoom()
  const drill = findThresholdDrill('drift')
  if (!drill) throw new Error('drift drill missing from catalogue')

  const [way, setWay] = createSignal<DriftWay>('steady')
  const [picked, setPicked] = createSignal<DriftWay | null>(null)
  let scheduled: ScheduledClick[] = []
  let timers: Array<ReturnType<typeof setTimeout>> = []

  function cancelStimulus(): void {
    for (const timer of timers) clearTimeout(timer)
    timers = []
    for (const click of scheduled) click.cancel()
    scheduled = []
  }

  async function playStimulus(level: number, api: StimulusApi): Promise<void> {
    await audioEngine.init()
    await audioEngine.resume()
    const ctx = audioEngine.getAudioContext()
    if (!ctx || api.cancelled()) return

    cancelStimulus()
    const current = pickDriftWay(Math.random)
    setWay(current)
    setPicked(null)
    const onsets = driftOnsetsMs(
      DRIFT_TIMING.periodMs,
      level,
      current,
      DRIFT_TIMING.steadyClicks,
      DRIFT_TIMING.driftClicks,
    )
    const start = ctx.currentTime + DRIFT_TIMING.leadInS
    const click = {
      voice: room.clickVoice(),
      gainLevel: room.volume() * audioEngine.getVolume(),
    }
    for (const [i, onset] of onsets.entries()) {
      scheduled.push(scheduleClick(ctx, start + onset / 1000, click))
      timers.push(
        setTimeout(
          () => {
            if (!api.cancelled()) api.step(i + 1)
          },
          DRIFT_TIMING.leadInS * 1000 + onset,
        ),
      )
    }
    await new Promise<void>((resolve) => {
      timers.push(
        setTimeout(
          () => resolve(),
          DRIFT_TIMING.leadInS * 1000 +
            (onsets[onsets.length - 1] ?? 0) +
            DRIFT_TIMING.tailMs,
        ),
      )
    })
  }

  const run = useThresholdRun(drill, playStimulus, { cancelStimulus })

  const answer = (choice: DriftWay) => {
    if (run.phase() !== 'answer') return
    setPicked(choice)
    run.answerCorrect(choice === way())
  }

  const padState = (choice: DriftWay): PadState => {
    if (run.phase() !== 'reveal') return null
    if (choice === way()) return 'right'
    if (choice === picked()) return 'wrong'
    return null
  }

  const percent = () => {
    const level = run.level()
    return `${level < 3 ? level.toFixed(1) : level.toFixed(0)}%`
  }

  const wentWord = () =>
    way() === 'steady'
      ? 'held steady'
      : `${way() === 'faster' ? 'gained' : 'lost'} ${percent()}`

  return (
    <ThresholdDrillView
      title="Drift"
      drillId="drift"
      measures="Time · tempo"
      description="Eleven clicks. The first five hold their tempo; the rest gain a little, lose a little, or hold. Say which. The drift shrinks toward the smallest change of tempo you still catch — that number, in percent, is your reading. A third of the trains hold steady, so guessing a direction will not carry you."
      prompt="A click train — did the tempo hold, gain, or lose?"
      listenHint="Listen to the train…"
      answerHint="Did the tempo hold steady, gain, or lose?"
      levelCaption="Drift"
      levelLabel={percent}
      formatValue={(value) => (value < 3 ? value.toFixed(1) : value.toFixed(0))}
      unitLabel="% tempo"
      unitShort="%"
      latestValue={() => latestThresholdReading('drift')?.value ?? null}
      run={run}
      instrument={() => (
        <MetronomeColumn
          count={CLICKS}
          lit={run.phase() === 'stimulus' ? run.stimulusStep() : 0}
          steady={DRIFT_TIMING.steadyClicks}
          reveal={
            run.phase() === 'reveal'
              ? { way: way(), percent: percent().replace('%', '') }
              : null
          }
        />
      )}
      pads={() => (
        <Pads columns={3} label="Did the tempo hold, gain, or lose?">
          <For each={WAYS}>
            {(choice) => (
              <StagePad
                keycap={choice.key}
                label={choice.label}
                state={padState(choice.way)}
                disabled={run.phase() !== 'answer'}
                onClick={() => answer(choice.way)}
              />
            )}
          </For>
        </Pads>
      )}
      keys={() =>
        WAYS.map((choice) => ({
          key: choice.key,
          action: () => answer(choice.way),
        }))
      }
      revealLine={() =>
        run.lastCorrect() === true
          ? `Right — it ${wentWord()}.`
          : `It ${wentWord()}. The drift widens.`
      }
      onBack={props.onBack}
    />
  )
}

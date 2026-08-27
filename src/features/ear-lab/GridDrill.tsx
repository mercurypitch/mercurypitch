// ============================================================
// GridDrill — The Grid: timing resolution in milliseconds.
//
// Six clicks on a steady lattice, one of the last four nudged off
// it by the staircase's current level; say which. Perception only
// — no tapping — so the round trip the app's latency wizard measures
// never contaminates the reading: the stimulus is scheduled
// sample-accurately on the audio clock (click-synth) and the
// answer is a button.
//
// The lattice's chase light steps ON THE GRID as the clicks land,
// and deliberately never shows which click was off; the reveal
// pushes the off pallet out of line, early or late.
//
// Scheduled clicks are held as handles so Stop can silence a
// stimulus already committed to the audio clock.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal, For } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { findThresholdDrill } from '@/lib/ear/drills'
import type { GridPattern } from '@/lib/ear/grid-pattern'
import { generateGridPattern, GRID_ANSWER_POSITIONS, gridPatternDuration, } from '@/lib/ear/grid-pattern'
import { GRID_TIMING } from '@/lib/ear/timing'
import { latestThresholdReading } from '@/stores/ear-lab-store'
import type { ScheduledClick } from './click-synth'
import { scheduleClick } from './click-synth'
import type { PadState } from './EarStage'
import { Pads, StagePad } from './EarStage'
import { EscapementLattice } from './EscapementLattice'
import { ThresholdDrillView } from './ThresholdDrillView'
import type { StimulusApi } from './use-threshold-run'
import { useThresholdRun } from './use-threshold-run'

interface GridDrillProps {
  onBack: () => void
}

const POSITION_LABELS: Record<number, string> = {
  2: 'Third',
  3: 'Fourth',
  4: 'Fifth',
  5: 'Sixth',
}

const ORDINALS: Record<number, string> = {
  2: 'third',
  3: 'fourth',
  4: 'fifth',
  5: 'sixth',
}

export function GridDrill(props: GridDrillProps): JSX.Element {
  const { audioEngine } = useEngines()
  const drill = findThresholdDrill('the-grid')
  if (!drill) throw new Error('the-grid drill missing from catalogue')

  const [pattern, setPattern] = createSignal<GridPattern | null>(null)
  const [picked, setPicked] = createSignal<number | null>(null)
  let scheduled: ScheduledClick[] = []
  let stepTimers: Array<ReturnType<typeof setTimeout>> = []

  /** Silence the whole stimulus: the pending pallet timers AND the
   *  oscillators already handed to the audio clock. Clearing the
   *  timers alone would leave the clicks sounding. */
  function cancelStimulus(): void {
    for (const timer of stepTimers) clearTimeout(timer)
    stepTimers = []
    for (const click of scheduled) click.cancel()
    scheduled = []
  }

  async function playStimulus(level: number, api: StimulusApi): Promise<void> {
    await audioEngine.init()
    await audioEngine.resume()
    const ctx = audioEngine.getAudioContext()
    if (!ctx || api.cancelled()) return

    cancelStimulus()

    const current = generateGridPattern(level)
    setPattern(current)
    setPicked(null)
    const start = ctx.currentTime + GRID_TIMING.leadInS

    for (const [i, offset] of current.clickTimes.entries()) {
      scheduled.push(scheduleClick(ctx, start + offset))
      // The chase light rides on setTimeout — close enough for eyes;
      // only the audio needs (and gets) the sample-accurate clock.
      stepTimers.push(
        setTimeout(
          () => {
            if (!api.cancelled()) api.step(i + 1)
          },
          (GRID_TIMING.leadInS + offset) * 1000,
        ),
      )
    }

    await new Promise<void>((resolve) => {
      stepTimers.push(
        setTimeout(
          () => resolve(),
          (GRID_TIMING.leadInS + gridPatternDuration(current)) * 1000 +
            GRID_TIMING.tailMs,
        ),
      )
    })
  }

  const run = useThresholdRun(drill, playStimulus, { cancelStimulus })

  const answer = (position: number) => {
    if (run.phase() !== 'answer') return
    setPicked(position)
    run.answerCorrect(position === pattern()?.displacedIndex)
  }

  const padState = (position: number): PadState => {
    if (run.phase() !== 'reveal') return null
    if (position === pattern()?.displacedIndex) return 'right'
    if (position === picked()) return 'wrong'
    return null
  }

  const early = () => (pattern()?.shiftMs ?? 0) < 0
  const offset = () => `${run.level().toFixed(0)} ms`

  return (
    <ThresholdDrillView
      title="The Grid"
      drillId="the-grid"
      measures="Time · milliseconds"
      description="Six clicks on a perfectly steady grid — except one of the last four, nudged early or late. Say which. The nudge keeps shrinking toward the finest timing flaw your ear still catches, in milliseconds. Perception only: you never tap, so your device's round trip is not in this number."
      prompt="Six clicks on a steady grid. One of the last four is early or late."
      listenHint="Listen to the lattice…"
      answerHint="Which click was off — third, fourth, fifth, or sixth?"
      levelCaption="Offset"
      levelLabel={offset}
      formatValue={(value) => value.toFixed(0)}
      unitLabel="ms"
      unitShort=" ms"
      latestValue={() => latestThresholdReading('the-grid')?.value ?? null}
      run={run}
      instrument={() => (
        <EscapementLattice
          lit={run.phase() === 'stimulus' ? run.stimulusStep() : 0}
          running={run.phase() === 'stimulus'}
          reveal={
            run.phase() === 'reveal' && pattern()
              ? { index: pattern()?.displacedIndex ?? 0, early: early() }
              : null
          }
        />
      )}
      pads={() => (
        <Pads columns={4} label="Which click was off?">
          <For each={[...GRID_ANSWER_POSITIONS]}>
            {(position) => (
              <StagePad
                keycap={String(position + 1)}
                label={POSITION_LABELS[position]}
                state={padState(position)}
                disabled={run.phase() !== 'answer'}
                onClick={() => answer(position)}
              />
            )}
          </For>
        </Pads>
      )}
      keys={() =>
        [...GRID_ANSWER_POSITIONS].map((position) => ({
          key: String(position + 1),
          action: () => answer(position),
        }))
      }
      revealLine={() => {
        const ordinal = ORDINALS[pattern()?.displacedIndex ?? 2]
        const way = early() ? 'early' : 'late'
        return run.lastCorrect() === true
          ? `Right — the ${ordinal} click was ${way} by ${offset()}.`
          : `It was the ${ordinal}, ${way} by ${offset()}. The offset widens.`
      }}
      onBack={props.onBack}
    />
  )
}

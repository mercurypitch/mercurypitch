// ============================================================
// WeightDrill — Weight: which render carries the heavier low end?
//
// The same slice twice, one with a low shelf under 120 Hz at the
// staircase's level in dB, the two matched for loudness so the
// heavier one is never the louder one; two pads. Practice only,
// under the desk's own id.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal, For } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { DESK_DRILLS, lowShelf } from '@/lib/ear/desk'
import { DESK_TIMING } from '@/lib/ear/timing'
import { latestThresholdReading } from '@/stores/ear-lab-store'
import type { DeskDrillProps } from './ColourDrill'
import { matchLoudness, randomSliceStart, renderFault } from './desk-render'
import { useEarRoom } from './ear-room-context'
import type { PadState } from './EarStage'
import { Pads, StagePad } from './EarStage'
import { MixingDesk } from './MixingDesk'
import { ThresholdDrillView } from './ThresholdDrillView'
import type { StimulusApi } from './use-threshold-run'
import { useThresholdRun } from './use-threshold-run'
import type { ExcerptHandle } from './wild-player'
import { playExcerpt } from './wild-player'

const ORDER = [
  { id: 'first', label: 'The first' },
  { id: 'second', label: 'The second' },
] as const

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/** The heavier render goes first on a coin flip. */
export function heavierFirst(random: () => number = Math.random): boolean {
  return random() < 0.5
}

export function WeightDrill(props: DeskDrillProps): JSX.Element {
  const { audioEngine } = useEngines()
  const room = useEarRoom()
  const [heavier, setHeavier] = createSignal<'first' | 'second' | null>(null)
  const [sounding, setSounding] = createSignal(0)
  const [picked, setPicked] = createSignal<'first' | 'second' | null>(null)
  let handle: ExcerptHandle | null = null
  const level = () => room.volume() * audioEngine.getVolume()

  function cancelStimulus(): void {
    handle?.cancel()
    handle = null
    setSounding(0)
  }

  async function playStimulus(db: number, api: StimulusApi): Promise<void> {
    await audioEngine.init()
    await audioEngine.resume()
    const ctx = audioEngine.getAudioContext()
    if (!ctx || api.cancelled()) return
    const buffer = props.source.buffer
    const start = randomSliceStart(buffer.duration, DESK_TIMING.sliceS)
    const [plain, heavy] = await Promise.all([
      renderFault(buffer, start, DESK_TIMING.sliceS, null),
      renderFault(buffer, start, DESK_TIMING.sliceS, lowShelf(db)),
    ])
    matchLoudness(plain, heavy)
    const first = heavierFirst()
    setHeavier(first ? 'first' : 'second')
    setPicked(null)
    const order = first ? [heavy, plain] : [plain, heavy]
    for (const [i, render] of order.entries()) {
      if (api.cancelled()) return
      api.step(i + 1)
      setSounding(i + 1)
      handle = playExcerpt(
        ctx,
        [{ buffer: render, gain: 1 }],
        0,
        render.duration,
        level(),
      )
      await handle.done
      handle = null
      if (i === 0) await wait(DESK_TIMING.gapMs)
    }
    setSounding(0)
    api.step(0)
    await wait(DESK_TIMING.tailMs)
  }

  const run = useThresholdRun(DESK_DRILLS.weight, playStimulus, {
    cancelStimulus,
  })

  const answer = (which: 'first' | 'second') => {
    if (run.phase() !== 'answer') return
    setPicked(which)
    run.answerCorrect(which === heavier())
  }
  const padState = (which: 'first' | 'second'): PadState => {
    if (run.phase() !== 'reveal') return null
    if (which === heavier()) return 'right'
    if (which === picked()) return 'wrong'
    return null
  }

  return (
    <ThresholdDrillView
      title="Weight"
      drillId="desk-weight"
      measures="Colour · the desk"
      description="The same slice of the mix twice; one carries a low shelf under 120 Hz, the two matched for loudness. Say which is heavier. The shelf thins while you are right and thickens when you slip; the reading is the thinnest shelf you still hear. Practice only: the desk reads on its own plate and the Column never moves for it."
      prompt="Two renders — which has the weight?"
      listenHint="The first… then the second…"
      answerHint="Which carried the heavier low end?"
      levelCaption="Shelf"
      levelLabel={() => `${run.level().toFixed(1)} dB`}
      formatValue={(value) => value.toFixed(1)}
      unitLabel="dB shelf"
      unitShort=" dB"
      latestValue={() => latestThresholdReading('desk-weight')?.value ?? null}
      run={run}
      practiceOnly={() => true}
      instrument={() => (
        <MixingDesk
          labels={ORDER.map((entry) => entry.label)}
          playing={sounding() > 0}
          highlight={sounding()}
          reveal={
            run.phase() === 'reveal' && heavier()
              ? {
                  index: heavier() === 'first' ? 0 : 1,
                  name: `${heavier() === 'first' ? 'The first' : 'The second'} — the shelf`,
                }
              : null
          }
        />
      )}
      pads={() => (
        <Pads columns={2} label="Which was heavier?">
          <For each={ORDER}>
            {(entry, i) => (
              <StagePad
                keycap={String(i() + 1)}
                label={entry.label}
                state={padState(entry.id)}
                lamp={run.phase() === 'stimulus' && sounding() === i() + 1}
                disabled={run.phase() !== 'answer'}
                onClick={() => answer(entry.id)}
              />
            )}
          </For>
        </Pads>
      )}
      keys={() =>
        ORDER.map((entry, i) => ({
          key: String(i + 1),
          action: () => answer(entry.id),
        }))
      }
      revealLine={() => {
        const which = heavier()
        const db = run.level().toFixed(1)
        if (!which) return ''
        return run.lastCorrect() === true
          ? `Right — the ${which} had the weight, a ${db} dB shelf under 120 Hz. The shelf thins.`
          : `It was the ${which}, a ${db} dB shelf under 120 Hz. The shelf thickens.`
      }}
      backLabel="Back to the desk"
      onBack={props.onBack}
    />
  )
}

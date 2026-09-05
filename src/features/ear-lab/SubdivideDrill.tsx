// ============================================================
// SubdivideDrill — name the metre.
//
// The kit plays two bars — 3/4, 4/4, 5/4, 6/8 or 7/8 — with the
// kick on one, and the question is what the bar is. Four pads out
// of the five metres, the answer among three others drawn fresh
// each round. The lattice chases the steps and shows no grouping
// until the reveal lights beat one. A miss plays the bars again,
// slower.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal, For } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { triggerDrumVoice } from '@/lib/drum-voices'
import type { EarBankItem } from '@/lib/ear/banks'
import { drawOptions } from '@/lib/ear/draw-options'
import { findIdentificationDrill } from '@/lib/ear/drills'
import type { MetreId, MetrePattern } from '@/lib/ear/metre'
import { METRE_BANK, metreName, METRES, patternOf, stepMs, } from '@/lib/ear/metre'
import { SUBDIVIDE_TIMING } from '@/lib/ear/timing'
import { useEarRoom } from './ear-room-context'
import type { PadState } from './EarStage'
import { Pads, StagePad } from './EarStage'
import { IdentificationDrillView } from './IdentificationDrillView'
import { MetreLattice } from './MetreLattice'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'

export function SubdivideDrill(props: { onBack: () => void }): JSX.Element {
  const { audioEngine } = useEngines()
  const room = useEarRoom()
  const drill = findIdentificationDrill('subdivide')
  if (!drill) throw new Error('subdivide drill missing from catalogue')

  const [pattern, setPattern] = createSignal<MetrePattern | null>(null)
  const [options, setOptions] = createSignal<MetreId[]>([])
  const [lit, setLit] = createSignal(0)
  let master: GainNode | null = null
  let timers: Array<ReturnType<typeof setTimeout>> = []

  function cancelAudio(): void {
    for (const timer of timers) clearTimeout(timer)
    timers = []
    if (master) {
      const held = master
      master = null
      try {
        // Anchor, then decay (docs/agent/MISTAKES.md, "Pop-free audio"):
        // a jump to zero was a click on every Stop. The node comes off
        // the graph once the tail is inaudible.
        const now = held.context.currentTime
        held.gain.cancelScheduledValues(now)
        held.gain.setValueAtTime(held.gain.value, now)
        held.gain.setTargetAtTime(0, now, 0.012)
        setTimeout(() => held.disconnect(), 80)
      } catch {
        // Already torn down with its context.
      }
    }
    setLit(0)
  }

  async function playBars(
    current: MetrePattern,
    quarterMs: number,
  ): Promise<void> {
    await audioEngine.init()
    await audioEngine.resume()
    const ctx = audioEngine.getAudioContext()
    if (!ctx) return
    cancelAudio()
    master = ctx.createGain()
    master.gain.value = room.volume() * audioEngine.getVolume()
    master.connect(ctx.destination)
    const out = master
    const step = stepMs(current.metre, quarterMs)
    const barMs = step * current.metre.beats
    const start = ctx.currentTime + SUBDIVIDE_TIMING.leadInS
    for (let bar = 0; bar < SUBDIVIDE_TIMING.bars; bar++) {
      for (const hit of current.steps) {
        const atMs = bar * barMs + hit.step * step
        triggerDrumVoice(
          hit.voice,
          ctx,
          start + atMs / 1000,
          hit.accent === true ? 1 : 0.7,
          out,
        )
        timers.push(
          setTimeout(
            () => setLit(hit.step + 1),
            SUBDIVIDE_TIMING.leadInS * 1000 + atMs,
          ),
        )
      }
    }
    await new Promise<void>((resolve) => {
      timers.push(
        setTimeout(
          () => {
            setLit(0)
            resolve()
          },
          SUBDIVIDE_TIMING.leadInS * 1000 +
            SUBDIVIDE_TIMING.bars * barMs +
            SUBDIVIDE_TIMING.tailMs,
        ),
      )
    })
  }

  function makeTrial(item: EarBankItem): IdentificationTrial {
    const current = patternOf(item.itemId)
    if (!current) throw new Error(`no pattern for ${item.itemId}`)
    return {
      expectedId: metreName(current.metre),
      play: async () => {
        setPattern(current)
        setOptions(drawOptions(current.metre, METRES, metreName))
        await playBars(current, SUBDIVIDE_TIMING.quarterMs)
      },
      replayOnWrong: () => playBars(current, SUBDIVIDE_TIMING.replayQuarterMs),
    }
  }

  const controller = useIdentificationController(drill, METRE_BANK, makeTrial, {
    cancelAudio,
  })
  const phase = () => controller.phase()

  const padState = (id: string): PadState => {
    if (phase() !== 'reveal') return null
    if (id === controller.expectedId()) return 'right'
    if (id === controller.answeredId()) return 'wrong'
    return null
  }

  return (
    <IdentificationDrillView
      title="Subdivide"
      drillId="subdivide"
      measures="Time · metre"
      description="The kit plays two bars with the kick on one — three, four, five, six or seven to the bar. Name the metre from four pads; the other three are drawn fresh each round. Count from the kick and feel where it lands again: 6/8 swings in two threes, 7/8 limps, 5/4 leans. A miss plays the bars again, slower."
      prompt="Two bars on the kit — what is the metre?"
      listenHint="Listen to the bars…"
      answerHint="What is the metre?"
      choices={[]}
      columns={2}
      controller={controller}
      revealName={(id) => id}
      answerConsole={() => (
        <Pads columns={2} label="What is the metre?">
          <For each={options()}>
            {(metre, i) => (
              <StagePad
                keycap={String(i() + 1)}
                label={metreName(metre)}
                state={padState(metreName(metre))}
                disabled={phase() !== 'answer'}
                onClick={() => controller.answer(metreName(metre))}
              />
            )}
          </For>
        </Pads>
      )}
      answerKeys={() =>
        phase() !== 'answer'
          ? []
          : options().map((metre, i) => ({
              key: String(i + 1),
              action: () => controller.answer(metreName(metre)),
            }))
      }
      instrument={() => (
        <MetreLattice
          steps={pattern()?.metre.beats ?? 4}
          lit={lit()}
          reveal={
            phase() === 'reveal' && pattern()
              ? { name: metreName(pattern()?.metre ?? { beats: 4, unit: 4 }) }
              : null
          }
        />
      )}
      onBack={props.onBack}
    />
  )
}

// ============================================================
// CadenceDrill — name the progression.
//
// One of the guitar room's eight progressions, strummed on the
// guitar voices in a roved key; four pads, the right one among
// three others drawn fresh each round, so the menu is never the
// same twice. The going train turns one wheel per chord and says
// nothing else until the reveal engraves the numerals. A miss
// strums the progression again, slower.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal, For } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import type { EarBankItem } from '@/lib/ear/banks'
import { findIdentificationDrill } from '@/lib/ear/drills'
import { roveRootMidi } from '@/lib/ear/item-bank'
import { drawOptions } from '@/lib/ear/draw-options'
import { CADENCE_BANK, degreeChordMidis } from '@/lib/ear/progressions'
import { CADENCE_TIMING } from '@/lib/ear/timing'
import { useEarRoom } from './ear-room-context'
import type { PadState } from './EarStage'
import { Pads, StagePad } from './EarStage'
import type { Strummer } from './guitar-chords'
import { createStrummer } from './guitar-chords'
import { IdentificationDrillView } from './IdentificationDrillView'
import { ProgressionTrain } from './ProgressionTrain'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'

export function CadenceDrill(props: { onBack: () => void }): JSX.Element {
  const { audioEngine } = useEngines()
  const room = useEarRoom()
  const drill = findIdentificationDrill('cadence')
  if (!drill) throw new Error('cadence drill missing from catalogue')

  const [current, setCurrent] = createSignal<EarBankItem | null>(null)
  const [options, setOptions] = createSignal<EarBankItem[]>([])
  const [sounding, setSounding] = createSignal(0)
  let strummer: Strummer | null = null
  let timers: Array<ReturnType<typeof setTimeout>> = []
  let rootMidi = 48

  function cancelAudio(): void {
    for (const timer of timers) clearTimeout(timer)
    timers = []
    strummer?.cancel()
    strummer = null
    setSounding(0)
  }

  async function strumProgression(
    degrees: readonly number[],
    chordMs: number,
  ): Promise<void> {
    await audioEngine.init()
    await audioEngine.resume()
    const ctx = audioEngine.getAudioContext()
    if (!ctx) return
    cancelAudio()
    strummer = createStrummer(ctx, room.volume() * audioEngine.getVolume())
    const stepMs = chordMs + CADENCE_TIMING.gapMs
    const start = ctx.currentTime + CADENCE_TIMING.leadInS
    degrees.forEach((degree, i) => {
      strummer?.strum(
        degreeChordMidis(rootMidi, degree),
        start + (i * stepMs) / 1000,
        chordMs / 1000,
      )
      timers.push(
        setTimeout(
          () => setSounding(i + 1),
          CADENCE_TIMING.leadInS * 1000 + i * stepMs,
        ),
      )
    })
    await new Promise<void>((resolve) => {
      timers.push(
        setTimeout(
          () => {
            setSounding(0)
            resolve()
          },
          CADENCE_TIMING.leadInS * 1000 +
            degrees.length * stepMs +
            CADENCE_TIMING.tailMs,
        ),
      )
    })
  }

  function makeTrial(item: EarBankItem): IdentificationTrial {
    return {
      expectedId: item.itemId,
      play: async () => {
        rootMidi = roveRootMidi()
        setCurrent(item)
        setOptions(drawOptions(item, CADENCE_BANK, (entry) => entry.itemId))
        await strumProgression(item.payload, CADENCE_TIMING.chordMs)
      },
      replayOnWrong: () =>
        strumProgression(item.payload, CADENCE_TIMING.replayChordMs),
    }
  }

  const controller = useIdentificationController(
    drill,
    CADENCE_BANK,
    makeTrial,
    {
      cancelAudio,
    },
  )
  const phase = () => controller.phase()

  const padState = (id: string): PadState => {
    if (phase() !== 'reveal') return null
    if (id === controller.expectedId()) return 'right'
    if (id === controller.answeredId()) return 'wrong'
    return null
  }

  const nameOf = (choiceId: string) =>
    CADENCE_BANK.find((item) => item.itemId === choiceId)?.name ?? choiceId

  return (
    <IdentificationDrillView
      title="Cadence"
      drillId="cadence"
      measures="Function · progression"
      description="A progression strummed in a roved key — three or four chords from the eight the guitar room knows. Name it in numerals from four pads; the other three are drawn fresh every round, so the menu never gives it away. A miss strums it again, slower. Hearing the progression, not the chords, is the point: I–V–vi–IV is a shape before it is four names."
      prompt="A progression on the guitar — which one was it?"
      listenHint="Listen to the progression…"
      answerHint="Which progression was that?"
      choices={[]}
      columns={2}
      controller={controller}
      revealName={nameOf}
      answerConsole={() => (
        <Pads columns={2} label="Which progression was that?">
          <For each={options()}>
            {(item, i) => (
              <StagePad
                keycap={String(i() + 1)}
                label={item.label}
                state={padState(item.itemId)}
                disabled={phase() !== 'answer'}
                onClick={() => controller.answer(item.itemId)}
              />
            )}
          </For>
        </Pads>
      )}
      answerKeys={() =>
        phase() !== 'answer'
          ? []
          : options().map((item, i) => ({
              key: String(i + 1),
              action: () => controller.answer(item.itemId),
            }))
      }
      instrument={() => (
        <ProgressionTrain
          count={current()?.payload.length ?? 4}
          sounding={sounding()}
          reveal={
            phase() === 'reveal' && current()
              ? {
                  degrees: current()?.payload ?? [],
                  name: current()?.name ?? '',
                }
              : null
          }
        />
      )}
      onBack={props.onBack}
    />
  )
}

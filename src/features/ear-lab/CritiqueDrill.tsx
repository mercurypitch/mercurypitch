// ============================================================
// CritiqueDrill — Critique: name the fault.
//
// A slice of the mix through one of six faults at a frozen
// strength — mud, box, harsh, sibilance, pumping, narrow — and six
// pads. Elo on the desk's own id over an authored bank, so the
// items do refine; the Column still never sees it.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import type { EarBankItem } from '@/lib/ear/banks'
import type { DeskFault } from '@/lib/ear/desk'
import { CRITIQUE_BANK, DESK_DRILLS, DESK_FAULTS, faultOf, } from '@/lib/ear/desk'
import { DESK_TIMING } from '@/lib/ear/timing'
import type { DeskDrillProps } from './ColourDrill'
import { randomSliceStart, renderFault } from './desk-render'
import { useEarRoom } from './ear-room-context'
import { IdentificationDrillView } from './IdentificationDrillView'
import { MixingDesk } from './MixingDesk'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'
import type { ExcerptHandle } from './wild-player'
import { playExcerpt } from './wild-player'

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export function CritiqueDrill(props: DeskDrillProps): JSX.Element {
  const { audioEngine } = useEngines()
  const room = useEarRoom()
  const [fault, setFault] = createSignal<DeskFault | null>(null)
  const [playing, setPlaying] = createSignal(false)
  let handle: ExcerptHandle | null = null
  /** Bumped by every silencing. A sound notes it as it starts and stops
   *  at the first await that finds it moved: a Stop, a closed room or the
   *  sound taken away while it waited on the audio engine (iOS holds
   *  resume() through a call) sounds nothing once the engine wakes, and
   *  no later sound can undo it, as resetting a flag did. */
  let silenced = 0
  const level = () => room.volume() * audioEngine.getVolume()

  function cancelAudio(): void {
    silenced += 1
    handle?.cancel()
    handle = null
    setPlaying(false)
  }

  async function sound(current: DeskFault, asked: number): Promise<void> {
    const ctx = audioEngine.getAudioContext()
    if (!ctx || asked !== silenced) return
    const buffer = props.source.buffer
    const start = randomSliceStart(buffer.duration, DESK_TIMING.sliceS)
    const render = await renderFault(
      buffer,
      start,
      DESK_TIMING.sliceS,
      current.spec,
    )
    if (asked !== silenced) return
    setPlaying(true)
    handle = playExcerpt(
      ctx,
      [{ buffer: render, gain: 1 }],
      0,
      render.duration,
      level(),
    )
    await handle.done
    // Silenced, its handle is gone already, and a newer one may stand in
    // its place.
    if (asked !== silenced) return
    handle = null
    setPlaying(false)
    await wait(DESK_TIMING.tailMs)
  }

  function makeTrial(item: EarBankItem): IdentificationTrial {
    const current = faultOf(item.itemId)
    if (!current) throw new Error(`${item.itemId} is not a desk fault`)
    return {
      expectedId: item.itemId,
      play: async () => {
        const asked = silenced
        await audioEngine.init()
        await audioEngine.resume()
        if (asked !== silenced) return
        setFault(current)
        await sound(current, asked)
      },
      replayOnWrong: async () => {
        await sound(current, silenced)
      },
    }
  }

  const controller = useIdentificationController(
    DESK_DRILLS.critique,
    CRITIQUE_BANK,
    makeTrial,
    { cancelAudio },
  )
  const nameOf = (choiceId: string) => faultOf(choiceId)?.name ?? choiceId
  /** The strip of a wrong pick, for the desk to edge at the reveal. */
  const wrongPick = (): number | undefined => {
    const pick = controller.answeredId()
    if (pick === null || pick === controller.expectedId()) return undefined
    const at = DESK_FAULTS.findIndex((entry) => `critique:${entry.id}` === pick)
    return at < 0 ? undefined : at
  }

  return (
    <IdentificationDrillView
      title="Critique"
      drillId="desk-critique"
      measures="Color · the desk"
      description="A slice of the mix with one thing wrong: mud around 250 Hz, box around 500, harshness at 3 kHz, sibilance from 8 kHz, a compressor pumping, or the stereo folded narrow. Name the fault. A miss plays it again. Rated on the desk's own track; the Column never moves for it."
      prompt="One thing is wrong with this mix. What?"
      listenHint="Listen to the mix…"
      answerHint="Name the fault."
      choices={DESK_FAULTS.map((entry) => ({
        id: `critique:${entry.id}`,
        label: entry.label,
      }))}
      columns={3}
      controller={controller}
      revealName={nameOf}
      instrument={() => (
        <MixingDesk
          labels={DESK_FAULTS.map((entry) => entry.label)}
          playing={playing()}
          highlight={0}
          reveal={
            controller.phase() === 'reveal' && fault()
              ? {
                  index: DESK_FAULTS.findIndex(
                    (entry) => entry.id === fault()?.id,
                  ),
                  name: fault()?.name ?? '',
                  picked: wrongPick(),
                }
              : null
          }
        />
      )}
      backLabel="Back to the desk"
      onBack={props.onBack}
    />
  )
}

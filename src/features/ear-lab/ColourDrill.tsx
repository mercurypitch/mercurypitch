// ============================================================
// ColourDrill — Colour: which octave band was boosted?
//
// One slice of the desk's source through a peaking boost on one of
// six bands, the boost at the staircase's level in dB; six pads.
// The catalogue's Colour settings under the desk's own id, practice
// only — the desk reads on its own plate, never the Column.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal, For } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import type { DeskBand } from '@/lib/ear/desk'
import { bandBoost, DESK_BANDS, DESK_DRILLS, pickBand } from '@/lib/ear/desk'
import { DESK_TIMING } from '@/lib/ear/timing'
import { latestThresholdReading } from '@/stores/ear-lab-store'
import { randomSliceStart, renderFault } from './desk-render'
import type { DeskSource } from './desk-store'
import { useEarRoom } from './ear-room-context'
import type { PadState } from './EarStage'
import { Pads, StagePad } from './EarStage'
import { MixingDesk } from './MixingDesk'
import { ThresholdDrillView } from './ThresholdDrillView'
import type { StimulusApi } from './use-threshold-run'
import { useThresholdRun } from './use-threshold-run'
import type { ExcerptHandle } from './wild-player'
import { playExcerpt } from './wild-player'

export interface DeskDrillProps {
  source: DeskSource
  onBack: () => void
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export function ColourDrill(props: DeskDrillProps): JSX.Element {
  const { audioEngine } = useEngines()
  const room = useEarRoom()
  const [band, setBand] = createSignal<DeskBand | null>(null)
  const [playing, setPlaying] = createSignal(false)
  const [picked, setPicked] = createSignal<string | null>(null)
  let handle: ExcerptHandle | null = null
  /** Where in the song the trial's slice starts, for a replay. */
  let sliceStart: number | null = null
  const level = () => room.volume() * audioEngine.getVolume()

  function cancelStimulus(): void {
    handle?.cancel()
    handle = null
    setPlaying(false)
  }

  async function playStimulus(db: number, api: StimulusApi): Promise<void> {
    await audioEngine.init()
    await audioEngine.resume()
    const ctx = audioEngine.getAudioContext()
    if (!ctx || api.cancelled()) return
    // A replay sounds the same slice with the same band boosted.
    const kept = api.replay ? band() : null
    const chosen = kept ?? pickBand()
    const buffer = props.source.buffer
    if (kept === null || sliceStart === null) {
      setBand(chosen)
      setPicked(null)
      sliceStart = randomSliceStart(buffer.duration, DESK_TIMING.sliceS)
    }
    const start = sliceStart
    const render = await renderFault(
      buffer,
      start,
      DESK_TIMING.sliceS,
      bandBoost(chosen, db),
    )
    if (api.cancelled()) return
    api.step(1)
    setPlaying(true)
    handle = playExcerpt(
      ctx,
      [{ buffer: render, gain: 1 }],
      0,
      render.duration,
      level(),
    )
    await handle.done
    handle = null
    setPlaying(false)
    api.step(0)
    await wait(DESK_TIMING.tailMs)
  }

  const run = useThresholdRun(DESK_DRILLS.colour, playStimulus, {
    cancelStimulus,
    replayable: true,
  })

  const answer = (bandId: string) => {
    if (run.phase() !== 'answer') return
    setPicked(bandId)
    run.answerCorrect(bandId === band()?.id)
  }
  /** The strip of a wrong pick, for the desk to edge at the reveal. */
  const wrongPick = (): number | undefined => {
    const pick = picked()
    if (pick === null || pick === band()?.id) return undefined
    return DESK_BANDS.findIndex((entry) => entry.id === pick)
  }
  const padState = (bandId: string): PadState => {
    if (run.phase() !== 'reveal') return null
    if (bandId === band()?.id) return 'right'
    if (bandId === picked()) return 'wrong'
    return null
  }

  return (
    <ThresholdDrillView
      title="Color"
      drillId="desk-colour"
      measures="Color · the desk"
      description="A slice of the mix plays with one octave band boosted (125 Hz to 4 kHz, six bands). Name the band. The boost shrinks while you are right and widens when you slip; the reading is the smallest boost you still place. Practice only: the desk reads on its own plate and the Column never moves for it."
      prompt="One band is boosted. Which?"
      listenHint="Listen to the mix…"
      answerHint="Which band was boosted?"
      levelCaption="Boost"
      levelLabel={() => `${run.level().toFixed(1)} dB`}
      formatValue={(value) => value.toFixed(1)}
      unitLabel="dB boost"
      unitShort=" dB"
      latestValue={() => latestThresholdReading('desk-colour')?.value ?? null}
      run={run}
      practiceOnly={() => true}
      instrument={() => (
        <MixingDesk
          labels={DESK_BANDS.map((entry) => entry.label)}
          playing={playing()}
          highlight={0}
          reveal={
            run.phase() === 'reveal' && band()
              ? {
                  index: DESK_BANDS.findIndex(
                    (entry) => entry.id === band()?.id,
                  ),
                  name: `${band()?.label ?? ''} (${band()?.word ?? ''})`,
                  picked: wrongPick(),
                  lift: `+${run.level().toFixed(1)} dB · ${band()?.word ?? ''}`,
                }
              : null
          }
        />
      )}
      pads={() => (
        <Pads columns={3} label="Which band?">
          <For each={DESK_BANDS}>
            {(entry, i) => (
              <StagePad
                keycap={String(i() + 1)}
                label={entry.label}
                sub={entry.word}
                state={padState(entry.id)}
                disabled={run.phase() !== 'answer'}
                onClick={() => answer(entry.id)}
              />
            )}
          </For>
        </Pads>
      )}
      keys={() =>
        DESK_BANDS.map((entry, i) => ({
          key: String(i + 1),
          action: () => answer(entry.id),
        }))
      }
      revealLine={() => {
        const chosen = band()
        const db = run.level().toFixed(1)
        if (!chosen) return ''
        return run.lastCorrect() === true
          ? `Right. The ${chosen.label} band, up ${db} dB. The boost shrinks.`
          : `It was ${chosen.label}, up ${db} dB. The boost widens.`
      }}
      backLabel="Back to the desk"
      onBack={props.onBack}
    />
  )
}

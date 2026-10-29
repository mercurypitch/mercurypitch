// ============================================================
// CadenceDrill — name the progression.
//
// One of the guitar room's eight progressions, strummed on the
// guitar voices in a roved key; four pads, the right one among
// three others drawn fresh each round, so the menu is never the
// same twice. The going train turns one wheel per chord and says
// nothing else until the reveal engraves the numerals. A miss
// strums the progression again, slower.
//
// In the native room Hear it again strums the same progression in the
// same key, the four pads left as they were, and a miss offers
// Compare: the answer's progression, then the pick's, in that key.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal, For } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import type { EarBankItem } from '@/lib/ear/banks'
import { drawOptions } from '@/lib/ear/draw-options'
import { findIdentificationDrill } from '@/lib/ear/drills'
import { roveRootMidi } from '@/lib/ear/item-bank'
import { CADENCE_BANK, degreeChordMidis } from '@/lib/ear/progressions'
import { CADENCE_TIMING, COMPARE_TIMING } from '@/lib/ear/timing'
import { EAR_LAB_WITH_MERC } from '@/lib/native-build'
import { useEarRoom } from './ear-room-context'
import type { PadState } from './EarStage'
import { Pads, StagePad } from './EarStage'
import type { Strummer } from './guitar-chords'
import { createStrummer } from './guitar-chords'
import type { IdentificationCompare } from './IdentificationDrillView'
import { IdentificationDrillView } from './IdentificationDrillView'
import { ProgressionTrain } from './ProgressionTrain'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'

const nameOf = (choiceId: string): string =>
  CADENCE_BANK.find((item) => item.itemId === choiceId)?.name ?? choiceId

/** Compare's words, for the native room alone: the numerals the reveal
 *  engraves. */
const CADENCE_COMPARE: IdentificationCompare | undefined = EAR_LAB_WITH_MERC
  ? {
      names: (answerId, pickId) => ({
        answer: nameOf(answerId),
        pick: nameOf(pickId),
      }),
    }
  : undefined

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
  /** Bumped by every silencing. A progression still waiting on the audio
   *  engine when it comes (the run stopped, the room closed, the sound
   *  taken away; iOS holds resume() through a call) sounds nothing once
   *  the engine is ready. */
  let silenced = 0
  let rootMidi = 48

  function cancelAudio(): void {
    silenced += 1
    for (const timer of timers) clearTimeout(timer)
    timers = []
    strummer?.cancel()
    strummer = null
    setSounding(0)
  }

  /** True once the progression has sounded to its end; false when a
   *  silencing came while it waited on the audio. One that comes while
   *  it sounds clears the timer it ends on, so it never resolves. */
  async function strumProgression(
    degrees: readonly number[],
    chordMs: number,
  ): Promise<boolean> {
    const asked = silenced
    await audioEngine.init()
    await audioEngine.resume()
    const ctx = audioEngine.getAudioContext()
    if (!ctx || asked !== silenced) return false
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
    return true
  }

  /** In a pair practice, the other of the two: on the pads every round,
   *  so the menu never says which of the two it was. */
  const partnerOf = (item: EarBankItem): EarBankItem | undefined => {
    const pair = controller.practice()
    if (pair === null) return undefined
    const other = pair[0] === item.itemId ? pair[1] : pair[0]
    return CADENCE_BANK.find((entry) => entry.itemId === other)
  }

  function makeTrial(item: EarBankItem): IdentificationTrial {
    return {
      expectedId: item.itemId,
      play: async () => {
        rootMidi = roveRootMidi()
        setCurrent(item)
        setOptions(
          drawOptions(
            item,
            CADENCE_BANK,
            (entry) => entry.itemId,
            4,
            Math.random,
            partnerOf(item),
          ),
        )
        await strumProgression(item.payload, CADENCE_TIMING.chordMs)
      },
      replayOnWrong: async () => {
        await strumProgression(item.payload, CADENCE_TIMING.replayChordMs)
      },
      ...(EAR_LAB_WITH_MERC
        ? {
            // The same progression in the same key: play() would rove the
            // key and draw the pads afresh under the verdict.
            replay: async (): Promise<void> => {
              await strumProgression(item.payload, CADENCE_TIMING.chordMs)
            },
            // The answer's progression, then the pick's, in that key. Each
            // strum goes through the guard above; a silencing in the pause
            // between them ends Compare there.
            compare: async (pickedId: string): Promise<void> => {
              const picked = CADENCE_BANK.find(
                (entry) => entry.itemId === pickedId,
              )
              if (picked === undefined) return
              const first = await strumProgression(
                item.payload,
                CADENCE_TIMING.chordMs,
              )
              if (!first) return
              const asked = silenced
              await new Promise((resolve) =>
                setTimeout(resolve, COMPARE_TIMING.gapMs),
              )
              if (asked !== silenced) return
              await strumProgression(picked.payload, CADENCE_TIMING.chordMs)
            },
          }
        : {}),
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

  return (
    <IdentificationDrillView
      title="Cadence"
      drillId="cadence"
      measures="Function · progression"
      description="A progression strummed in a roved key: three or four chords from the eight the guitar room knows. Name it in numerals from four pads; the other three are drawn fresh every round, so the menu never gives it away. A miss strums it again, slower. Hearing the progression, not the chords, is the point: I–V–vi–IV is a shape before it is four names."
      prompt="A progression on the guitar. Which one was it?"
      listenHint="Listen to the progression…"
      answerHint="Which progression was that?"
      choices={[]}
      columns={2}
      controller={controller}
      revealName={nameOf}
      compare={CADENCE_COMPARE}
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

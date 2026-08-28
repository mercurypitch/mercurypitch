// ============================================================
// EchoDrill — melodic dictation: a phrase in a planted key, tapped
// back note by note on the degree ladder.
//
// A cadence plants the key, three to six notes sound, and the ladder
// opens. Every note must match in order; the console shows the
// phrase forming in solfège but says nothing about right or wrong
// until the last note is in — a verdict per note would turn recall
// into a guessing game. A miss replays the phrase slowly, the way
// Contour and Leap do.
//
// Rated like the other button drills (useIdentificationController):
// the item is the phrase, the answer is whether the whole of it came
// back. Sing mode, when it lands, answers the same trial through the
// pitch pipeline and rates under its own track.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import type { EarBankItem } from '@/lib/ear/banks'
import { ECHO_BANK } from '@/lib/ear/banks'
import { findIdentificationDrill } from '@/lib/ear/drills'
import { cadenceChordMidis, roveRootMidi } from '@/lib/ear/item-bank'
import type { PhraseVerdict } from '@/lib/ear/phrase'
import { judgePhrase, phraseMidis, solfegeOf } from '@/lib/ear/phrase'
import { ECHO_TIMING } from '@/lib/ear/timing'
import { midiToFreq } from '@/lib/scale-data'
import { BeadChain } from './BeadChain'
import { IdentificationDrillView } from './IdentificationDrillView'
import { PhraseConsole } from './PhraseConsole'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'

export function EchoDrill(props: { onBack: () => void }): JSX.Element {
  const { audioEngine } = useEngines()
  const drill = findIdentificationDrill('echo')
  if (!drill) throw new Error('echo drill missing from catalogue')

  const [phrase, setPhrase] = createSignal<readonly number[]>([])
  const [answered, setAnswered] = createSignal<number[]>([])
  const [verdict, setVerdict] = createSignal<PhraseVerdict | null>(null)
  const [sounding, setSounding] = createSignal(0)
  let cancelled = false
  let rootMidi = 48

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  function cancelAudio(): void {
    cancelled = true
    audioEngine.stopTone(60)
    setSounding(0)
  }

  /** Chords are parallel playTone calls: the engine's chordIntervals
   *  are colour on one note, not voices. */
  async function plant(): Promise<void> {
    for (const chord of cadenceChordMidis(rootMidi)) {
      if (cancelled) return
      await Promise.all(
        chord.map((midi) =>
          audioEngine.playTone(midiToFreq(midi), ECHO_TIMING.chordMs),
        ),
      )
      await wait(ECHO_TIMING.chordMs + ECHO_TIMING.chordGapMs)
    }
    await wait(ECHO_TIMING.restMs)
  }

  async function sound(
    degrees: readonly number[],
    noteMs: number,
    gapMs: number,
  ): Promise<void> {
    const midis = phraseMidis(rootMidi, degrees)
    for (const [i, midi] of midis.entries()) {
      if (cancelled) return
      setSounding(i + 1)
      // playTone resolves once the note is scheduled, not when it ends.
      await audioEngine.playTone(midiToFreq(midi), noteMs)
      await wait(noteMs + gapMs)
    }
    setSounding(0)
    await wait(ECHO_TIMING.tailMs)
  }

  function makeTrial(item: EarBankItem): IdentificationTrial {
    return {
      expectedId: item.itemId,
      play: async () => {
        await audioEngine.init()
        await audioEngine.resume()
        cancelled = false
        rootMidi = roveRootMidi()
        setPhrase(item.payload)
        setAnswered([])
        setVerdict(null)
        await plant()
        await sound(item.payload, ECHO_TIMING.noteMs, ECHO_TIMING.gapMs)
      },
      replayOnWrong: async () => {
        cancelled = false
        await sound(
          item.payload,
          ECHO_TIMING.replayNoteMs,
          ECHO_TIMING.replayGapMs,
        )
      },
    }
  }

  const controller = useIdentificationController(drill, ECHO_BANK, makeTrial, {
    cancelAudio,
  })
  const phase = () => controller.phase()

  const tap = (degree: number) => {
    if (phase() !== 'answer') return
    const next = [...answered(), degree]
    setAnswered(next)
    if (next.length < phrase().length) return
    const result = judgePhrase(phrase(), next)
    setVerdict(result)
    // A slip is recorded as the phrase that was tapped, so the plate can
    // say what came back instead.
    controller.answer(
      result.correct ? (controller.expectedId() ?? '') : solfegeOf(next),
    )
  }

  const undo = () => {
    if (phase() !== 'answer') return
    setAnswered((list) => list.slice(0, -1))
  }

  const nameOf = (choiceId: string) =>
    ECHO_BANK.find((i) => i.itemId === choiceId)?.name ?? choiceId

  return (
    <IdentificationDrillView
      title="Echo"
      drillId="echo"
      measures="Shape · dictation"
      description="A cadence plants the key, then a short phrase sounds — three to six notes. Tap it back on the ladder, note by note, in order: 1 is home, 1′ the home above. Take a note back with Backspace before the last one lands; the whole phrase is judged at once. A miss plays it again, slower. The bank grows from steps to leaps as the rating climbs."
      prompt="A phrase in a planted key — tap it back in order."
      listenHint="Listen to the phrase…"
      answerHint="Tap it back on the ladder, note by note."
      choices={[]}
      columns={8}
      controller={controller}
      revealName={nameOf}
      answerConsole={() => (
        <PhraseConsole
          expectedLength={phrase().length}
          answered={answered()}
          armed={phase() === 'answer'}
          label="Tap the phrase back"
          onTap={tap}
          onUndo={undo}
        />
      )}
      answerKeys={() =>
        phase() !== 'answer'
          ? []
          : [
              ...[1, 2, 3, 4, 5, 6, 7, 8].map((degree) => ({
                key: String(degree),
                action: () => tap(degree),
              })),
              { key: 'Backspace', action: undo },
            ]
      }
      instrument={() => (
        <BeadChain
          count={phrase().length || 4}
          sounding={sounding()}
          reveal={
            phase() === 'reveal' && verdict()
              ? {
                  expected: phrase(),
                  answered: answered(),
                  perNote: verdict()?.perNote ?? [],
                }
              : null
          }
        />
      )}
      onBack={props.onBack}
    />
  )
}

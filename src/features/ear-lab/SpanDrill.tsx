// ============================================================
// SpanDrill — melodic span: Echo with the phrase growing one note
// at a time.
//
// A threshold drill on useThresholdRun with the catalogue's linear
// staircase on length (start 3, min 2, max 16). Every trial draws a
// fresh diatonic walk at the current length over a freshly planted
// key; the player taps it back in order on the ladder and the
// staircase moves on whether the whole phrase came back. The reading
// is notes held — the longest phrase the ear carries — and it sits
// on the Shape dial beside Contour and Leap.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { findThresholdDrill } from '@/lib/ear/drills'
import { cadenceChordMidis, roveRootMidi } from '@/lib/ear/item-bank'
import type { PhraseVerdict } from '@/lib/ear/phrase'
import { judgePhrase, phraseMidis, randomPhrase, solfegeOf, } from '@/lib/ear/phrase'
import { SPAN_TIMING } from '@/lib/ear/timing'
import { midiToFreq } from '@/lib/scale-data'
import { latestThresholdReading } from '@/stores/ear-lab-store'
import { BeadChain } from './BeadChain'
import { PhraseConsole } from './PhraseConsole'
import { ThresholdDrillView } from './ThresholdDrillView'
import type { StimulusApi } from './use-threshold-run'
import { useThresholdRun } from './use-threshold-run'

interface SpanDrillProps {
  onBack: () => void
}

export function SpanDrill(props: SpanDrillProps): JSX.Element {
  const { audioEngine } = useEngines()
  const drill = findThresholdDrill('span')
  if (!drill) throw new Error('span drill missing from catalogue')

  const [phrase, setPhrase] = createSignal<number[]>([])
  const [answered, setAnswered] = createSignal<number[]>([])
  const [verdict, setVerdict] = createSignal<PhraseVerdict | null>(null)
  let rootMidi = 48

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  function cancelStimulus(): void {
    audioEngine.stopTone(60)
  }

  async function playStimulus(level: number, api: StimulusApi): Promise<void> {
    await audioEngine.init()
    await audioEngine.resume()
    if (api.cancelled()) return

    const current = randomPhrase(level)
    rootMidi = roveRootMidi()
    setPhrase(current)
    setAnswered([])
    setVerdict(null)

    for (const chord of cadenceChordMidis(rootMidi)) {
      if (api.cancelled()) return
      await Promise.all(
        chord.map((midi) =>
          audioEngine.playTone(midiToFreq(midi), SPAN_TIMING.chordMs),
        ),
      )
      await wait(SPAN_TIMING.chordMs + SPAN_TIMING.chordGapMs)
    }
    await wait(SPAN_TIMING.restMs)

    const midis = phraseMidis(rootMidi, current)
    for (const [i, midi] of midis.entries()) {
      if (api.cancelled()) return
      api.step(i + 1)
      await audioEngine.playTone(midiToFreq(midi), SPAN_TIMING.noteMs)
      await wait(SPAN_TIMING.noteMs + SPAN_TIMING.gapMs)
    }
    api.step(0)
    await wait(SPAN_TIMING.tailMs)
  }

  const run = useThresholdRun(drill, playStimulus, { cancelStimulus })

  const tap = (degree: number) => {
    if (run.phase() !== 'answer') return
    const next = [...answered(), degree]
    setAnswered(next)
    if (next.length < phrase().length) return
    const result = judgePhrase(phrase(), next)
    setVerdict(result)
    run.answerCorrect(result.correct)
  }

  const undo = () => {
    if (run.phase() !== 'answer') return
    setAnswered((list) => list.slice(0, -1))
  }

  const length = () => `${Math.round(run.level())} notes`

  return (
    <ThresholdDrillView
      title="Span"
      drillId="span"
      measures="Shape · span"
      description="A cadence plants the key, then a phrase sounds — as many notes as the staircase says. Tap it back in order on the ladder; Backspace takes one back. Hold the whole phrase and it grows by a note, slip and it shortens. The reading is notes held — the longest phrase your ear carries whole."
      prompt="A phrase as long as the staircase says — tap it all back."
      listenHint="Listen to the phrase…"
      answerHint="Tap it back on the ladder, note by note."
      levelCaption="Length"
      levelLabel={length}
      formatValue={(value) => value.toFixed(0)}
      unitLabel="notes held"
      unitShort=" notes"
      latestValue={() => latestThresholdReading('span')?.value ?? null}
      run={run}
      instrument={() => (
        <BeadChain
          count={phrase().length || Math.round(run.level())}
          sounding={run.phase() === 'stimulus' ? run.stimulusStep() : 0}
          reveal={
            run.phase() === 'reveal' && verdict()
              ? {
                  expected: phrase(),
                  answered: answered(),
                  perNote: verdict()?.perNote ?? [],
                }
              : null
          }
        />
      )}
      pads={() => (
        <PhraseConsole
          expectedLength={phrase().length}
          answered={answered()}
          armed={run.phase() === 'answer'}
          label="Tap the phrase back"
          onTap={tap}
          onUndo={undo}
        />
      )}
      keys={() => [
        ...[1, 2, 3, 4, 5, 6, 7, 8].map((degree) => ({
          key: String(degree),
          action: () => tap(degree),
        })),
        { key: 'Backspace', action: undo },
      ]}
      revealLine={() => {
        const result = verdict()
        const count = phrase().length
        if (run.lastCorrect() === true) {
          return `Held — all ${count} notes, ${solfegeOf(phrase())}. The phrase grows.`
        }
        const slip = result?.firstMiss ?? 0
        return `Slipped at note ${slip + 1} of ${count} — it was ${solfegeOf(phrase())}. The phrase shortens.`
      }}
      onBack={props.onBack}
    />
  )
}

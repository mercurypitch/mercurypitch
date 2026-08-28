// ============================================================
// SpanDrill — melodic span: Echo with the phrase growing one note
// at a time.
//
// A threshold drill on useThresholdRun with the catalogue's linear
// staircase on length (start 3, min 2, max 16). Every trial draws a
// fresh diatonic walk at the current length over a freshly planted
// key; the player gives it back in order — on the ladder, or sung
// in free time through the same scorer Echo uses — and the staircase
// moves on whether the whole phrase came back. The reading is notes
// held — the longest phrase the ear carries — and it sits on the
// Shape dial beside Contour and Leap. A sung run is practice only
// and reads under 'span-sing'; Calibration always taps.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { findThresholdDrill } from '@/lib/ear/drills'
import { cadenceChordMidis, roveRootMidi } from '@/lib/ear/item-bank'
import type { PhraseVerdict } from '@/lib/ear/phrase'
import { judgePhrase, phraseMidis, randomPhrase, solfegeOf, } from '@/lib/ear/phrase'
import { scorePhraseFree, sungDegrees } from '@/lib/ear/sung-notes'
import { SPAN_TIMING } from '@/lib/ear/timing'
import { midiToFreq } from '@/lib/scale-data'
import { latestThresholdReading } from '@/stores/ear-lab-store'
import { BeadChain } from './BeadChain'
import { IconMic } from './ear-icons'
import { ConsoleNote, ConsoleStack, ConsoleWarning, ModeToggle, PlayPad, } from './EarStage'
import { soundRung } from './ladder-voice'
import { PhraseConsole, SungStrip } from './PhraseConsole'
import { ThresholdDrillView } from './ThresholdDrillView'
import { useSingCapture } from './use-sing-capture'
import { useSungAnswer } from './use-sung-answer'
import type { StimulusApi, ThresholdRunMode } from './use-threshold-run'
import { useThresholdRun } from './use-threshold-run'

interface SpanDrillProps {
  onBack: () => void
}

type AnswerMode = 'tap' | 'mic'

const MODES: { id: AnswerMode; label: string }[] = [
  { id: 'tap', label: 'Tap' },
  { id: 'mic', label: 'Sing or play' },
]

export const SPAN_SING_ID = 'span-sing'

/** The phrase's own length; the sung window's ceiling is twice it
 *  plus three seconds (use-sung-answer). */
export function spanPhraseMs(count: number): number {
  return count * (SPAN_TIMING.noteMs + SPAN_TIMING.gapMs)
}

export function SpanDrill(props: SpanDrillProps): JSX.Element {
  const { audioEngine } = useEngines()
  const drill = findThresholdDrill('span')
  if (!drill) throw new Error('span drill missing from catalogue')

  const [phrase, setPhrase] = createSignal<number[]>([])
  const [answered, setAnswered] = createSignal<number[]>([])
  const [verdict, setVerdict] = createSignal<PhraseVerdict | null>(null)
  const [answerMode, setAnswerMode] = createSignal<AnswerMode>('tap')
  const [micError, setMicError] = createSignal('')
  const capture = useSingCapture(audioEngine, 'ear-span-drill')
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
  /** The run in progress reads under the voice track. */
  const sungRun = () => run.trackId() === SPAN_SING_ID

  const tap = (degree: number) => {
    if (run.phase() !== 'answer' || sungRun()) return
    soundRung(audioEngine, rootMidi, degree)
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

  /** The sung window: the strip fills as the mic hears notes, and it
   *  closes itself on silence, at the ceiling, or on Done. */
  const sung = useSungAnswer({
    capture,
    open: () => run.phase() === 'answer' && sungRun(),
    rootMidi: () => rootMidi,
    phraseMs: () => spanPhraseMs(phrase().length),
    onJudge: (notes) => {
      if (run.phase() !== 'answer' || !sungRun()) return
      const score = scorePhraseFree(notes, phrase(), rootMidi)
      setAnswered(sungDegrees(notes, rootMidi))
      setVerdict({
        correct: score.correct,
        perNote: score.notes.map((note) => note.met),
        firstMiss: score.firstMiss,
      })
      run.answerCorrect(score.correct)
    },
  })

  /** Calibration always taps; a sung practice run needs the mic first
   *  and falls back to tapping when there is none. */
  async function handleStart(mode: ThresholdRunMode): Promise<void> {
    setMicError('')
    let sung = mode === 'practice' && answerMode() === 'mic'
    if (sung) {
      try {
        await capture.acquire()
      } catch {
        capture.release()
        setAnswerMode('tap')
        setMicError(
          'No microphone could be opened — this run takes tapped answers.',
        )
        sung = false
      }
    } else {
      capture.release()
    }
    run.start(mode, sung ? { drillId: SPAN_SING_ID } : undefined)
  }

  const length = () => `${Math.round(run.level())} notes`

  /** The sung run's console pad: busy while the phrase sounds, a live
   *  "done" button while the window is open, settled at the reveal. A
   *  PlayPad with a state is disabled, so the open window has none. */
  const listeningPad = (): {
    label: string
    sub: string
    state: 'sounding' | 'armed' | undefined
  } => {
    const current = run.phase()
    if (current === 'answer') {
      return {
        label: 'Done',
        sub: 'or wait — silence closes it',
        state: undefined,
      }
    }
    if (current === 'reveal') {
      return {
        label: 'Judged',
        sub: 'the chain shows each note',
        state: 'armed',
      }
    }
    return {
      label: 'Sing or play it back',
      sub: 'the mic opens after the phrase',
      state: 'sounding',
    }
  }

  const ladderKeys = () => [
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((degree) => ({
      key: String(degree),
      action: () => tap(degree),
    })),
    { key: 'Backspace', action: undo },
  ]

  return (
    <ThresholdDrillView
      title="Span"
      drillId="span"
      measures="Shape · span"
      description="A cadence plants the key, then a phrase sounds — as many notes as the staircase says. Tap it back in order on the ladder; Backspace takes one back. Hold the whole phrase and it grows by a note, slip and it shortens. The reading is notes held — the longest phrase your ear carries whole."
      idleAside={
        <ConsoleStack>
          <ModeToggle
            label="Answer by"
            value={answerMode()}
            options={MODES}
            onChange={setAnswerMode}
          />
          <Show when={answerMode() === 'mic'}>
            <ConsoleNote>
              Sing or play the phrase back at your own pace once it has sounded:
              the strip shows each note the mic hears, and the answer closes
              itself after a moment's silence, or on Done. A sung run is
              practice only and reads on its own voice track; Calibration always
              taps.
            </ConsoleNote>
          </Show>
          <Show when={micError() !== ''}>
            <ConsoleWarning>{micError()}</ConsoleWarning>
          </Show>
        </ConsoleStack>
      }
      prompt={`A phrase of ${run.level()} notes to start — give it all back, and it grows while you keep up.`}
      listenHint="Listen to the phrase…"
      answerHint={
        sungRun()
          ? 'Sing or play it back — at your own pace, then a breath.'
          : 'Tap it back on the ladder, note by note.'
      }
      levelCaption="Length"
      levelLabel={length}
      formatValue={(value) => value.toFixed(0)}
      unitLabel="notes held"
      unitShort=" notes"
      latestValue={() => latestThresholdReading('span')?.value ?? null}
      run={run}
      onStart={(mode) => void handleStart(mode)}
      practiceOnly={() => answerMode() === 'mic'}
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
        <Show
          when={sungRun()}
          fallback={
            <PhraseConsole
              expectedLength={phrase().length}
              answered={answered()}
              armed={run.phase() === 'answer'}
              label={`Tap the ${phrase().length} notes back`}
              onTap={tap}
              onUndo={undo}
            />
          }
        >
          <ConsoleStack>
            <SungStrip
              degrees={sung.degrees()}
              expectedLength={phrase().length}
              level={sung.level()}
              listening={run.phase() === 'answer'}
            />
            <PlayPad
              label={listeningPad().label}
              sub={listeningPad().sub}
              keycap="Space"
              state={listeningPad().state}
              icon={<IconMic size={20} />}
              onClick={sung.judgeNow}
            />
          </ConsoleStack>
        </Show>
      )}
      keys={() =>
        sungRun()
          ? run.phase() === 'answer'
            ? [{ key: 'Space', action: sung.judgeNow }]
            : []
          : ladderKeys()
      }
      revealLine={() => {
        const result = verdict()
        const count = phrase().length
        if (run.lastCorrect() === true) {
          return `Held — all ${count} notes, ${solfegeOf(phrase())}. The phrase grows.`
        }
        const slip = result?.firstMiss ?? 0
        const back =
          answered().length > 0
            ? `, you ${sungRun() ? 'sang' : 'tapped'} ${solfegeOf(answered())}`
            : ''
        return `Slipped at note ${slip + 1} of ${count} — it was ${solfegeOf(phrase())}${back}. The phrase shortens.`
      }}
      onBack={props.onBack}
    />
  )
}

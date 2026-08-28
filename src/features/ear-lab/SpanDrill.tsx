// ============================================================
// SpanDrill — melodic span: Echo with the phrase growing one note
// at a time.
//
// A threshold drill on useThresholdRun with the catalogue's linear
// staircase on length (start 3, min 2, max 16). Every trial draws a
// fresh diatonic walk at the current length over a freshly planted
// key; the player gives it back in order — on the ladder, or sung
// through the same windowed scorer Echo uses — and the staircase
// moves on whether the whole phrase came back. The reading is notes
// held — the longest phrase the ear carries — and it sits on the
// Shape dial beside Contour and Leap. A sung run is practice only
// and reads under 'span-sing'; Calibration always taps.
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createSignal, on, onCleanup, Show } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { findThresholdDrill } from '@/lib/ear/drills'
import { cadenceChordMidis, roveRootMidi } from '@/lib/ear/item-bank'
import type { PhraseVerdict } from '@/lib/ear/phrase'
import { judgePhrase, nearestDegree, phraseMidis, randomPhrase, solfegeOf, } from '@/lib/ear/phrase'
import { noteWindows, scorePhrase } from '@/lib/ear/phrase-score'
import { SPAN_TIMING } from '@/lib/ear/timing'
import { midiToFreq } from '@/lib/scale-data'
import { latestThresholdReading } from '@/stores/ear-lab-store'
import { BeadChain } from './BeadChain'
import { IconMic } from './ear-icons'
import { ConsoleNote, ConsoleStack, ConsoleWarning, ModeToggle, PlayPad, } from './EarStage'
import { PhraseConsole } from './PhraseConsole'
import { ThresholdDrillView } from './ThresholdDrillView'
import { useSingCapture } from './use-sing-capture'
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

export function spanListeningMs(count: number): number {
  return (
    SPAN_TIMING.singLeadMs +
    count * (SPAN_TIMING.noteMs + SPAN_TIMING.gapMs) +
    SPAN_TIMING.singTailMs
  )
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
  let singTimer: ReturnType<typeof setTimeout> | undefined

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  function cancelStimulus(): void {
    clearTimeout(singTimer)
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

  function judgeNow(): void {
    clearTimeout(singTimer)
    if (run.phase() !== 'answer' || !sungRun()) return
    const expected = phrase()
    const score = scorePhrase(
      capture.takeFrames(),
      rootMidi,
      expected,
      noteWindows(
        expected.length,
        SPAN_TIMING.noteMs,
        SPAN_TIMING.gapMs,
        SPAN_TIMING.singLeadMs,
      ),
    )
    setAnswered(
      score.notes.map((note) =>
        note.sungMidi === null ? 0 : nearestDegree(note.sungMidi - rootMidi),
      ),
    )
    setVerdict({
      correct: score.correct,
      perNote: score.notes.map((note) => note.met),
      firstMiss: score.firstMiss,
    })
    run.answerCorrect(score.correct)
  }

  createEffect(
    on(run.phase, (current) => {
      clearTimeout(singTimer)
      if (current !== 'answer' || !sungRun()) return
      capture.startWindow()
      singTimer = setTimeout(judgeNow, spanListeningMs(phrase().length))
    }),
  )
  onCleanup(() => clearTimeout(singTimer))

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
        label: 'Listening',
        sub: 'press when you are done',
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
      sub: 'when the console says now',
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
              Sing or play the phrase back at the pace it sounded, starting when
              the console says now. A sung run is practice only and reads on its
              own voice track; Calibration always taps.
            </ConsoleNote>
          </Show>
          <Show when={micError() !== ''}>
            <ConsoleWarning>{micError()}</ConsoleWarning>
          </Show>
        </ConsoleStack>
      }
      prompt="A phrase as long as the staircase says — give it all back."
      listenHint="Listen to the phrase…"
      answerHint={
        sungRun()
          ? 'Sing or play it back — now, at the pace it sounded.'
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
              label="Tap the phrase back"
              onTap={tap}
              onUndo={undo}
            />
          }
        >
          <PlayPad
            label={listeningPad().label}
            sub={listeningPad().sub}
            keycap="Space"
            state={listeningPad().state}
            icon={<IconMic size={20} />}
            onClick={judgeNow}
          />
        </Show>
      )}
      keys={() =>
        sungRun()
          ? run.phase() === 'answer'
            ? [{ key: 'Space', action: judgeNow }]
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
        return `Slipped at note ${slip + 1} of ${count} — it was ${solfegeOf(phrase())}. The phrase shortens.`
      }}
      onBack={props.onBack}
    />
  )
}

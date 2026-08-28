// ============================================================
// EchoDrill — melodic dictation: a phrase in a planted key, given
// back note by note on the degree ladder, or sung.
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
// back. Sing mode answers the same trial through the pitch pipeline
// Home listens with: the phrase's notes get windows on the grid the
// phrase itself sounded on, the median f0 in each names the sung
// note, and the run rates under 'echo-sing' with no guess floor —
// the item difficulties stay tap-set, the separation Home keeps
// between ear and voice.
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createSignal, on, onCleanup, Show } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import type { EarBankItem } from '@/lib/ear/banks'
import { ECHO_BANK } from '@/lib/ear/banks'
import { findIdentificationDrill } from '@/lib/ear/drills'
import { cadenceChordMidis, roveRootMidi } from '@/lib/ear/item-bank'
import type { PhraseVerdict } from '@/lib/ear/phrase'
import { judgePhrase, nearestDegree, phraseMidis, solfegeOf, } from '@/lib/ear/phrase'
import { noteWindows, scorePhrase } from '@/lib/ear/phrase-score'
import { ECHO_TIMING } from '@/lib/ear/timing'
import { midiToFreq } from '@/lib/scale-data'
import { BeadChain } from './BeadChain'
import { IconMic } from './ear-icons'
import { ConsoleNote, ConsoleStack, ConsoleWarning, ModeToggle, PlayPad, } from './EarStage'
import { IdentificationDrillView } from './IdentificationDrillView'
import { PhraseConsole } from './PhraseConsole'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'
import { useSingCapture } from './use-sing-capture'

type AnswerMode = 'tap' | 'mic'

const MODES: { id: AnswerMode; label: string }[] = [
  { id: 'tap', label: 'Tap' },
  { id: 'mic', label: 'Sing or play' },
]

/** The sung phrase's window: a breath, the phrase at its own pace,
 *  grace at the end. */
export function echoListeningMs(count: number): number {
  return (
    ECHO_TIMING.singLeadMs +
    count * (ECHO_TIMING.noteMs + ECHO_TIMING.gapMs) +
    ECHO_TIMING.singTailMs
  )
}

export function EchoDrill(props: { onBack: () => void }): JSX.Element {
  const { audioEngine } = useEngines()
  const drill = findIdentificationDrill('echo')
  if (!drill) throw new Error('echo drill missing from catalogue')

  const [phrase, setPhrase] = createSignal<readonly number[]>([])
  const [answered, setAnswered] = createSignal<number[]>([])
  const [verdict, setVerdict] = createSignal<PhraseVerdict | null>(null)
  const [sounding, setSounding] = createSignal(0)
  const [answerMode, setAnswerMode] = createSignal<AnswerMode>('tap')
  const [micError, setMicError] = createSignal('')
  const capture = useSingCapture(audioEngine, 'ear-echo-drill')
  let cancelled = false
  let rootMidi = 48
  let singTimer: ReturnType<typeof setTimeout> | undefined

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  function cancelAudio(): void {
    cancelled = true
    clearTimeout(singTimer)
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
    track: () =>
      answerMode() === 'mic'
        ? { drillId: 'echo-sing', guessRate: 0, updateItem: false }
        : null,
  })
  const phase = () => controller.phase()
  /** The run in progress answers by voice — read from the track the
   *  controller captured at start, so a fallback to tapping holds. */
  const sungRun = () => controller.track() !== null

  const tap = (degree: number) => {
    if (phase() !== 'answer' || sungRun()) return
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

  /** Score the sung window now — at its end, or when the singer
   *  presses the pad because they are done. */
  function judgeNow(): void {
    clearTimeout(singTimer)
    if (phase() !== 'answer' || !sungRun()) return
    const expected = phrase()
    const score = scorePhrase(
      capture.takeFrames(),
      rootMidi,
      expected,
      noteWindows(
        expected.length,
        ECHO_TIMING.noteMs,
        ECHO_TIMING.gapMs,
        ECHO_TIMING.singLeadMs,
      ),
    )
    const sung = score.notes.map((note) =>
      note.sungMidi === null ? 0 : nearestDegree(note.sungMidi - rootMidi),
    )
    setAnswered(sung)
    setVerdict({
      correct: score.correct,
      perNote: score.notes.map((note) => note.met),
      firstMiss: score.firstMiss,
    })
    controller.answer(
      score.correct
        ? (controller.expectedId() ?? '')
        : score.voicedNotes === 0
          ? 'nothing the mic could hear'
          : solfegeOf(sung.filter((degree) => degree > 0)),
    )
  }

  createEffect(
    on(phase, (current) => {
      clearTimeout(singTimer)
      if (current !== 'answer' || !sungRun()) return
      capture.startWindow()
      singTimer = setTimeout(judgeNow, echoListeningMs(phrase().length))
    }),
  )
  onCleanup(() => clearTimeout(singTimer))

  async function handleStart(): Promise<void> {
    setMicError('')
    if (answerMode() === 'mic') {
      try {
        await capture.acquire()
      } catch {
        capture.release()
        setAnswerMode('tap')
        setMicError(
          'No microphone could be opened — this run takes tapped answers.',
        )
      }
    } else {
      capture.release()
    }
    controller.start()
  }

  const nameOf = (choiceId: string) =>
    ECHO_BANK.find((i) => i.itemId === choiceId)?.name ?? choiceId

  /** The sung run's console pad: busy while the phrase sounds, a live
   *  "done" button while the window is open, settled at the reveal. A
   *  PlayPad with a state is disabled, so the open window has none. */
  const listeningPad = (): {
    label: string
    sub: string
    state: 'sounding' | 'armed' | undefined
  } => {
    const current = phase()
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
    <IdentificationDrillView
      title="Echo"
      drillId="echo"
      measures="Shape · dictation"
      description="A cadence plants the key, then a short phrase sounds — three to six notes. Tap it back on the ladder, note by note, in order: 1 is home, 1′ the home above. Take a note back with Backspace before the last one lands; the whole phrase is judged at once. A miss plays it again, slower. The bank grows from steps to leaps as the rating climbs."
      prompt="A phrase in a planted key — give it back in order."
      listenHint="Listen to the phrase…"
      answerHint={
        sungRun()
          ? 'Sing or play it back — now, at the pace it sounded.'
          : 'Tap it back on the ladder, note by note.'
      }
      choices={[]}
      columns={8}
      controller={controller}
      revealName={nameOf}
      onStart={() => void handleStart()}
      runMode={() => (sungRun() ? 'sung answers' : 'rating run')}
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
              the console says now — each note is judged in its own window.
              Voice runs rate on their own track; the phrases keep the
              difficulty tapping set.
            </ConsoleNote>
          </Show>
          <Show when={micError() !== ''}>
            <ConsoleWarning>{micError()}</ConsoleWarning>
          </Show>
        </ConsoleStack>
      }
      answerConsole={() => (
        <Show
          when={sungRun()}
          fallback={
            <PhraseConsole
              expectedLength={phrase().length}
              answered={answered()}
              armed={phase() === 'answer'}
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
      answerKeys={() =>
        phase() !== 'answer'
          ? []
          : sungRun()
            ? [{ key: 'Space', action: judgeNow }]
            : ladderKeys()
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

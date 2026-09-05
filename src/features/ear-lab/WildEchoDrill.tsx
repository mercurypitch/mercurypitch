// ============================================================
// WildEchoDrill — Echo in the Wild: a phrase the singer actually
// sang, tapped back on the ladder.
//
// The phrase is an excerpt of the vocal stem (the instrumental low
// under it), three to six notes the reading found in the song's
// key; the beads light on the notes' own onsets. Answering is
// Echo's ladder — 1′ folds to 1, the reading names degrees within
// the octave — and a slip is recorded as the phrase that was tapped.
// Rated under wild-echo with the items frozen, never the Column; a
// sung run reads under wild-echo-sing, the way Echo keeps its voice
// track apart from its ear.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import type { EarBankItem } from '@/lib/ear/banks'
import { guessRate } from '@/lib/ear/drills'
import type { PhraseVerdict } from '@/lib/ear/phrase'
import { judgePhrase } from '@/lib/ear/phrase'
import { scorePhraseFree, sungDegrees } from '@/lib/ear/sung-notes'
import { keyLabel, solfegeOfDegree, solfegeOfPhrase, WILD_DRILLS, wildBankItem, } from '@/lib/ear/wild'
import { BeadChain } from './BeadChain'
import { IconMic } from './ear-icons'
import { ConsoleNote, ConsoleStack, ConsoleWarning, ModeToggle, PlayPad, } from './EarStage'
import { IdentificationDrillView } from './IdentificationDrillView'
import { soundRung } from './ladder-voice'
import { PhraseConsole, SungStrip } from './PhraseConsole'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'
import { useSingCapture } from './use-sing-capture'
import { useSungAnswer } from './use-sung-answer'
import { useWildPlayback } from './wild-playback'
import type { WildDrillProps } from './WildHomeDrill'

type AnswerMode = 'tap' | 'mic'

const MODES: { id: AnswerMode; label: string }[] = [
  { id: 'tap', label: 'Tap' },
  { id: 'mic', label: 'Sing or play' },
]

export const WILD_ECHO_SING_ID = 'wild-echo-sing'

export function WildEchoDrill(props: WildDrillProps): JSX.Element {
  const { audioEngine } = useEngines()
  // eslint-disable-next-line solid/reactivity
  const { book, stems } = props.reading
  const mode = book.key.mode
  const items = new Map(book.echo.map((item) => [item.itemId, item]))
  const bank = book.echo.map((item) => wildBankItem(item, mode))
  const layers = [
    { buffer: stems.vocal, gain: 1 },
    { buffer: stems.instrumental, gain: 0.3 },
  ]
  const playback = useWildPlayback()
  const [answerMode, setAnswerMode] = createSignal<AnswerMode>('tap')
  const [micError, setMicError] = createSignal('')
  const capture = useSingCapture(audioEngine, 'ear-wild-echo-drill')
  /** The plant's root, the octave below middle C (wild-playback). */
  const rootMidi = 48 + book.key.tonicPc
  const [phrase, setPhrase] = createSignal<readonly number[]>([])
  const [answered, setAnswered] = createSignal<number[]>([])
  const [verdict, setVerdict] = createSignal<PhraseVerdict | null>(null)
  const [sounding, setSounding] = createSignal(0)
  const word = (degree: number) =>
    solfegeOfDegree(degree === 8 ? 1 : degree, mode)

  function makeTrial(item: EarBankItem): IdentificationTrial {
    const wild = items.get(item.itemId)
    if (!wild) throw new Error(`${item.itemId} is not in this book`)
    const sound = async () => {
      wild.onsetsS.forEach((onset, i) =>
        playback.after(onset * 1000, () => setSounding(i + 1)),
      )
      await playback.excerpt(layers, wild.startS, wild.endS)
      setSounding(0)
    }
    return {
      expectedId: item.itemId,
      play: async () => {
        playback.begin()
        setPhrase(wild.degrees)
        setAnswered([])
        setVerdict(null)
        await playback.plant(book.key)
        if (playback.cancelled()) return
        await sound()
      },
      replayOnWrong: async () => {
        playback.begin()
        await sound()
      },
    }
  }

  const drill = WILD_DRILLS['wild-echo']
  const controller = useIdentificationController(drill, bank, makeTrial, {
    cancelAudio: () => {
      playback.cancel()
      setSounding(0)
    },
    track: () =>
      answerMode() === 'mic'
        ? { drillId: WILD_ECHO_SING_ID, guessRate: 0, updateItem: false }
        : { drillId: drill.id, guessRate: guessRate(drill), updateItem: false },
  })
  const phase = () => controller.phase()
  /** The run in progress answers by voice — read from the track the
   *  controller captured at start, so a fallback to tapping holds. */
  const sungRun = () => controller.track()?.drillId === WILD_ECHO_SING_ID

  const tap = (tapped: number) => {
    if (phase() !== 'answer' || sungRun()) return
    soundRung(audioEngine, rootMidi, tapped)
    const next = [...answered(), tapped === 8 ? 1 : tapped]
    setAnswered(next)
    if (next.length < phrase().length) return
    const result = judgePhrase(phrase(), next)
    setVerdict(result)
    controller.answer(
      result.correct
        ? (controller.expectedId() ?? '')
        : solfegeOfPhrase(next, mode),
    )
  }
  const undo = () => {
    if (phase() !== 'answer') return
    setAnswered((list) => list.slice(0, -1))
  }
  const nameOf = (choiceId: string) =>
    bank.find((entry) => entry.itemId === choiceId)?.name ?? choiceId

  /** The sung window, as Echo's: 1′ folds to 1 here too. */
  const sung = useSungAnswer({
    capture,
    open: () => phase() === 'answer' && sungRun(),
    rootMidi: () => rootMidi,
    phraseMs: () => {
      const wild = items.get(controller.expectedId() ?? '')
      return wild ? (wild.endS - wild.startS) * 1000 : 3000
    },
    onJudge: (notes) => {
      if (phase() !== 'answer' || !sungRun()) return
      const heard = sungDegrees(notes, rootMidi).map((degree) =>
        degree === 8 ? 1 : degree,
      )
      const score = scorePhraseFree(notes, phrase(), rootMidi)
      setAnswered(heard)
      setVerdict({
        correct: score.correct,
        perNote: score.notes.map((note) => note.met),
        firstMiss: score.firstMiss,
      })
      controller.answer(
        score.correct
          ? (controller.expectedId() ?? '')
          : notes.length === 0
            ? 'nothing the mic could hear'
            : solfegeOfPhrase(heard, mode),
      )
    },
  })

  /** One Begin at a time: a second press during the permission prompt
   *  started a second run that ate the sprint's armed length and left
   *  the first prompt sounding. */
  let starting = false

  async function handleStart(): Promise<void> {
    if (starting) return
    starting = true
    try {
      await startRun()
    } finally {
      starting = false
    }
  }

  async function startRun(): Promise<void> {
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

  const listeningPad = (): {
    label: string
    sub: string
    state: 'sounding' | 'armed' | undefined
  } => {
    const current = phase()
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

  return (
    <IdentificationDrillView
      title="Echo in the Wild"
      drillId="wild-echo"
      measures={`Shape · ${keyLabel(book.key)}`}
      description="A chord plants the song's key, then the singer's own phrase plays — three to six notes the reading found. Tap it back on the ladder in order; 1′ counts as 1, since the song's degrees are named within the octave. A miss plays the phrase again. Rated on the Field Book's own track; the Column never moves for it."
      prompt="A phrase the singer sang — give it back in order."
      listenHint="A chord plants the key, then the phrase…"
      answerHint={
        sungRun()
          ? 'Sing or play it back — at your own pace, then a breath.'
          : 'Tap it back on the ladder, note by note.'
      }
      choices={[]}
      columns={8}
      controller={controller}
      revealName={nameOf}
      answerVerb={sungRun() ? 'sang' : 'tapped'}
      slipNote={() => {
        const result = verdict()
        return result !== null && !result.correct && result.firstMiss !== null
          ? `first slip at note ${result.firstMiss + 1}`
          : undefined
      }}
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
              Sing or play the phrase back at your own pace once it has sounded:
              the strip shows each note the mic hears, and the answer closes
              itself after a moment's silence, or on Done. Sung runs rate on
              their own track.
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
              label={`Tap the ${phrase().length} notes back`}
              words={word}
              onTap={tap}
              onUndo={undo}
            />
          }
        >
          <ConsoleStack>
            <SungStrip
              degrees={sung.degrees()}
              expectedLength={phrase().length}
              words={word}
              level={sung.level()}
              listening={phase() === 'answer'}
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
      answerKeys={() =>
        phase() !== 'answer'
          ? []
          : sungRun()
            ? [{ key: 'Space', action: sung.judgeNow }]
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
          words={word}
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
      backLabel="Back to the page"
    />
  )
}

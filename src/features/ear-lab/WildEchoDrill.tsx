// ============================================================
// WildEchoDrill — Echo in the Wild: a phrase the singer actually
// sang, tapped back on the ladder.
//
// The phrase is an excerpt of the vocal stem (the instrumental low
// under it), three to six notes the reading found in the song's
// key; the beads light on the notes' own onsets. Answering is
// Echo's ladder — 1′ folds to 1, the reading names degrees within
// the octave — and a slip is recorded as the phrase that was tapped.
// Rated under wild-echo with the items frozen, never the Column.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import type { EarBankItem } from '@/lib/ear/banks'
import { guessRate } from '@/lib/ear/drills'
import type { PhraseVerdict } from '@/lib/ear/phrase'
import { judgePhrase } from '@/lib/ear/phrase'
import { keyLabel, solfegeOfDegree, solfegeOfPhrase, WILD_DRILLS, wildBankItem, } from '@/lib/ear/wild'
import { BeadChain } from './BeadChain'
import { IdentificationDrillView } from './IdentificationDrillView'
import { PhraseConsole } from './PhraseConsole'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'
import { useWildPlayback } from './wild-playback'
import type { WildDrillProps } from './WildHomeDrill'

export function WildEchoDrill(props: WildDrillProps): JSX.Element {
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
    track: () => ({
      drillId: drill.id,
      guessRate: guessRate(drill),
      updateItem: false,
    }),
  })
  const phase = () => controller.phase()

  const tap = (tapped: number) => {
    if (phase() !== 'answer') return
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

  return (
    <IdentificationDrillView
      title="Echo in the Wild"
      drillId="wild-echo"
      measures={`Shape · ${keyLabel(book.key)}`}
      description="A chord plants the song's key, then the singer's own phrase plays — three to six notes the reading found. Tap it back on the ladder in order; 1′ counts as 1, since the song's degrees are named within the octave. A miss plays the phrase again. Rated on the Field Book's own track; the Column never moves for it."
      prompt="A phrase the singer sang — tap it back in order."
      listenHint="A chord plants the key, then the phrase…"
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
          words={word}
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

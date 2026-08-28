// ============================================================
// WildBasslineDrill — Bassline in the Wild: the root moved, in
// the user's own song — to which degree?
//
// Two chords in a row from the reading, the first's root named in
// the question; the excerpt is the bass part when the song has a
// stem split, the instrumental otherwise. The gear train turns one
// wheel per chord and engraves the numerals at the reveal. Rated
// under wild-bassline with the items frozen, never the Column.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import type { EarBankItem } from '@/lib/ear/banks'
import { guessRate } from '@/lib/ear/drills'
import type { WildBasslineItem } from '@/lib/ear/wild'
import { keyLabel, numeralOf, solfegeOfDegree, WILD_DRILLS, wildBankItem, } from '@/lib/ear/wild'
import { IdentificationDrillView } from './IdentificationDrillView'
import { ProgressionTrain } from './ProgressionTrain'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'
import { useWildPlayback } from './wild-playback'
import type { WildDrillProps } from './WildHomeDrill'

const DEGREES = [1, 2, 3, 4, 5, 6, 7]

export function WildBasslineDrill(props: WildDrillProps): JSX.Element {
  // eslint-disable-next-line solid/reactivity
  const { book, stems } = props.reading
  const mode = book.key.mode
  const items = new Map(book.bassline.map((item) => [item.itemId, item]))
  const bank = book.bassline.map((item) => wildBankItem(item, mode))
  const layers = stems.bass
    ? [
        { buffer: stems.bass, gain: 1 },
        { buffer: stems.instrumental, gain: 0.35 },
      ]
    : [{ buffer: stems.instrumental, gain: 1 }]
  const playback = useWildPlayback()
  const [current, setCurrent] = createSignal<WildBasslineItem | null>(null)
  const [sounding, setSounding] = createSignal(0)

  function makeTrial(item: EarBankItem): IdentificationTrial {
    const wild = items.get(item.itemId)
    if (!wild) throw new Error(`${item.itemId} is not in this book`)
    const sound = async () => {
      setSounding(1)
      playback.after(wild.switchS * 1000, () => setSounding(2))
      await playback.excerpt(layers, wild.startS, wild.endS)
      setSounding(0)
    }
    return {
      expectedId: String(wild.toDegree),
      play: async () => {
        playback.begin()
        setCurrent(wild)
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

  const drill = WILD_DRILLS['wild-bassline']
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

  const nameOf = (choiceId: string) => numeralOf(Number(choiceId), mode)
  const fromWord = () => {
    const item = current()
    return item ? numeralOf(item.fromDegree, mode) : '…'
  }

  return (
    <IdentificationDrillView
      title="Bassline in the Wild"
      drillId="wild-bassline"
      measures={`Function · ${keyLabel(book.key)}`}
      description="A chord plants the song's key, then two chords of the song play — the bass part when the song has a stem split. The first root is named; answer the degree the root moved to. A miss plays the pair again. Rated on the Field Book's own track; the Column never moves for it."
      prompt="The root moves — to which degree?"
      listenHint={`A chord plants the key, then the song — the root starts on ${fromWord()}…`}
      answerHint={`The root moved from ${fromWord()} — to which degree?`}
      choices={DEGREES.map((degree) => ({
        id: String(degree),
        label: numeralOf(degree, mode),
        sub: solfegeOfDegree(degree, mode),
      }))}
      columns={7}
      controller={controller}
      revealName={nameOf}
      instrument={() => (
        <ProgressionTrain
          count={2}
          sounding={sounding()}
          reveal={
            controller.phase() === 'reveal' && current()
              ? {
                  degrees: [
                    current()?.fromDegree ?? 1,
                    current()?.toDegree ?? 1,
                  ],
                  name: `${fromWord()} to ${numeralOf(current()?.toDegree ?? 1, mode)}`,
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

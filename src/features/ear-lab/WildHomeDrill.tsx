// ============================================================
// WildHomeDrill — Home in the Wild: which degree does the voice
// land on, in the user's own song?
//
// The song's tonic triad plants its key, then an excerpt of the
// vocal over the instrumental plays up to a note the singer held;
// the seven degree pads answer. The engine is Home's — the same
// identification controller, the same fork on the drum — rated under
// wild-home with the item difficulties frozen: the items are one
// song, not a bank, and nothing here marks the Column.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import type { EarBankItem } from '@/lib/ear/banks'
import { guessRate } from '@/lib/ear/drills'
import { WILD_TIMING } from '@/lib/ear/timing'
import type { WildHomeItem } from '@/lib/ear/wild'
import { keyLabel, solfegeOfDegree, WILD_DRILLS, WILD_LIMITS, wildBankItem, } from '@/lib/ear/wild'
import { IdentificationDrillView } from './IdentificationDrillView'
import { TuningFork } from './TuningFork'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'
import type { WildReading } from './wild-analysis'
import { useWildPlayback } from './wild-playback'

export interface WildDrillProps {
  reading: WildReading
  onBack: () => void
}

const DEGREES = [1, 2, 3, 4, 5, 6, 7]

export function WildHomeDrill(props: WildDrillProps): JSX.Element {
  // The reading is fixed for the drill's life: the view mounts one per
  // song, so this is a snapshot by design.
  // eslint-disable-next-line solid/reactivity
  const { book, stems } = props.reading
  const mode = book.key.mode
  const items = new Map(book.home.map((item) => [item.itemId, item]))
  const bank = book.home.map((item) => wildBankItem(item, mode))
  const layers = [
    { buffer: stems.vocal, gain: 1 },
    { buffer: stems.instrumental, gain: 0.45 },
  ]
  const playback = useWildPlayback()
  const [planted, setPlanted] = createSignal(false)
  const [ringing, setRinging] = createSignal(false)
  const [target, setTarget] = createSignal<WildHomeItem | null>(null)

  function makeTrial(item: EarBankItem): IdentificationTrial {
    const wild = items.get(item.itemId)
    if (!wild) throw new Error(`${item.itemId} is not in this book`)
    return {
      expectedId: String(wild.degree),
      play: async () => {
        playback.begin()
        setTarget(wild)
        setPlanted(false)
        setRinging(false)
        await playback.plant(book.key)
        setPlanted(true)
        if (playback.cancelled()) return
        setRinging(true)
        await playback.excerpt(layers, wild.startS, wild.endS)
        setRinging(false)
      },
      replayOnWrong: async () => {
        playback.begin()
        setRinging(true)
        await playback.excerpt(
          layers,
          Math.max(
            wild.startS,
            wild.endS - WILD_TIMING.replayTailS - WILD_LIMITS.homeTailS,
          ),
          wild.endS,
        )
        setRinging(false)
      },
    }
  }

  const drill = WILD_DRILLS['wild-home']
  const controller = useIdentificationController(drill, bank, makeTrial, {
    cancelAudio: () => {
      playback.cancel()
      setRinging(false)
    },
    track: () => ({
      drillId: drill.id,
      guessRate: guessRate(drill),
      updateItem: false,
    }),
  })

  const nameOf = (choiceId: string) =>
    `${choiceId} — ${solfegeOfDegree(Number(choiceId), mode)}`

  return (
    <IdentificationDrillView
      title="Home in the Wild"
      drillId="wild-home"
      measures={`Function · ${keyLabel(book.key)}`}
      description="The song's own key, read from its vocal. A chord plants it, then the song plays up to a note the singer held: name the degree that note lands on, one to seven. A miss plays the end of the excerpt again. Rated on the Field Book's own track; the Column never moves for it."
      prompt="Which degree does the voice land on?"
      listenHint="A chord plants the key, then the song — listen for where the voice lands…"
      answerHint="Which degree of the song's key was that?"
      choices={DEGREES.map((degree) => ({
        id: String(degree),
        label: String(degree),
        sub: solfegeOfDegree(degree, mode),
      }))}
      columns={7}
      controller={controller}
      revealName={nameOf}
      instrument={() => (
        <TuningFork
          cadenceStep={planted() ? 4 : 0}
          ringing={ringing()}
          listening={false}
          reveal={
            controller.phase() === 'reveal' && target()
              ? {
                  degree: String(target()?.degree ?? 1),
                  solfege: solfegeOfDegree(target()?.degree ?? 1, mode),
                  correct: controller.answeredId() === controller.expectedId(),
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

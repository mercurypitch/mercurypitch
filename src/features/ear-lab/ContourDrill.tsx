// ============================================================
// ContourDrill — up, down or same, at speed.
//
// The fast, low-stakes warm-up of the Shape faculty. Items are
// gap tiers, not answers: each trial draws its direction fresh,
// and as the rating climbs the tiers shrink from wide leaps
// toward the hairline gaps where contour meets discrimination.
// ============================================================

import type { JSX } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { CONTOUR_BANK } from '@/lib/ear/banks'
import { findIdentificationDrill } from '@/lib/ear/drills'
import { CONTOUR_TIMING } from '@/lib/ear/timing'
import { IdentificationDrillView } from './IdentificationDrillView'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'

const DIRECTIONS = [
  { id: 'up', label: 'Up', name: 'Up' },
  { id: 'down', label: 'Down', name: 'Down' },
  { id: 'same', label: 'Same', name: 'The same' },
] as const

export function ContourDrill(props: { onBack: () => void }): JSX.Element {
  const { audioEngine } = useEngines()
  const drill = findIdentificationDrill('contour')
  if (!drill) throw new Error('contour drill missing from catalogue')

  function makeTrial(item: (typeof CONTOUR_BANK)[number]): IdentificationTrial {
    const gapCents = item.payload[0]
    const direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)]
    const base = 220 * 2 ** (Math.random() * 1.5)
    const second =
      direction.id === 'same'
        ? base
        : base * 2 ** (((direction.id === 'up' ? 1 : -1) * gapCents) / 1200)

    const playPair = async (toneMs: number, gapMs: number) => {
      await audioEngine.playTone(base, toneMs)
      await new Promise((resolve) => setTimeout(resolve, gapMs))
      await audioEngine.playTone(second, toneMs)
    }

    return {
      expectedId: direction.id,
      play: () => playPair(CONTOUR_TIMING.toneMs, CONTOUR_TIMING.gapMs),
      replayOnWrong: () =>
        playPair(CONTOUR_TIMING.replayToneMs, CONTOUR_TIMING.replayGapMs),
    }
  }

  const controller = useIdentificationController(
    drill,
    CONTOUR_BANK,
    makeTrial,
    { cancelAudio: () => audioEngine.stopTone(60) },
  )

  return (
    <IdentificationDrillView
      title="Contour"
      description="Two quick tones — up, down or the same? Easy until the gaps shrink: the top tier plays quarter-tone and finer moves, where contour hearing meets raw discrimination."
      listenHint="Listen…"
      answerHint="Which way did it move?"
      choices={DIRECTIONS.map((d) => ({ id: d.id, label: d.label }))}
      columns={3}
      controller={controller}
      revealName={(id) => DIRECTIONS.find((d) => d.id === id)?.name ?? id}
      onBack={props.onBack}
    />
  )
}

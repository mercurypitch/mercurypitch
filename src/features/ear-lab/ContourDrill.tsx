// ============================================================
// ContourDrill — up, down or same, at speed.
//
// The fast, low-stakes warm-up of the Shape faculty. Items are
// gap tiers, not answers: each trial draws its direction fresh,
// and as the rating climbs the tiers shrink from wide leaps
// toward the hairline gaps where contour meets discrimination.
//
// The instrument is a drum recorder's stylus: it draws the first
// tone level and waits — the second segment is the answer.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { CONTOUR_BANK } from '@/lib/ear/banks'
import { findIdentificationDrill } from '@/lib/ear/drills'
import { CONTOUR_TIMING } from '@/lib/ear/timing'
import { playToneFor } from './ear-sound'
import { IdentificationDrillView } from './IdentificationDrillView'
import type { ContourDirection } from './StylusTrace'
import { StylusTrace } from './StylusTrace'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'

const DIRECTIONS = [
  { id: 'up', label: 'Up', name: 'Up' },
  { id: 'down', label: 'Down', name: 'Down' },
  { id: 'same', label: 'Same', name: 'The same' },
] as const

function asDirection(id: string | null): ContourDirection | null {
  return id === 'up' || id === 'down' || id === 'same' ? id : null
}

export function ContourDrill(props: { onBack: () => void }): JSX.Element {
  const { audioEngine } = useEngines()
  const drill = findIdentificationDrill('contour')
  if (!drill) throw new Error('contour drill missing from catalogue')

  const [sounding, setSounding] = createSignal<0 | 1 | 2>(0)

  /** Set by Stop; the pair in flight reads it between its tones. */
  let cancelled = false

  function makeTrial(item: (typeof CONTOUR_BANK)[number]): IdentificationTrial {
    const gapCents = item.payload[0]
    const direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)]
    const base = 220 * 2 ** (Math.random() * 1.5)
    const second =
      direction.id === 'same'
        ? base
        : base * 2 ** (((direction.id === 'up' ? 1 : -1) * gapCents) / 1200)

    const playPair = async (toneMs: number, gapMs: number) => {
      // Both tones whole: playTone resolves on scheduling and the second
      // note would otherwise cut the first at the gap. Stop lands between
      // the awaits: stopTone silences the tone sounding now, and the
      // check keeps the second from sounding after it.
      cancelled = false
      setSounding(1)
      await playToneFor(audioEngine, base, toneMs)
      if (cancelled) return
      await new Promise((resolve) => setTimeout(resolve, gapMs))
      if (cancelled) return
      setSounding(2)
      await playToneFor(audioEngine, second, toneMs)
      setSounding(0)
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
    {
      cancelAudio: () => {
        cancelled = true
        setSounding(0)
        audioEngine.stopTone(60)
      },
    },
  )

  return (
    <IdentificationDrillView
      title="Contour"
      drillId="contour"
      measures="Shape · direction"
      description="Two quick tones — up, down or the same? Easy until the gaps shrink: the top tier plays quarter-tone and finer moves, where contour hearing meets raw discrimination."
      prompt="Two quick tones — which way did the second one go?"
      listenHint="Listen…"
      answerHint="Which way did it move?"
      choices={DIRECTIONS.map((d) => ({ id: d.id, label: d.label }))}
      columns={3}
      controller={controller}
      revealName={(id) => DIRECTIONS.find((d) => d.id === id)?.name ?? id}
      instrument={() => (
        <StylusTrace
          sounding={controller.phase() === 'playing' ? sounding() : 0}
          armed={controller.phase() === 'answer'}
          reveal={
            controller.phase() === 'reveal' &&
            asDirection(controller.expectedId()) !== null
              ? {
                  direction: asDirection(controller.expectedId()) ?? 'same',
                  wrong:
                    controller.answeredId() !== controller.expectedId()
                      ? asDirection(controller.answeredId())
                      : null,
                }
              : null
          }
        />
      )}
      onBack={props.onBack}
    />
  )
}

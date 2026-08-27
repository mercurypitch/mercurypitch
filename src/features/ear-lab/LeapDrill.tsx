// ============================================================
// LeapDrill — interval identification out of context.
//
// Deliberately framed in-app as the supporting drill (plan §1.2):
// intervals without a key are a vocabulary exercise, not the goal.
// Root roved per round, ascending or descending at a coin flip so
// the ear names the distance, not a memorised melody fragment.
//
// The instrument is a dividing engine's index arc: the interval is
// the angle the needle sweeps from the root — shown only at the
// reveal, since the angle is the answer.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { LEAP_BANK } from '@/lib/ear/banks'
import { findIdentificationDrill } from '@/lib/ear/drills'
import { LEAP_TIMING } from '@/lib/ear/timing'
import { midiToFreq } from '@/lib/scale-data'
import { IdentificationDrillView } from './IdentificationDrillView'
import { IndexArc } from './IndexArc'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'

function semitonesOf(itemId: string | null): number | null {
  const item = LEAP_BANK.find((candidate) => candidate.itemId === itemId)
  return item ? item.payload[0] : null
}

export function LeapDrill(props: { onBack: () => void }): JSX.Element {
  const { audioEngine } = useEngines()
  const drill = findIdentificationDrill('leap')
  if (!drill) throw new Error('leap drill missing from catalogue')

  const [sounding, setSounding] = createSignal<0 | 1 | 2>(0)

  function makeTrial(item: (typeof LEAP_BANK)[number]): IdentificationTrial {
    const root = 48 + Math.floor(Math.random() * 22) // C3..A4
    const ascending = Math.random() < 0.5
    const semitones = item.payload[0]
    const first = midiToFreq(ascending ? root : root + semitones)
    const second = midiToFreq(ascending ? root + semitones : root)

    const playPair = async (toneMs: number, gapMs: number) => {
      setSounding(1)
      await audioEngine.playTone(first, toneMs)
      await new Promise((resolve) => setTimeout(resolve, gapMs))
      setSounding(2)
      await audioEngine.playTone(second, toneMs)
      setSounding(0)
    }

    return {
      expectedId: item.itemId,
      play: () => playPair(LEAP_TIMING.toneMs, LEAP_TIMING.gapMs),
      replayOnWrong: () =>
        playPair(LEAP_TIMING.replayToneMs, LEAP_TIMING.replayGapMs),
    }
  }

  const controller = useIdentificationController(drill, LEAP_BANK, makeTrial, {
    cancelAudio: () => {
      setSounding(0)
      audioEngine.stopTone(60)
    },
  })

  const revealName = (id: string) =>
    LEAP_BANK.find((item) => item.itemId === id)?.name ?? id

  return (
    <IdentificationDrillView
      title="Leap"
      drillId="leap"
      measures="Shape · interval"
      description="Two notes, one distance — name the interval. The supporting vocabulary drill: Home trains the hearing that transfers, Leap names the spans inside it."
      prompt="Two notes — name the distance between them."
      listenHint="Listen to the leap…"
      answerHint="Which interval was that?"
      choices={LEAP_BANK.map((item) => ({
        id: item.itemId,
        label: item.label,
        sub: item.name,
      }))}
      columns={6}
      controller={controller}
      revealName={revealName}
      instrument={() => (
        <IndexArc
          sounding={controller.phase() === 'playing' ? sounding() : 0}
          hunting={controller.phase() === 'answer'}
          reveal={
            controller.phase() === 'reveal' && controller.expectedId() !== null
              ? {
                  semitones: semitonesOf(controller.expectedId()) ?? 0,
                  name: revealName(controller.expectedId() ?? ''),
                  wrongSemitones:
                    controller.answeredId() !== controller.expectedId()
                      ? semitonesOf(controller.answeredId())
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

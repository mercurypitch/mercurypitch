// ============================================================
// LeapDrill — interval identification out of context.
//
// Deliberately framed in-app as the supporting drill (plan §1.2):
// intervals without a key are a vocabulary exercise, not the goal.
// Root roved per round, ascending or descending at a coin flip so
// the ear names the distance, not a memorised melody fragment.
// ============================================================

import type { JSX } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { LEAP_BANK } from '@/lib/ear/banks'
import { findIdentificationDrill } from '@/lib/ear/drills'
import { LEAP_TIMING } from '@/lib/ear/timing'
import { midiToFreq } from '@/lib/scale-data'
import { IdentificationDrillView } from './IdentificationDrillView'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'

export function LeapDrill(props: { onBack: () => void }): JSX.Element {
  const { audioEngine } = useEngines()
  const drill = findIdentificationDrill('leap')
  if (!drill) throw new Error('leap drill missing from catalogue')

  function makeTrial(item: (typeof LEAP_BANK)[number]): IdentificationTrial {
    const root = 48 + Math.floor(Math.random() * 22) // C3..A4
    const ascending = Math.random() < 0.5
    const semitones = item.payload[0]
    const first = midiToFreq(ascending ? root : root + semitones)
    const second = midiToFreq(ascending ? root + semitones : root)

    const playPair = async (toneMs: number, gapMs: number) => {
      await audioEngine.playTone(first, toneMs)
      await new Promise((resolve) => setTimeout(resolve, gapMs))
      await audioEngine.playTone(second, toneMs)
    }

    return {
      expectedId: item.itemId,
      play: () => playPair(LEAP_TIMING.toneMs, LEAP_TIMING.gapMs),
      replayOnWrong: () =>
        playPair(LEAP_TIMING.replayToneMs, LEAP_TIMING.replayGapMs),
    }
  }

  const controller = useIdentificationController(drill, LEAP_BANK, makeTrial, {
    cancelAudio: () => audioEngine.stopTone(60),
  })

  return (
    <IdentificationDrillView
      title="Leap"
      description="Two notes, one distance — name the interval. The supporting vocabulary drill: Home trains the hearing that transfers, Leap names the spans inside it."
      listenHint="Listen to the leap…"
      answerHint="Which interval was that?"
      choices={LEAP_BANK.map((item) => ({
        id: item.itemId,
        label: item.label,
        sub: item.name,
      }))}
      columns={6}
      controller={controller}
      revealName={(id) =>
        LEAP_BANK.find((item) => item.itemId === id)?.name ?? id
      }
      onBack={props.onBack}
    />
  )
}

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
import { playToneFor } from './ear-sound'
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

  /** Set by Stop; the pair in flight reads it between its tones. */
  let cancelled = false

  function makeTrial(item: (typeof LEAP_BANK)[number]): IdentificationTrial {
    const root = 48 + Math.floor(Math.random() * 22) // C3..A4
    const ascending = Math.random() < 0.5
    const semitones = item.payload[0]
    const first = midiToFreq(ascending ? root : root + semitones)
    const second = midiToFreq(ascending ? root + semitones : root)

    const playPair = async (toneMs: number, gapMs: number) => {
      // Both tones whole: playTone resolves on scheduling and the second
      // note would otherwise cut the first at the gap. Stop lands between
      // the awaits: stopTone silences the tone sounding now, and the
      // check keeps the second from sounding after it.
      cancelled = false
      setSounding(1)
      await playToneFor(audioEngine, first, toneMs)
      if (cancelled) return
      await new Promise((resolve) => setTimeout(resolve, gapMs))
      if (cancelled) return
      setSounding(2)
      await playToneFor(audioEngine, second, toneMs)
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
      cancelled = true
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

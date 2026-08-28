// ============================================================
// StackDrill — chord quality identification (Faculty IV opens).
//
// One block chord, roved root: major, minor, diminished,
// augmented, sus4 or dominant 7. A wrong answer replays the chord
// broken then re-stacked — hearing the members one at a time is
// how the quality's colour gets learned, not just tested.
//
// The instrument is a gear train seen end-on: the chord's tones are
// wheels on one axle, and the reveal sets them at their intervals.
// ============================================================

import type { JSX } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { STACK_BANK } from '@/lib/ear/banks'
import { findIdentificationDrill } from '@/lib/ear/drills'
import { STACK_TIMING } from '@/lib/ear/timing'
import { midiToFreq } from '@/lib/scale-data'
import { playToneFor } from './ear-sound'
import { GearTrain } from './GearTrain'
import { IdentificationDrillView } from './IdentificationDrillView'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'

export function StackDrill(props: { onBack: () => void }): JSX.Element {
  const { audioEngine } = useEngines()
  const drill = findIdentificationDrill('stack')
  if (!drill) throw new Error('stack drill missing from catalogue')

  function makeTrial(item: (typeof STACK_BANK)[number]): IdentificationTrial {
    const root = 48 + Math.floor(Math.random() * 13) // C3..C4
    const rootFreq = midiToFreq(root)
    const intervals = [...item.payload]

    // Waited out, so the pads arm once the chord has rung and the
    // broken replay sounds one note at a time instead of all at once.
    const playBlock = (ms: number) =>
      playToneFor(audioEngine, rootFreq, ms, intervals)

    return {
      expectedId: item.itemId,
      play: () => playBlock(STACK_TIMING.chordMs),
      replayOnWrong: async () => {
        // Broken, then re-stacked.
        await playToneFor(audioEngine, rootFreq, STACK_TIMING.brokenNoteMs)
        for (const semis of intervals) {
          await playToneFor(
            audioEngine,
            midiToFreq(root + semis),
            STACK_TIMING.brokenNoteMs,
          )
        }
        await playBlock(STACK_TIMING.replayChordMs)
      },
    }
  }

  const controller = useIdentificationController(drill, STACK_BANK, makeTrial, {
    cancelAudio: () => audioEngine.stopTone(60),
  })

  const itemOf = (id: string | null) =>
    STACK_BANK.find((item) => item.itemId === id) ?? null

  return (
    <IdentificationDrillView
      title="Stack"
      drillId="stack"
      measures="Colour · chord quality"
      description="One chord, roved root — name its quality. Colour hearing starts here: major and minor first, then the qualities that take years by accident and weeks on purpose."
      prompt="One chord — name its quality."
      listenHint="Listen to the stack…"
      answerHint="Which quality was that?"
      choices={STACK_BANK.map((item) => ({
        id: item.itemId,
        label: item.label,
        sub: item.name,
      }))}
      columns={3}
      controller={controller}
      revealName={(id) => itemOf(id)?.name ?? id}
      instrument={() => {
        const expected = () => itemOf(controller.expectedId())
        return (
          <GearTrain
            sounding={controller.phase() === 'playing'}
            reveal={
              controller.phase() === 'reveal' && expected()
                ? {
                    intervals: expected()?.payload ?? [],
                    name: expected()?.name ?? '',
                  }
                : null
            }
          />
        )
      }}
      onBack={props.onBack}
    />
  )
}

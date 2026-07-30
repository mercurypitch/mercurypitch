// ============================================================
// StackDrill — chord quality identification (Faculty IV opens).
//
// One block chord, roved root: major, minor, diminished,
// augmented, sus4 or dominant 7. A wrong answer replays the chord
// broken then re-stacked — hearing the members one at a time is
// how the quality's colour gets learned, not just tested.
// ============================================================

import type { JSX } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { STACK_BANK } from '@/lib/ear/banks'
import { findIdentificationDrill } from '@/lib/ear/drills'
import { midiToFreq } from '@/lib/scale-data'
import { IdentificationDrillView } from './IdentificationDrillView'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'

const CHORD_MS = 1100

export function StackDrill(props: { onBack: () => void }): JSX.Element {
  const { audioEngine } = useEngines()
  const drill = findIdentificationDrill('stack')
  if (!drill) throw new Error('stack drill missing from catalogue')

  function makeTrial(item: (typeof STACK_BANK)[number]): IdentificationTrial {
    const root = 48 + Math.floor(Math.random() * 13) // C3..C4
    const rootFreq = midiToFreq(root)
    const intervals = [...item.payload]

    const playBlock = (ms: number) =>
      audioEngine.playTone(
        rootFreq,
        ms,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        intervals,
      )

    return {
      expectedId: item.itemId,
      play: () => playBlock(CHORD_MS),
      replayOnWrong: async () => {
        // Broken, then re-stacked.
        await audioEngine.playTone(rootFreq, 280)
        for (const semis of intervals) {
          await audioEngine.playTone(midiToFreq(root + semis), 280)
        }
        await playBlock(900)
      },
    }
  }

  const controller = useIdentificationController(drill, STACK_BANK, makeTrial)

  return (
    <IdentificationDrillView
      title="Stack"
      description="One chord, roved root — name its quality. Colour hearing starts here: major and minor first, then the qualities that take years by accident and weeks on purpose."
      listenHint="Listen to the stack…"
      answerHint="Which quality was that?"
      choices={STACK_BANK.map((item) => ({
        id: item.itemId,
        label: item.label,
        sub: item.name,
      }))}
      columns={3}
      controller={controller}
      revealName={(id) =>
        STACK_BANK.find((item) => item.itemId === id)?.name ?? id
      }
      onBack={props.onBack}
    />
  )
}

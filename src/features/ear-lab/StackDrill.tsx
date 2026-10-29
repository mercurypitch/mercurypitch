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
//
// In the native room a miss offers Compare: the answer's chord, then
// the pick's, both stacked on the question's root.
// ============================================================

import type { JSX } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { STACK_BANK } from '@/lib/ear/banks'
import { findIdentificationDrill } from '@/lib/ear/drills'
import { COMPARE_TIMING, STACK_TIMING } from '@/lib/ear/timing'
import { EAR_LAB_WITH_MERC } from '@/lib/native-build'
import { midiToFreq } from '@/lib/scale-data'
import { playToneFor } from './ear-sound'
import { GearTrain } from './GearTrain'
import type { IdentificationCompare } from './IdentificationDrillView'
import { IdentificationDrillView } from './IdentificationDrillView'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'

/** A chord's quality as it is said: "major chord", "dominant seventh
 *  chord". */
function spokenChord(itemId: string): string {
  const name = STACK_BANK.find((item) => item.itemId === itemId)?.name ?? itemId
  return `${name
    .replace(/\b4th\b/u, 'fourth')
    .replace(/\b7th\b/u, 'seventh')
    .toLowerCase()} chord`
}

/** Compare's words, for the native room alone. */
const STACK_COMPARE: IdentificationCompare | undefined = EAR_LAB_WITH_MERC
  ? {
      names: (answerId, pickId) => ({
        answer: `the ${spokenChord(answerId)}`,
        pick: spokenChord(pickId),
      }),
    }
  : undefined

export function StackDrill(props: { onBack: () => void }): JSX.Element {
  const { audioEngine } = useEngines()
  const drill = findIdentificationDrill('stack')
  if (!drill) throw new Error('stack drill missing from catalogue')

  /** Which pair (or replay) is the live one. A flag reset at the top of
   *  every pair let a pair still sounding when Stop and Begin came within
   *  a second pass its check and play its second tone over the new run;
   *  a token only the newest pair holds cannot. */
  let pair = 0

  function makeTrial(item: (typeof STACK_BANK)[number]): IdentificationTrial {
    const root = 48 + Math.floor(Math.random() * 13) // C3..C4
    const rootFreq = midiToFreq(root)
    const intervals = [...item.payload]

    // Waited out, so the pads arm once the chord has rung and the
    // broken replay sounds one note at a time instead of all at once.
    const playBlock = (ms: number, members: number[] = intervals) =>
      playToneFor(audioEngine, rootFreq, ms, members)

    return {
      expectedId: item.itemId,
      play: () => playBlock(STACK_TIMING.chordMs),
      replayOnWrong: async () => {
        // Broken, then re-stacked. Stop lands between the notes: stopTone
        // silences the one sounding, and the checks keep the rest quiet.
        const mine = ++pair
        await playToneFor(audioEngine, rootFreq, STACK_TIMING.brokenNoteMs)
        for (const semis of intervals) {
          if (mine !== pair) return
          await playToneFor(
            audioEngine,
            midiToFreq(root + semis),
            STACK_TIMING.brokenNoteMs,
          )
        }
        if (mine !== pair) return
        await playBlock(STACK_TIMING.replayChordMs)
      },
      ...(EAR_LAB_WITH_MERC
        ? {
            // The answer's chord, then the pick's, on the same root.
            compare: async (pickedId: string): Promise<void> => {
              const picked = STACK_BANK.find(
                (entry) => entry.itemId === pickedId,
              )
              if (picked === undefined) return
              const mine = ++pair
              await playBlock(STACK_TIMING.chordMs)
              if (mine !== pair) return
              await new Promise((resolve) =>
                setTimeout(resolve, COMPARE_TIMING.gapMs),
              )
              if (mine !== pair) return
              await playBlock(STACK_TIMING.chordMs, [...picked.payload])
            },
          }
        : {}),
    }
  }

  const controller = useIdentificationController(drill, STACK_BANK, makeTrial, {
    cancelAudio: () => {
      pair += 1
      audioEngine.stopTone(60)
    },
  })

  const itemOf = (id: string | null) =>
    STACK_BANK.find((item) => item.itemId === id) ?? null

  return (
    <IdentificationDrillView
      title="Stack"
      drillId="stack"
      measures="Color · chord quality"
      description="One chord, roved root. Name its quality. Color hearing starts here: major and minor first, then the qualities that take years by accident and weeks on purpose."
      prompt="One chord. Name its quality."
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
      compare={STACK_COMPARE}
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

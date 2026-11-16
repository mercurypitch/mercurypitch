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
//
// In the native room a miss offers Compare: the answer's leap, then
// the pick's, both from the question's first note and the same way.
//
// A lesson's link can narrow it to some of the twelve (Lesson 23's
// perfect intervals and the tritone, lib/ear/subsets.ts): the set's pads
// only, rated on the set's own track.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { LEAP_BANK } from '@/lib/ear/banks'
import { findIdentificationDrill } from '@/lib/ear/drills'
import type { EarSubset } from '@/lib/ear/subsets'
import { listWords, narrowBank, subsetLine, subsetRatingLine, } from '@/lib/ear/subsets'
import { compareSequence, LEAP_TIMING, sleep } from '@/lib/ear/timing'
import { EAR_LAB_WITH_MERC } from '@/lib/native-build'
import { midiToFreq } from '@/lib/scale-data'
import { playToneFor } from './ear-sound'
import type { IdentificationCompare } from './IdentificationDrillView'
import { IdentificationDrillView } from './IdentificationDrillView'
import { IndexArc } from './IndexArc'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'

function semitonesOf(itemId: string | null): number | null {
  const item = LEAP_BANK.find((candidate) => candidate.itemId === itemId)
  return item ? item.payload[0] : null
}

const ORDINALS: Readonly<Record<string, string>> = {
  '2nd': 'second',
  '3rd': 'third',
  '4th': 'fourth',
  '5th': 'fifth',
  '6th': 'sixth',
  '7th': 'seventh',
}

/** An interval as a musician says it: "fifth" for a perfect fifth,
 *  "minor second", "tritone", "octave". */
function spokenInterval(itemId: string): string {
  const name = LEAP_BANK.find((item) => item.itemId === itemId)?.name ?? itemId
  return name
    .replace(/^Perfect /u, '')
    .replace(
      /\b[2-7](?:nd|rd|th)\b/u,
      (ordinal) => ORDINALS[ordinal] ?? ordinal,
    )
    .toLowerCase()
}

const COUNTS = [
  'No',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
]

/** "Two semitones wider.": the answer against the pick. */
function semitonesApart(answerId: string, pickId: string): string | null {
  const answer = semitonesOf(answerId)
  const pick = semitonesOf(pickId)
  if (answer === null || pick === null || answer === pick) return null
  const apart = Math.abs(answer - pick)
  const count = COUNTS[apart] ?? String(apart)
  return `${count} semitone${apart === 1 ? '' : 's'} ${
    answer > pick ? 'wider' : 'narrower'
  }.`
}

/** Compare's words, for the native room alone. */
const LEAP_COMPARE: IdentificationCompare | undefined = EAR_LAB_WITH_MERC
  ? {
      names: (answerId, pickId) => ({
        answer: `the ${spokenInterval(answerId)}`,
        pick: spokenInterval(pickId),
      }),
      difference: semitonesApart,
    }
  : undefined

export function LeapDrill(props: {
  onBack: () => void
  /** A lesson's set of some of the twelve; the whole drill without. */
  subset?: EarSubset | null
}): JSX.Element {
  const { audioEngine } = useEngines()
  const drill = findIdentificationDrill('leap')
  if (!drill) throw new Error('leap drill missing from catalogue')
  // A stage is mounted per drill and per set, never re-pointed.
  // eslint-disable-next-line solid/reactivity
  const subset = props.subset ?? null
  const bank = narrowBank(LEAP_BANK, subset)

  const [sounding, setSounding] = createSignal<0 | 1 | 2>(0)

  /** Which pair (or replay) is the live one. A flag reset at the top of
   *  every pair let a pair still sounding when Stop and Begin came within
   *  a second pass its check and play its second tone over the new run;
   *  a token only the newest pair holds cannot. */
  let pair = 0

  function makeTrial(item: (typeof LEAP_BANK)[number]): IdentificationTrial {
    const root = 48 + Math.floor(Math.random() * 22) // C3..A4
    const ascending = Math.random() < 0.5
    const semitones = item.payload[0]
    /** The question's first note: every leap this trial sounds starts
     *  there and goes its way, so a pick compares with the answer. */
    const start = ascending ? root : root + semitones

    /** One leap, both tones whole, while `mine` is the live pair.
     *  playTone resolves on scheduling and the second note would
     *  otherwise cut the first at the gap. Stop lands between the
     *  awaits: stopTone silences the tone sounding now, and the check
     *  keeps the next from sounding after it. False once silenced. */
    const soundLeap = async (
      span: number,
      toneMs: number,
      gapMs: number,
      mine: number,
    ): Promise<boolean> => {
      setSounding(1)
      await playToneFor(audioEngine, midiToFreq(start), toneMs)
      if (mine !== pair) return false
      await sleep(gapMs)
      if (mine !== pair) return false
      setSounding(2)
      await playToneFor(
        audioEngine,
        midiToFreq(ascending ? start + span : start - span),
        toneMs,
      )
      setSounding(0)
      return mine === pair
    }

    const playPair = async (toneMs: number, gapMs: number): Promise<void> => {
      await soundLeap(semitones, toneMs, gapMs, ++pair)
    }

    return {
      expectedId: item.itemId,
      play: () => playPair(LEAP_TIMING.toneMs, LEAP_TIMING.gapMs),
      replayOnWrong: () =>
        playPair(LEAP_TIMING.replayToneMs, LEAP_TIMING.replayGapMs),
      ...(EAR_LAB_WITH_MERC
        ? {
            // The answer's leap, then the pick's, as the question sounded.
            compare: async (pickedId: string): Promise<void> => {
              const picked = semitonesOf(pickedId)
              if (picked === null) return
              const mine = ++pair
              const { toneMs, gapMs } = LEAP_TIMING
              await compareSequence(
                () => soundLeap(semitones, toneMs, gapMs, mine),
                () => soundLeap(picked, toneMs, gapMs, mine),
                () => mine === pair,
              )
            },
          }
        : {}),
    }
  }

  const controller = useIdentificationController(drill, bank, makeTrial, {
    cancelAudio: () => {
      pair += 1
      setSounding(0)
      audioEngine.stopTone(60)
    },
    subset,
  })

  const revealName = (id: string) =>
    LEAP_BANK.find((item) => item.itemId === id)?.name ?? id

  return (
    <IdentificationDrillView
      title="Leap"
      drillId="leap"
      measures="Shape · interval"
      description="Two notes, one distance. Name the interval. The supporting vocabulary drill: Home trains the hearing that transfers, Leap names the spans inside it."
      prompt="Two notes. Name the distance between them."
      listenHint="Listen to the leap…"
      answerHint="Which interval was that?"
      choices={bank.map((item) => ({
        id: item.itemId,
        label: item.label,
        sub: item.name,
      }))}
      columns={subset ? 2 : 6}
      lessonSet={
        subset
          ? {
              asks: listWords(bank.map((item) => item.label)),
              note: `${subsetLine(
                bank.map((item) => item.label),
                LEAP_BANK.length,
              )} ${subsetRatingLine('Leap')}`,
            }
          : undefined
      }
      controller={controller}
      revealName={revealName}
      compare={LEAP_COMPARE}
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

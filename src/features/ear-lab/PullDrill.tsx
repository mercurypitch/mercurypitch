// ============================================================
// PullDrill — which of two degrees leans harder.
//
// A cadence plants the key, two degrees sound one after the other
// over it, and the question is which one wants to move — the
// tendency table's answer (7 up to the tonic hardest, then 4 down
// to 3, then 6 and 2; 1, 3 and 5 rest). Pairs come from a bank of
// the comparisons that are not in dispute; the order the two sound
// in is a coin flip, so the answer is "the first" or "the second"
// and the rating carries a 1/2 guess floor.
//
// A miss replays the leaning degree and lets it resolve, so the
// ear hears the pull it just missed.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import type { EarBankItem } from '@/lib/ear/banks'
import { findIdentificationDrill } from '@/lib/ear/drills'
import { cadenceChordMidis, roveRootMidi } from '@/lib/ear/item-bank'
import { degreeSemitone } from '@/lib/ear/phrase'
import { leaningWord, morePulling, PULL_BANK, pullOf, resolvesTo, } from '@/lib/ear/tendency'
import { PULL_TIMING } from '@/lib/ear/timing'
import { midiToFreq } from '@/lib/scale-data'
import { IdentificationDrillView } from './IdentificationDrillView'
import { PullBeam } from './PullBeam'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'

const CHOICES = [
  { id: 'first', label: 'The first' },
  { id: 'second', label: 'The second' },
]

export function PullDrill(props: { onBack: () => void }): JSX.Element {
  const { audioEngine } = useEngines()
  const drill = findIdentificationDrill('the-pull')
  if (!drill) throw new Error('the-pull drill missing from catalogue')

  const [sounding, setSounding] = createSignal<0 | 1 | 2>(0)
  const [leaning, setLeaning] = createSignal<{
    side: 1 | 2
    degree: number
    /** The other note, the one at rest or leaning less. */
    other: number
  } | null>(null)
  /** The cadence's chord sounding, 1-based; 0 for none. */
  const [cadence, setCadence] = createSignal(0)
  /** Bumped by every silencing. A sound notes it as it starts and stops
   *  at the first await that finds it moved: a Stop, a closed room or the
   *  sound taken away while it waited on the audio engine (iOS holds
   *  resume() through a call) sounds nothing once the engine wakes, and
   *  no later sound can undo it, as resetting a flag did. */
  let silenced = 0
  let rootMidi = 48

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  function cancelAudio(): void {
    silenced += 1
    audioEngine.stopTone(60)
    setSounding(0)
    setCadence(0)
  }

  async function tone(degree: number, ms: number): Promise<void> {
    await audioEngine.playTone(
      midiToFreq(rootMidi + degreeSemitone(degree)),
      ms,
    )
    await wait(ms)
  }

  async function plant(asked: number): Promise<void> {
    for (const [i, chord] of cadenceChordMidis(rootMidi).entries()) {
      if (asked !== silenced) return
      setCadence(i + 1)
      await audioEngine.playChord(chord.map(midiToFreq), PULL_TIMING.chordMs)
      await wait(PULL_TIMING.chordMs + PULL_TIMING.chordGapMs)
    }
    setCadence(0)
    await wait(PULL_TIMING.restMs)
  }

  function makeTrial(item: EarBankItem): IdentificationTrial {
    const [a, b] = item.payload
    const order: [number, number] = Math.random() < 0.5 ? [a, b] : [b, a]
    const harder = morePulling(a, b)
    const side: 1 | 2 = order[0] === harder ? 1 : 2
    return {
      expectedId: side === 1 ? 'first' : 'second',
      play: async () => {
        const asked = silenced
        await audioEngine.init()
        await audioEngine.resume()
        if (asked !== silenced) return
        rootMidi = roveRootMidi()
        setLeaning({
          side,
          degree: harder,
          other: order[side === 1 ? 1 : 0],
        })
        await plant(asked)
        for (const [i, degree] of order.entries()) {
          if (asked !== silenced) return
          setSounding((i + 1) as 1 | 2)
          await tone(degree, PULL_TIMING.probeMs)
          setSounding(0)
          if (i === 0) await wait(PULL_TIMING.probeGapMs)
        }
        await wait(PULL_TIMING.tailMs)
      },
      // The pull, then where it goes: the lean resolved. A Stop between
      // the two keeps the resolution quiet.
      replayOnWrong: async () => {
        const asked = silenced
        setSounding(side)
        await tone(harder, PULL_TIMING.replayMs)
        if (asked !== silenced) return
        setSounding(0)
        await wait(PULL_TIMING.probeGapMs)
        if (asked !== silenced) return
        await tone(resolvesTo(harder), PULL_TIMING.replayMs)
      },
    }
  }

  const controller = useIdentificationController(drill, PULL_BANK, makeTrial, {
    cancelAudio,
  })
  const phase = () => controller.phase()

  const nameOf = (choiceId: string) => {
    const current = leaning()
    const which = choiceId === 'first' ? 'the first' : 'the second'
    if (!current) return which
    const expectedSide = current.side === 1 ? 'first' : 'second'
    return choiceId === expectedSide
      ? `${which}, ${leaningWord(current.degree)}`
      : which
  }

  return (
    <IdentificationDrillView
      title="The Pull"
      drillId="the-pull"
      measures="Function · tendency"
      description="A cadence plants the key, then two degrees sound, one after the other. Which one wants to move? The leading tone leans hardest, up to home; 4 leans down to 3; 6 and 2 lean more gently; 1, 3 and 5 rest. A miss plays the leaning note again and lets it resolve, so you hear the pull."
      prompt="Two degrees over the key. Which one leans harder?"
      listenHint="Listen to the two notes…"
      answerHint="Which note leans harder: the first, or the second?"
      choices={CHOICES}
      padLamp={(id) =>
        phase() === 'playing' && sounding() === (id === 'first' ? 1 : 2)
      }
      columns={2}
      controller={controller}
      revealName={nameOf}
      instrument={() => (
        <PullBeam
          sounding={sounding()}
          cadence={cadence()}
          reveal={
            phase() === 'reveal' && leaning()
              ? {
                  side: leaning()?.side ?? 1,
                  pull: pullOf(leaning()?.degree ?? 1),
                  word: leaningWord(leaning()?.degree ?? 1),
                  rest: leaningWord(leaning()?.other ?? 1),
                  toward:
                    resolvesTo(leaning()?.degree ?? 1) >=
                    (leaning()?.degree ?? 1)
                      ? 'up'
                      : 'down',
                }
              : null
          }
        />
      )}
      onBack={props.onBack}
    />
  )
}

// ============================================================
// HairlineDrill — 2AFC pitch discrimination.
//
// Stimulus: two tones separated by the staircase's current gap,
// higher-first at a coin flip, base pitch roved log-uniformly so
// absolute pitch memory cannot substitute for discrimination.
//
// The instrument is a vernier under a loupe: the two tones are two
// hairlines whose gap is the difficulty (shown openly — it is not
// the answer). Which tone was higher stays hidden until the reveal.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { findThresholdDrill } from '@/lib/ear/drills'
import { HAIRLINE_TIMING } from '@/lib/ear/timing'
import { latestThresholdReading } from '@/stores/ear-lab-store'
import { playToneFor } from './ear-sound'
import type { PadState } from './EarStage'
import { Pads, StagePad } from './EarStage'
import { ThresholdDrillView } from './ThresholdDrillView'
import { useThresholdRun } from './use-threshold-run'
import { VernierLoupe } from './VernierLoupe'

interface HairlineDrillProps {
  onBack: () => void
  /** The bench's amber control: open in the sealed protocol — the
   *  pendulums at rest, Begin instead of Practice. */
  ritual?: boolean
}

/** Rove the base log-uniformly across A3..A5. */
function roveBaseFreq(random: () => number): number {
  return 220 * 2 ** (random() * 2)
}

export function HairlineDrill(props: HairlineDrillProps): JSX.Element {
  const { audioEngine } = useEngines()
  const drill = findThresholdDrill('hairline')
  if (!drill) throw new Error('hairline drill missing from catalogue')

  const [higherFirst, setHigherFirst] = createSignal(false)
  const [picked, setPicked] = createSignal<1 | 2 | null>(null)

  const run = useThresholdRun(
    drill,
    async (level, api) => {
      const base = roveBaseFreq(Math.random)
      const first = Math.random() < 0.5
      setHigherFirst(first)
      setPicked(null)
      const higher = base * 2 ** (level / 1200)

      // Each tone is waited out: the pads arm only once the second has
      // finished sounding, so an answer is never a guess at a tone still
      // in the air.
      api.step(1)
      await playToneFor(
        audioEngine,
        first ? higher : base,
        HAIRLINE_TIMING.toneMs,
      )
      if (api.cancelled()) return
      await new Promise((resolve) => setTimeout(resolve, HAIRLINE_TIMING.gapMs))
      if (api.cancelled()) return
      api.step(2)
      await playToneFor(
        audioEngine,
        first ? base : higher,
        HAIRLINE_TIMING.toneMs,
      )
    },
    // Stop cuts the tone that is already sounding; without this the
    // drill keeps playing after the plate appears.
    { cancelStimulus: () => audioEngine.stopTone(60) },
  )

  const answer = (choice: 1 | 2) => {
    if (run.phase() !== 'answer') return
    setPicked(choice)
    run.answerCorrect(choice === (higherFirst() ? 1 : 2))
  }

  const higherWord = () => (higherFirst() ? 'first' : 'second')
  const gap = () => `${run.level().toFixed(1)}¢`

  const padState = (choice: 1 | 2): PadState => {
    if (run.phase() !== 'reveal') return null
    if (choice === (higherFirst() ? 1 : 2)) return 'right'
    if (choice === picked()) return 'wrong'
    return null
  }

  const sounding = () =>
    run.phase() === 'stimulus' ? (run.stimulusStep() as 0 | 1 | 2) : 0

  return (
    <ThresholdDrillView
      title="Hairline"
      drillId="hairline"
      measures="Resolution · cents"
      description="Two tones; pick the higher one. The gap keeps shrinking toward the finest difference your ear still resolves — that number, in cents, is your reading. It falls as you improve, and there is no ceiling to park at."
      prompt="Two tones — which one was higher?"
      listenHint="Listen…"
      answerHint="Which tone was higher — the first, or the second?"
      levelCaption="Gap"
      levelLabel={gap}
      formatValue={(value) => value.toFixed(1)}
      unitLabel="cents"
      unitShort="¢"
      latestValue={() => latestThresholdReading('hairline')?.value ?? null}
      ritual={props.ritual}
      run={run}
      instrument={() => (
        <VernierLoupe
          gap={run.level()}
          sounding={sounding()}
          reveal={run.phase() === 'reveal' ? higherWord() : null}
        />
      )}
      pads={() => (
        <Pads columns={2} label="Which tone was higher?">
          <StagePad
            keycap="1"
            label="The first"
            state={padState(1)}
            disabled={run.phase() !== 'answer'}
            onClick={() => answer(1)}
          />
          <StagePad
            keycap="2"
            label="The second"
            state={padState(2)}
            disabled={run.phase() !== 'answer'}
            onClick={() => answer(2)}
          />
        </Pads>
      )}
      keys={() => [
        { key: '1', action: () => answer(1) },
        { key: '2', action: () => answer(2) },
      ]}
      revealLine={() =>
        run.lastCorrect() === true
          ? `Right — the ${higherWord()} was higher by ${gap()}.`
          : `The ${higherWord()} was higher by ${gap()}. The gap widens.`
      }
      onBack={props.onBack}
    />
  )
}

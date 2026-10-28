// The room's data from a staircase view: Calibrate on the plate follows
// the answer mode. Span's sung answers are practice only, and the mode
// can change under "?" after the room has opened, so the room must read
// it where it shows the button, not once as it mounts.

import { render } from '@solidjs/testing-library'
import { createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { findThresholdDrill } from '@/lib/ear/drills'
import type * as NativeBuild from '@/lib/native-build'
import type { EarStageProps } from './EarStage'
import type { StageRoom } from './stage-room'
import { ThresholdDrillView } from './ThresholdDrillView'
import { useThresholdRun } from './use-threshold-run'

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  EAR_LAB_WITH_MERC: true,
}))

/** The room the view hands its stage, kept to read back. */
const handed: { room: StageRoom | undefined } = { room: undefined }

// The arming cue sounds through the app's engine; the room's data does not.
vi.mock('./arming-cue', () => ({ useArmingCue: () => undefined }))

vi.mock('./stage-switch', () => ({
  EarStage: (props: EarStageProps) => {
    // eslint-disable-next-line solid/reactivity -- kept to read back, not drawn
    handed.room = props.room
    return null
  },
}))

const span = findThresholdDrill('span')
if (!span) throw new Error('span missing from catalogue')

afterEach(() => {
  handed.room = undefined
})

describe("a staircase's room", () => {
  it('offers Calibrate only while the answers are tapped', () => {
    createRoot((dispose) => {
      const [sung, setSung] = createSignal(false)
      const run = useThresholdRun(span, async () => undefined)
      render(() => (
        <ThresholdDrillView
          title="Span"
          drillId="span"
          measures="Shape · notes held"
          description=""
          prompt=""
          listenHint=""
          answerHint=""
          levelLabel={() => '4 notes'}
          levelCaption="Length"
          formatValue={(value) => value.toFixed(0)}
          unitLabel="notes"
          unitShort=" notes"
          latestValue={() => null}
          run={run}
          instrument={() => null}
          pads={() => null}
          keys={() => []}
          revealLine={() => ''}
          practiceOnly={sung}
          onBack={() => undefined}
        />
      ))
      expect(handed.room?.calibrate).toBeTypeOf('function')
      setSung(true)
      expect(handed.room?.calibrate).toBeUndefined()
      setSung(false)
      expect(handed.room?.calibrate).toBeTypeOf('function')
      dispose()
    })
  })
})

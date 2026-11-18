// A lesson's set in Merc's room (EAR_LAB_WITH_MERC): the drill hands the
// room the same set as the older stage, so the address does not depend on
// which bench is showing. Leap's console says what the set asks and draws
// its four pads, and the room's plate names the rating as the set's;
// Gravity's console draws Te's and Ti's pads.

import { render, within } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineContext } from '@/contexts/EngineContext'
import type { AudioEngine } from '@/lib/audio-engine'
import type { EarSubset } from '@/lib/ear/subsets'
import { resolveEarSubset } from '@/lib/ear/subsets'
import type * as NativeBuild from '@/lib/native-build'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { resetEarLabStore, setHomeAnswerMode } from '@/stores/ear-lab-store'
import type { EarStageProps } from './EarStage'
import { GravityDrill } from './GravityDrill'
import { LeapDrill } from './LeapDrill'
import { setRevealRule } from './reveal-pacing'
import type { RoomBeat, StageRoom } from './stage-room'

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  EAR_LAB_WITH_MERC: true,
}))
vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))
vi.mock('@/lib/audio-unlock', () => ({
  unlockAudio: vi.fn(async () => undefined),
  activateAudioPlayback: vi.fn(async () => undefined),
}))
vi.mock('./arming-cue', () => ({ useArmingCue: () => undefined }))

/** What the drill hands its stage, kept to drive and read back. */
const handed: { props: EarStageProps | undefined } = { props: undefined }
vi.mock('./stage-switch', () => ({
  EarStage: (props: EarStageProps) => {
    // eslint-disable-next-line solid/reactivity -- kept to read back, not drawn
    handed.props = props
    return null
  },
}))

const engine = {
  init: vi.fn(async () => undefined),
  resume: vi.fn(async () => undefined),
  getAudioContext: () => ({}) as AudioContext,
  getVolume: () => 0.8,
  setToneTrim: vi.fn(),
  playTone: vi.fn(async () => undefined),
  playChord: vi.fn().mockResolvedValue(undefined),
  stopTone: vi.fn(),
}

const engines = {
  audioEngine: engine as unknown as AudioEngine,
  practiceEngine: {} as PracticeEngine,
  playbackRuntime: {} as PlaybackRuntime,
  ready: () => true,
}

function stage(): EarStageProps {
  if (!handed.props) throw new Error('the drill handed nothing to its stage')
  return handed.props
}

function room(): StageRoom {
  const own = stage().room
  if (!own) throw new Error('the drill handed its stage no room')
  return own
}

/** Run the clock until the room is on `beat`. */
async function until(beat: RoomBeat): Promise<void> {
  for (let ms = 0; ms < 20_000 && room().beat() !== beat; ms += 50) {
    await vi.advanceTimersByTimeAsync(50)
  }
  expect(room().beat()).toBe(beat)
}

/** The console the room draws under Merc, as the drill gives it. */
function drawConsole(): HTMLElement {
  const { container } = render(() => (
    <EngineContext.Provider value={engines}>
      {stage().console()}
    </EngineContext.Provider>
  ))
  return container
}

function setOf(drillId: string, items: readonly string[]): EarSubset {
  const subset = resolveEarSubset(drillId, items)
  if (subset === null) throw new Error(`${items.join(', ')} is no set`)
  return subset
}

beforeEach(() => {
  localStorage.clear()
  resetEarLabStore()
  setHomeAnswerMode('tap')
  setRevealRule('switch')
  vi.useFakeTimers()
})

afterEach(() => {
  handed.props = undefined
  vi.useRealTimers()
})

describe("a lesson's set in Merc's room", () => {
  it("says Leap's set at idle, and draws only its four pads", async () => {
    render(() => (
      <EngineContext.Provider value={engines}>
        <LeapDrill
          onBack={vi.fn()}
          subset={setOf('leap', ['leap:P4', 'leap:TT', 'leap:P5', 'leap:P8'])}
        />
      </EngineContext.Provider>
    ))
    expect(drawConsole().textContent).toContain(
      'Only P4, TT, P5 and P8 this time, four of the twelve.',
    )

    room().again?.()
    await until('answer')
    const pads = within(drawConsole())
      .getAllByRole('button')
      .map((pad) => pad.textContent ?? '')
      .filter((text) => /Perfect|Tritone|Octave|2nd|3rd|6th|7th/.test(text))

    expect(pads).toEqual([
      expect.stringContaining('Perfect 4th'),
      expect.stringContaining('Tritone'),
      expect.stringContaining('Perfect 5th'),
      expect.stringContaining('Octave'),
    ])
  })

  it("names the rating on the room's plate as the set's", async () => {
    render(() => (
      <EngineContext.Provider value={engines}>
        <LeapDrill
          onBack={vi.fn()}
          subset={setOf('leap', ['leap:P4', 'leap:TT', 'leap:P5', 'leap:P8'])}
        />
      </EngineContext.Provider>
    ))

    room().again?.()
    await until('answer')
    stage()
      .keys?.()
      .find((entry) => entry.key === '1')
      ?.action(0)
    stage().onStop?.()
    await until('done')

    expect(room().plate?.()).toMatchObject({
      kind: 'rating',
      source: 'Leap rating on this set',
      rounds: 1,
    })
  })

  it("draws Gravity's Te and Ti pads alone", async () => {
    render(() => (
      <EngineContext.Provider value={engines}>
        <GravityDrill
          onBack={vi.fn()}
          subset={setOf('gravity', ['gravity:deg-11', 'gravity:deg-12'])}
        />
      </EngineContext.Provider>
    ))
    expect(drawConsole().textContent).toContain(
      'Only ♭7 (Te) and 7 (Ti) this time, two of the twelve.',
    )

    room().again?.()
    await until('answer')

    const pads = within(drawConsole()).getAllByText(/^(Te|Ti)$/)

    expect(pads.map((pad) => pad.textContent)).toEqual(['Te', 'Ti'])
  })
})

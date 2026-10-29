// Home in the native room: a rated run's slip, "4 Fa heard as 5 Sol",
// offers practice on Fa against Sol. The practice runs as practice,
// asks only Fa and Sol, leaves the rating where the rated run left it,
// and ends on a tally of its own.

import { render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineContext } from '@/contexts/EngineContext'
import type { AudioEngine } from '@/lib/audio-engine'
import type * as ItemBank from '@/lib/ear/item-bank'
import type * as NativeBuild from '@/lib/native-build'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { earPlayerRating, resetEarLabStore, setHomeAnswerMode, } from '@/stores/ear-lab-store'
import type { EarStageProps } from './EarStage'
import { HomeDrill } from './HomeDrill'
import { PAIR_PRACTICE_ROUNDS } from './pair-practice'
import { setRevealRule } from './reveal-pacing'
import type { RoomBeat, StageRoom } from './stage-room'

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  EAR_LAB_WITH_MERC: true,
}))
vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))
vi.mock('./arming-cue', () => ({ useArmingCue: () => undefined }))
// A rated run asks Fa every round.
vi.mock('@/lib/ear/item-bank', async (importOriginal) => {
  const original = await importOriginal<typeof ItemBank>()
  const fa = original.HOME_DEGREES[3]
  return {
    ...original,
    pickHomeItem: () => ({
      degree: fa,
      itemId: original.homeItemId(fa.degree),
      difficulty: fa.seed,
    }),
  }
})

/** What the drill hands its stage, kept to drive and read back. */
const handed: { props: EarStageProps | undefined } = { props: undefined }
vi.mock('./stage-switch', () => ({
  EarStage: (props: EarStageProps) => {
    // eslint-disable-next-line solid/reactivity -- kept to read back, not drawn
    handed.props = props
    return null
  },
}))

function stage(): EarStageProps {
  if (!handed.props) throw new Error('Home handed nothing to its stage')
  return handed.props
}

function room(): StageRoom {
  const own = stage().room
  if (!own) throw new Error('Home handed its stage no room')
  return own
}

/** Run the clock until the room is on `beat`. */
async function until(beat: RoomBeat): Promise<void> {
  for (let ms = 0; ms < 20_000 && room().beat() !== beat; ms += 50) {
    await vi.advanceTimersByTimeAsync(50)
  }
  expect(room().beat()).toBe(beat)
}

/** Answer the question waiting, by its key, as a tap. */
function press(key: string): void {
  const found = stage()
    .keys?.()
    .find((entry) => entry.key === key)
  if (!found) throw new Error(`no key ${key}`)
  found.action(0)
}

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

describe("Home's slip", () => {
  it('offers Fa against Sol, and practises only those two, rating nothing', async () => {
    render(() => (
      <EngineContext.Provider
        value={{
          audioEngine: engine as unknown as AudioEngine,
          practiceEngine: {} as PracticeEngine,
          playbackRuntime: {} as PlaybackRuntime,
          ready: () => true,
        }}
      >
        <HomeDrill onBack={vi.fn()} />
      </EngineContext.Provider>
    ))

    // A rated run: Fa heard as Sol, every time.
    room().again?.()
    for (let round = 0; round < 12; round++) {
      await until('answer')
      press('5')
    }
    await until('done')
    const rated = room().plate?.()
    if (rated?.kind !== 'rating') throw new Error('no rated plate')
    expect(rated.slips).toHaveLength(1)
    expect(rated.slips[0]).toMatchObject({
      expected: '4 Fa',
      answered: '5 Sol',
      count: 12,
    })
    const after = earPlayerRating('home')

    rated.slips[0].practise?.()
    await vi.advanceTimersByTimeAsync(0)
    expect(room().run()).toBe('practice')
    expect(room().practising?.()).toEqual(['4 Fa', '5 Sol'])
    const verdicts: string[] = []
    for (let round = 0; round < PAIR_PRACTICE_ROUNDS; round++) {
      await until('answer')
      press('4')
      verdicts.push(stage().status)
    }
    await until('done')

    // Fa named right, or Sol it was: nothing else is asked.
    for (const verdict of verdicts) {
      expect(verdict).toMatch(/^(Yes\. Fa \(4\)\.|That was Sol \(5\)\.)/)
    }
    expect(
      verdicts.filter((verdict) => verdict.startsWith('Yes')),
    ).toHaveLength(PAIR_PRACTICE_ROUNDS / 2)
    expect(earPlayerRating('home')).toEqual(after)
    expect(room().plate?.()).toMatchObject({
      kind: 'practice',
      against: ['4 Fa', '5 Sol'],
      rounds: PAIR_PRACTICE_ROUNDS,
      right: PAIR_PRACTICE_ROUNDS / 2,
    })
  })
})

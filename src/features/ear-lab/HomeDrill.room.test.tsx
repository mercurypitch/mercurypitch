// Home in the native room: a rated run's slip, "4 Fa heard as 5 Sol",
// offers practice on Fa against Sol. The practice runs as practice,
// asks only Fa and Sol, leaves the rating where the rated run left it,
// and ends on a tally of its own, which says what it skipped. A refused
// microphone keeps the practice it stopped for "Use Tap instead".

import { fireEvent, render } from '@solidjs/testing-library'
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
import type { PlateSlip, RoomBeat, StageRoom } from './stage-room'

/** The microphone: refused, or given and hearing no clear note. */
const mic = vi.hoisted(() => ({ refuse: false }))
vi.mock('@/lib/mic-manager', () => ({
  micManager: {
    acquire: () =>
      mic.refuse
        ? Promise.reject(
            new DOMException('Permission denied', 'NotAllowedError'),
          )
        : Promise.resolve({} as MediaStream),
    release: () => undefined,
  },
}))
vi.mock('@/lib/pitch-f0-stream', () => ({
  createF0Stream: () => ({
    startTask: () => undefined,
    takeFrames: () => [],
    peekFrames: () => [],
    latest: () => null,
    latestLevel: () => 0,
    dispose: () => undefined,
  }),
}))
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

const engines = {
  audioEngine: engine as unknown as AudioEngine,
  practiceEngine: {} as PracticeEngine,
  playbackRuntime: {} as PlaybackRuntime,
  ready: () => true,
}

function mountHome(): void {
  render(() => (
    <EngineContext.Provider value={engines}>
      <HomeDrill onBack={vi.fn()} />
    </EngineContext.Provider>
  ))
}

/** A rated run stopped after one round, Fa named as Sol: its slip. */
async function ratedSlip(): Promise<PlateSlip> {
  room().again?.()
  await until('answer')
  press('5')
  stage().onStop?.()
  await until('done')
  const plate = room().plate?.()
  if (plate?.kind !== 'rating') throw new Error('no rated plate')
  return plate.slips[0]
}

/** The bench's console as the drill draws it: Begin, the refusal, the
 *  way to tap. */
function bench() {
  return render(() => (
    <EngineContext.Provider value={engines}>
      {stage().console()}
    </EngineContext.Provider>
  ))
}

beforeEach(() => {
  localStorage.clear()
  resetEarLabStore()
  setHomeAnswerMode('tap')
  setRevealRule('switch')
  mic.refuse = false
  vi.useFakeTimers()
})

afterEach(() => {
  handed.props = undefined
  vi.useRealTimers()
})

describe("Home's slip", () => {
  it('offers Fa against Sol, and practises only those two, rating nothing', async () => {
    mountHome()

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

  it('says on a sung practice what it skipped, as the rated plate does', async () => {
    mountHome()
    const slip = await ratedSlip()
    setHomeAnswerMode('mic')
    slip.practise?.()
    await until('answer')
    // Two unclear takes: the round is skipped.
    await until('reveal')
    stage().onStop?.()
    await until('done')
    const plate = room().plate?.()
    expect(plate).toMatchObject({ kind: 'practice', rounds: 1, right: 0 })
    expect(plate?.kind === 'practice' ? plate.lines : null).toEqual([
      '1 skipped (unclear)',
    ])
  })
})

describe('a practice the microphone refused', () => {
  it('starts that practice, not a rated run, once the singer taps instead', async () => {
    mountHome()
    const slip = await ratedSlip()
    const after = earPlayerRating('home')
    setHomeAnswerMode('mic')
    mic.refuse = true
    slip.practise?.()
    await vi.advanceTimersByTimeAsync(0)

    // Back on the bench, where the refusal is said and the way to tap is.
    expect(room().beat()).toBe('idle')
    const desk = bench()
    expect(desk.getByText(/nothing started/)).toBeTruthy()
    fireEvent.click(desk.getByText('Use Tap instead'))
    await vi.advanceTimersByTimeAsync(0)

    expect(room().run()).toBe('practice')
    expect(room().practising?.()).toEqual(['4 Fa', '5 Sol'])
    await until('answer')
    press('5')
    expect(earPlayerRating('home')).toEqual(after)
  })

  it('drops it once anything else starts', async () => {
    mountHome()
    const slip = await ratedSlip()
    setHomeAnswerMode('mic')
    mic.refuse = true
    slip.practise?.()
    await vi.advanceTimersByTimeAsync(0)
    // Begin, refused again: then tapping instead is a rated run.
    const desk = bench()
    fireEvent.click(desk.getByRole('button', { name: /Begin/ }))
    await vi.advanceTimersByTimeAsync(0)
    fireEvent.click(desk.getByText('Use Tap instead'))
    await vi.advanceTimersByTimeAsync(0)
    expect(room().run()).toBe('rated')
  })
})

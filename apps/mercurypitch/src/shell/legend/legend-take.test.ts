// ============================================================
// A take of the Legend: the rules the web's stage keeps, on the phone
// ============================================================

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WeeklyChallenge } from '@/features/challenges/weekly-service'
import type { MelodyItem, NoteName } from '@/types'

const mic = vi.hoisted(() => ({ held: false }))

vi.mock('@/components/room-kit/useExerciseCapture', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useExerciseCapture: () => fake,
  }
})

vi.mock('@/features/challenges/challenge-stage-voice-take', () => ({
  recordChallengeStageResult: vi.fn(async () => undefined),
}))

import { CaptureError } from '@/components/room-kit/useExerciseCapture'
import { presentChallengeResult, whileFinalizing, } from '@/features/challenges/challenge-result-store'
import { recordChallengeStageResult } from '@/features/challenges/challenge-stage-voice-take'
import { activeWeeklyAttempt, beginWeeklyAttempt, clearWeeklyAttempt, } from '@/features/challenges/weekly-attempt'
import { midiToFrequency, midiToNoteName } from '@/lib/frequency-to-note'
import type { LegendTake } from './legend-take'
import { createLegendTake } from './legend-take'

const fake = {
  acquire: vi.fn(async () => {
    mic.held = true
  }),
  release: vi.fn(() => {
    mic.held = false
  }),
  held: () => mic.held,
  startWindow: vi.fn(),
  peekFrames: vi.fn(() => []),
  takeFrames: vi.fn(() => []),
  playTone: vi.fn(async (_midi: number, _seconds?: number) => undefined),
  audio: vi.fn(async () => null),
}

const recorded = vi.mocked(recordChallengeStageResult)

function note(midi: number, startBeat: number): MelodyItem {
  return {
    id: startBeat + 1,
    note: {
      midi,
      name: midiToNoteName(midi).replace(/-?\d+$/u, '') as NoteName,
      octave: Math.floor(midi / 12) - 1,
      freq: midiToFrequency(midi),
    },
    duration: 1,
    startBeat,
  }
}

function legend(over: Partial<WeeklyChallenge> = {}): WeeklyChallenge {
  return {
    id: 'legend-1',
    slug: 'vincero',
    title: 'Vincero',
    description: '',
    featType: 'range',
    voiceTypeSplit: null,
    difficulty: 'hard',
    // B4 to D5: above most voices, sung as written.
    targetItems: [note(71, 0), note(72, 1), note(74, 2)],
    targetScore: 70,
    hearItUrl: null,
    startsAt: '2026-10-26T00:00:00Z',
    endsAt: '2026-11-23T00:00:00Z',
    rewardBadgeId: null,
    founderScore: 88,
    founderTrace: null,
    status: 'active',
    ...over,
  }
}

const settle = async (): Promise<void> => {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

let take: LegendTake
let dispose: () => void

beforeEach(() => {
  mic.held = false
  vi.clearAllMocks()
  fake.acquire.mockImplementation(async () => {
    mic.held = true
  })
  clearWeeklyAttempt()
  dispose = createRoot((done) => {
    take = createLegendTake()
    return done
  })
})

afterEach(() => {
  dispose()
  clearWeeklyAttempt()
  vi.restoreAllMocks()
})

describe('a take', () => {
  it('opens the mic inside the tap that starts it', () => {
    take.start(legend(), 'practice')
    // Before any await: the phone's audio wakes only inside the tap.
    expect(fake.acquire).toHaveBeenCalledTimes(1)
    expect(take.state().phase).toBe('starting')
  })

  it('goes live once the mic opens, on a fresh window', async () => {
    take.start(legend(), 'practice')
    await settle()
    expect(take.state().phase).toBe('live')
    expect(fake.startWindow).toHaveBeenCalledTimes(1)
  })

  it('is sung at the written pitch, never moved into the range', () => {
    take.start(legend(), 'practice')
    const first = take.session()?.targets()[0]
    expect(first?.startMidi).toBe(71)
  })
})

describe('one armed attempt counts once', () => {
  it('arms a ranked take in its tap, for the room to present', () => {
    take.start(legend(), 'ranked')
    expect(activeWeeklyAttempt()).toMatchObject({
      challengeId: 'legend-1',
      exercise: 'sight-singing',
      presenter: 'native-room',
    })
  })

  it('clears any armed attempt before practice', () => {
    beginWeeklyAttempt({
      challengeId: 'another',
      title: 'Another',
      exercise: 'sight-singing',
      targetScore: 70,
    })
    take.start(legend(), 'practice')
    expect(activeWeeklyAttempt()).toBeNull()
  })

  it('records nothing, and lets the attempt go, when the singer leaves', async () => {
    take.start(legend(), 'ranked')
    await settle()
    const hidden = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    hidden.mockRestore()
    expect(take.state().phase).toBe('idle')
    expect(activeWeeklyAttempt()).toBeNull()
    expect(fake.release).toHaveBeenCalled()
    expect(recorded).not.toHaveBeenCalled()
  })

  it('lets the attempt go when the room goes', async () => {
    take.start(legend(), 'ranked')
    await settle()
    dispose()
    expect(activeWeeklyAttempt()).toBeNull()
    dispose = () => undefined
  })

  it('lets a ranked attempt go when the mic will not open', async () => {
    fake.acquire.mockRejectedValueOnce(new CaptureError('denied'))
    take.start(legend(), 'ranked')
    await settle()
    expect(take.state().phase).toBe('blocked')
    expect(take.block()).toBe('denied')
    expect(activeWeeklyAttempt()).toBeNull()
  })
})

describe('the score', () => {
  it('goes from a ranked take to the board through the funnel', async () => {
    take.start(legend(), 'ranked')
    await settle()
    take.stop()
    await settle()
    expect(take.state().phase).toBe('result')
    expect(recorded).toHaveBeenCalledTimes(1)
    expect(recorded.mock.calls[0][0]).toMatchObject({
      challengeId: 'legend-1',
      targetNotes: ['B4', 'C5', 'D5'],
      result: { type: 'sight-singing' },
    })
    // The phone has no take recorder: the replay is unsupported, never
    // the score.
    expect(recorded.mock.calls[0][0].voiceCapture.state()).toBe('unsupported')
    expect(fake.release).toHaveBeenCalled()
  })

  it('never records practice', async () => {
    take.start(legend(), 'practice')
    await settle()
    take.stop()
    await settle()
    expect(take.state().phase).toBe('result')
    expect(take.saveState()).toBeNull()
    expect(recorded).not.toHaveBeenCalled()
  })

  it('shows the room its own result once it is posted', async () => {
    take.start(legend(), 'ranked')
    await settle()
    take.stop()
    await settle()
    expect(take.saveState()).toBe('saving')
    presentChallengeResult({
      challengeId: 'legend-1',
      title: 'Vincero',
      score: 0,
      targetScore: 70,
      tier: 'attempted',
      badgeGranted: false,
      presenter: 'native-room',
    })
    expect(take.saveState()).toBe('posted')
  })

  it('keeps the next take waiting while the last one still saves, Done or not', async () => {
    take.start(legend(), 'ranked')
    await settle()
    take.stop()
    await settle()
    let finishSaving: () => void = () => undefined
    const saving = whileFinalizing(
      () =>
        new Promise<void>((resolve) => {
          finishSaving = resolve
        }),
      'native-room',
    )
    take.done()
    fake.acquire.mockClear()
    take.start(legend(), 'ranked')
    // Nothing started: that save's result would have been this take's.
    expect(fake.acquire).not.toHaveBeenCalled()
    expect(take.state().phase).toBe('idle')
    finishSaving()
    await saving
    take.start(legend(), 'ranked')
    expect(fake.acquire).toHaveBeenCalledTimes(1)
  })

  it('says a save that ended with no result was not posted', async () => {
    take.start(legend(), 'ranked')
    await settle()
    take.stop()
    await settle()
    await whileFinalizing(async () => undefined, 'native-room')
    expect(take.saveState()).toBe('failed')
  })
})

describe('the line', () => {
  it('plays at the written pitch, its first note inside the tap', () => {
    take.playLine(legend())
    expect(take.linePlaying()).toBe(true)
    expect(fake.playTone).toHaveBeenCalledTimes(1)
    expect(fake.playTone.mock.calls[0][0]).toBe(71)
    take.playLine(legend())
    expect(take.linePlaying()).toBe(false)
  })
})

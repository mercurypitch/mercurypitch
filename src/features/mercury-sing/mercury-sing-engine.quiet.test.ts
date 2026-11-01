// ============================================================
// Mercury Sing's engine when the singing stops
// ============================================================
//
// The engine itself, with what it cannot have in a test stood in for: the
// mic and its pitch loop (the singing is a frame list the test writes), the
// matcher (its answer is the test's), and the stored fingerprints. What is
// under test is what the engine does with them: the mic let go after a
// silence, what was found kept and still opening from where the singer
// stopped, nothing left arming, the wake word no longer held, and on the
// web the old way out, said and then closed.

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acquireWakeWordHold, wakeWordHoldActive, } from '@/features/voice-control/voice-command-registry'
import type { MatchCandidate, MatcherOptions } from '@/lib/shazam/types'
import { notifications, resetNotifications } from '@/stores/notifications-store'

const mic = vi.hoisted(() => ({
  /** The pitch loop's callbacks, as the engine handed them over. */
  loop: null as null | { onAutoStop: () => void },
  cancelled: 0,
  destroyed: 0,
  frames: [] as {
    time: number
    pitch: { frequency: number; clarity: number }
  }[],
}))

const matcher = vi.hoisted(() => ({
  answer: [] as MatchCandidate[],
  asked: [] as MatcherOptions[],
}))

vi.mock('@/lib/audio-engine', () => ({
  AudioEngine: class {
    init(): void {}
    destroy(): void {
      mic.destroyed += 1
    }
    stopTone(): void {}
    stopAllNotes(): void {}
  },
}))

vi.mock('@/lib/shazam/live-pitch-buffer', () => ({
  LivePitchBuffer: class {
    constructor(_engine: unknown, loop: { onAutoStop: () => void }) {
      mic.loop = loop
    }
    async start(): Promise<boolean> {
      return Promise.resolve(true)
    }
    cancel(): void {
      mic.cancelled += 1
    }
    getCurrentFrames(): typeof mic.frames {
      return mic.frames
    }
    getElapsed(): number {
      return 0
    }
  },
}))

vi.mock('@/lib/shazam/melody-matcher', () => ({
  matchPitchContour: (_contour: unknown, options: MatcherOptions) => {
    matcher.asked.push(options)
    return matcher.answer
  },
}))

vi.mock('@/lib/shazam/melody-fingerprints', () => ({
  addStemFingerprint: () => undefined,
  hasStemFingerprint: () => true,
  loadStemFingerprints: async () => Promise.resolve(0),
}))

vi.mock('@/db/services/uvr-service', () => ({
  getStemBlobUrl: async () => Promise.resolve(null),
  saveStemFingerprintData: async () => Promise.resolve(true),
}))

// Three notes, so the engine has enough to match.
vi.mock('@/lib/shazam/onset-detector', () => ({
  detectOnsets: () => [{ time: 0 }, { time: 1 }, { time: 2 }],
  segmentNotes: () => ({
    noteSequence: [60, 62, 64],
    ioiSequence: [1, 1],
    noteDurations: [1, 1, 1],
  }),
}))

// The web's library: one separated song.
vi.mock('@/stores/uvr-store', () => ({
  initSessionStore: async () => Promise.resolve(),
  getAllUvrSessionsReactive: () => [
    {
      sessionId: 'mine',
      status: 'completed',
      originalFile: { name: 'Mine.mp3' },
    },
  ],
}))

const { createMercurySingEngine } = await import('./mercury-sing-engine')
const { webMercurySingHost } = await import('./mercury-sing-host')
const { closeMercurySing, mercurySingOpen, openMercurySing } =
  await import('./mercury-sing-store')

/** A match as the matcher returns one, 30 s into its song. */
const found = (sessionId: string, confidence: number): MatchCandidate => ({
  melodyId: `stem:${sessionId}`,
  name: sessionId,
  confidence,
  source: 'stem',
  sessionId,
  matchOffsetSec: 30,
  breakdown: {
    pitchScore: 1,
    intervalScore: 1,
    chromaScore: 1,
    rhythmScore: 1,
    lengthBonus: 1,
  },
})

/** A room's host: four songs, the sheet saying the silence itself. */
function roomHost() {
  const launched: [string, number][] = []
  return {
    launched,
    host: {
      songs: async () =>
        Promise.resolve(
          ['a', 'b', 'c', 'd'].map((id) => ({ sessionId: id, name: id })),
        ),
      fingerprint: async () => Promise.resolve(null),
      launch: (song: { sessionId: string }, startAtSec: number) => {
        launched.push([song.sessionId, startAtSec])
      },
    },
  }
}

/** Sung for 3 s, then a second of silence: the last voiced frame at 2.99 s. */
const sungThenSilent = () =>
  Array.from({ length: 400 }, (_, i) => ({
    time: i / 100,
    pitch: {
      frequency: i < 300 ? 220 : 0,
      clarity: i < 300 ? 0.9 : 0,
    },
  }))

beforeEach(() => {
  vi.useFakeTimers()
  mic.loop = null
  mic.cancelled = 0
  mic.destroyed = 0
  mic.frames = sungThenSilent()
  matcher.answer = [found('a', 90), found('b', 60), found('c', 50)]
  matcher.asked = []
  resetNotifications()
})

afterEach(() => {
  vi.useRealTimers()
  closeMercurySing()
})

/** An engine listening, one match made. */
async function listening(
  host: Parameters<typeof createMercurySingEngine>[0],
  giveUp: () => void,
) {
  const made = createRoot((dispose) => ({
    engine: createMercurySingEngine(host, giveUp),
    dispose,
  }))
  await vi.advanceTimersByTimeAsync(0)
  expect(made.engine.status()).toBe('listening')
  await vi.advanceTimersByTimeAsync(1500)
  return made
}

const silence = (): void => {
  if (mic.loop === null) throw new Error('the engine started no pitch loop')
  mic.loop.onAutoStop()
}

describe('when the singing stops', () => {
  it('lets the mic go, keeps what it found, and arms nothing', async () => {
    const { host } = roomHost()
    const giveUp = vi.fn()
    const { engine, dispose } = await listening(host, giveUp)
    expect(engine.armed()).toMatchObject({ kind: 'arming', leaderId: 'a' })

    silence()

    expect(engine.status()).toBe('quiet')
    expect(mic.cancelled).toBe(1)
    expect(mic.destroyed).toBe(1)
    expect(engine.candidates().map((c) => c.sessionId)).toEqual(['a', 'b', 'c'])
    // No row goes on saying it is about to open.
    expect(engine.armed()).toEqual({
      kind: 'listening',
      leaderId: null,
      armedFraction: 0,
    })
    expect(giveUp).toHaveBeenCalledTimes(1)
    // The room's sheet says it in its own words: no toast over it.
    expect(notifications()).toEqual([])
    dispose()
    engine.dispose()
  })

  it('no longer holds voice commands behind the wake word, and lets go of only its own hold', async () => {
    // Someone else's hold, which the engine's releases must leave alone.
    const releaseOther = acquireWakeWordHold()
    const { host } = roomHost()
    const { engine, dispose } = await listening(host, () => undefined)

    silence()
    engine.dispose()
    expect(wakeWordHoldActive()).toBe(true)

    releaseOther()
    expect(wakeWordHoldActive()).toBe(false)
    dispose()
  })

  it('lets go of the wake word when the mic goes, before the sheet does', async () => {
    const { host } = roomHost()
    const { engine, dispose } = await listening(host, () => undefined)
    expect(wakeWordHoldActive()).toBe(true)

    silence()

    expect(wakeWordHoldActive()).toBe(false)
    dispose()
    engine.dispose()
  })

  it('opens a song it found from where the singer stopped, not from the silence after', async () => {
    const { host, launched } = roomHost()
    const { engine, dispose } = await listening(host, () => undefined)

    silence()

    expect(engine.pickSession('b')).toBe(true)
    // 30 s into the song, plus the 2.99 s sung, less the pre-roll's 2 s.
    expect(launched).toHaveLength(1)
    expect(launched[0][0]).toBe('b')
    expect(launched[0][1]).toBeCloseTo(30.99, 6)
    dispose()
  })
})

describe('what it listens for', () => {
  it("asks the matcher for the host's songs only, so a song gone since takes no slot", async () => {
    const { host } = roomHost()
    const { engine, dispose } = await listening(host, () => undefined)

    expect(matcher.asked).toHaveLength(1)
    expect([...(matcher.asked[0].sessionIds ?? [])]).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
    expect(matcher.asked[0].maxResults).toBe(4)
    dispose()
    engine.dispose()
  })
})

describe('on the web', () => {
  it('says it heard no singing, then closes the stage', async () => {
    openMercurySing()
    let saidBeforeClosing: string[] = []
    const { engine, dispose } = await listening(webMercurySingHost(), () => {
      saidBeforeClosing = notifications().map((note) => note.message)
      closeMercurySing()
    })

    silence()

    expect(saidBeforeClosing).toEqual([
      'Mercury Sing stopped — I did not hear singing.',
    ])
    expect(mercurySingOpen()).toBe(false)
    dispose()
    engine.dispose()
  })
})

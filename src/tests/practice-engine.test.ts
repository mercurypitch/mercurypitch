// ============================================================
// Practice Engine Tests
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioEngine } from '@/lib/audio-engine'
import { centsToBand, centsToRating, PracticeEngine, ratingToScore, scoreGrade, } from '@/lib/practice-engine'
import { setMicLatencyByDevice } from '@/stores/mic-latency-store'
import type { AccuracyRating, MelodyNote } from '@/types'

// Default bands used in tests (matching DEFAULT_BANDS in practice-engine.ts)
// Note: first band has threshold=0, meaning cents==0 is the only value that gets band 100.
// The test descriptions use ranges like "0 ≤ cents < 10" as documentation,
// but the actual function behavior matches the band thresholds literally.
const DEFAULT_TEST_BANDS = [
  { threshold: 0, band: 100 },
  { threshold: 10, band: 90 },
  { threshold: 25, band: 75 },
  { threshold: 50, band: 50 },
  { threshold: 999, band: 0 },
]

describe('centsToRating', () => {
  it('returns perfect for very accurate pitches', () => {
    expect(centsToRating(0)).toBe('perfect')
    expect(centsToRating(3)).toBe('perfect')
    expect(centsToRating(5)).toBe('perfect')
  })

  it('returns excellent for close pitches', () => {
    expect(centsToRating(10)).toBe('excellent')
    expect(centsToRating(14)).toBe('excellent')
    expect(centsToRating(15)).toBe('excellent')
  })

  it('returns good for decent pitches', () => {
    expect(centsToRating(20)).toBe('good')
    expect(centsToRating(24)).toBe('good')
    expect(centsToRating(25)).toBe('good')
  })

  it('returns okay for rough pitches', () => {
    expect(centsToRating(30)).toBe('okay')
    expect(centsToRating(40)).toBe('okay')
    expect(centsToRating(50)).toBe('okay')
  })

  it('returns off for inaccurate pitches', () => {
    expect(centsToRating(60)).toBe('off')
    expect(centsToRating(100)).toBe('off')
    expect(centsToRating(500)).toBe('off')
  })

  it('handles null (no samples) as off', () => {
    expect(centsToRating(null)).toBe('off')
  })
})

describe('centsToBand', () => {
  it('returns 100 for cents == 0', () => {
    expect(centsToBand(0, DEFAULT_TEST_BANDS)).toBe(100)
  })

  it('returns 90 for cents between 1 and 10', () => {
    expect(centsToBand(1, DEFAULT_TEST_BANDS)).toBe(90)
    expect(centsToBand(5, DEFAULT_TEST_BANDS)).toBe(90)
    expect(centsToBand(9, DEFAULT_TEST_BANDS)).toBe(90)
    expect(centsToBand(10, DEFAULT_TEST_BANDS)).toBe(90)
  })

  it('returns 75 for cents between 11 and 25', () => {
    expect(centsToBand(11, DEFAULT_TEST_BANDS)).toBe(75)
    expect(centsToBand(15, DEFAULT_TEST_BANDS)).toBe(75)
    expect(centsToBand(24, DEFAULT_TEST_BANDS)).toBe(75)
    expect(centsToBand(25, DEFAULT_TEST_BANDS)).toBe(75)
  })

  it('returns 50 for cents between 26 and 50', () => {
    expect(centsToBand(26, DEFAULT_TEST_BANDS)).toBe(50)
    expect(centsToBand(30, DEFAULT_TEST_BANDS)).toBe(50)
    expect(centsToBand(49, DEFAULT_TEST_BANDS)).toBe(50)
    expect(centsToBand(50, DEFAULT_TEST_BANDS)).toBe(50)
  })

  it('returns 0 for cents ≥ 51', () => {
    expect(centsToBand(51, DEFAULT_TEST_BANDS)).toBe(0)
    expect(centsToBand(100, DEFAULT_TEST_BANDS)).toBe(0)
    expect(centsToBand(500, DEFAULT_TEST_BANDS)).toBe(0)
    expect(centsToBand(998, DEFAULT_TEST_BANDS)).toBe(0)
  })

  it('returns 0 for null', () => {
    expect(centsToBand(null, DEFAULT_TEST_BANDS)).toBe(0)
  })
})

describe('ratingToScore', () => {
  it('returns 100 for perfect', () => {
    expect(ratingToScore('perfect')).toBe(100)
  })

  it('returns 90 for excellent', () => {
    expect(ratingToScore('excellent')).toBe(90)
  })

  it('returns 75 for good', () => {
    expect(ratingToScore('good')).toBe(75)
  })

  it('returns 50 for okay', () => {
    expect(ratingToScore('okay')).toBe(50)
  })

  it('returns 0 for off', () => {
    expect(ratingToScore('off')).toBe(0)
  })
})

describe('scoreGrade', () => {
  it('returns perfect grade for scores 90+', () => {
    const grade = scoreGrade(90)
    expect(grade.label).toBe('Pitch Perfect!')
    expect(grade.cls).toBe('grade-perfect')

    const grade100 = scoreGrade(100)
    expect(grade100.cls).toBe('grade-perfect')
  })

  it('returns excellent grade for scores 80-89', () => {
    const grade = scoreGrade(80)
    expect(grade.label).toBe('Excellent!')
    expect(grade.cls).toBe('grade-excellent')

    const grade85 = scoreGrade(85)
    expect(grade85.cls).toBe('grade-excellent')
  })

  it('returns good grade for scores 65-79', () => {
    const grade = scoreGrade(65)
    expect(grade.label).toBe('Good!')
    expect(grade.cls).toBe('grade-good')

    const grade75 = scoreGrade(75)
    expect(grade75.cls).toBe('grade-good')
  })

  it('returns okay grade for scores 50-64', () => {
    const grade = scoreGrade(50)
    expect(grade.label).toBe('Okay!')
    expect(grade.cls).toBe('grade-okay')

    const grade60 = scoreGrade(60)
    expect(grade60.cls).toBe('grade-okay')
  })

  it('returns needs work grade for scores below 50', () => {
    const grade = scoreGrade(49)
    expect(grade.label).toBe('Needs Work')
    expect(grade.cls).toBe('grade-needs-work')

    const grade0 = scoreGrade(0)
    expect(grade0.cls).toBe('grade-needs-work')
  })
})

describe('Rating consistency', () => {
  it('ratingToScore and centsToBand are consistent', () => {
    const ratings: AccuracyRating[] = [
      'perfect',
      'excellent',
      'good',
      'okay',
      'off',
    ]
    const scores = [100, 90, 75, 50, 0]

    for (let i = 0; i < ratings.length; i++) {
      expect(ratingToScore(ratings[i])).toBe(scores[i])
    }
  })
})

const stubAudioEngine = () =>
  ({
    init: () => Promise.resolve(),
    resume: () => Promise.resolve(),
    getSampleRate: () => 44100,
    getBufferSize: () => 2048,
    startMic: () => Promise.resolve(true),
    stopMic: () => {},
    isMicActive: () => true,
    onMicLost: () => () => {},
    getTimeData: () => new Float32Array(2048),
  }) as unknown as AudioEngine

/**
 * A stub engine whose mic hears one steady tone, switchable mid-run. The real
 * detector runs on it, so a frame only counts if it would have counted for a
 * live singer.
 */
const singingAudioEngine = (): {
  audio: AudioEngine
  sing: (freq: number) => void
} => {
  let toneHz = 0
  const buffer = new Float32Array(2048)
  const fill = (): Float32Array => {
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] =
        toneHz === 0 ? 0 : 0.5 * Math.sin((2 * Math.PI * toneHz * i) / 44100)
    }
    return buffer
  }
  return {
    audio: {
      init: () => Promise.resolve(),
      resume: () => Promise.resolve(),
      getSampleRate: () => 44100,
      getBufferSize: () => 2048,
      startMic: () => Promise.resolve(true),
      stopMic: () => {},
      isMicActive: () => true,
      onMicLost: () => () => {},
      getTimeData: fill,
    } as unknown as AudioEngine,
    sing: (freq: number) => {
      toneHz = freq
    },
  }
}

describe('PracticeEngine note attribution under mic latency', () => {
  const note = (name: string, midi: number): MelodyNote =>
    ({
      name,
      octave: 4,
      midi,
      freq: 440,
      duration: 1,
    }) as MelodyNote

  let clock = 0

  beforeEach(() => {
    clock = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
    setMicLatencyByDevice({})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    setMicLatencyByDevice({})
  })

  const completedNotes = (engine: PracticeEngine): string[] => {
    const names: string[] = []
    engine.addCallbacks({
      onNoteComplete: (result) => names.push(result.item?.note?.name ?? '?'),
    })
    return names
  }

  it('switches note immediately when no latency has been measured', () => {
    const engine = new PracticeEngine(stubAudioEngine())
    const done = completedNotes(engine)
    engine.startSession()

    engine.onNoteStart(note('C', 60), 0)
    engine.onNoteStart(note('D', 62), 1)

    // The first note is finalised the moment the second starts — the
    // behaviour before latency compensation existed, and the behaviour an
    // unmeasured device must keep.
    expect(done).toEqual(['C'])
  })

  it('holds the next note back by the measured round trip', async () => {
    setMicLatencyByDevice({ default: 120 })
    const engine = new PracticeEngine(stubAudioEngine())
    const done = completedNotes(engine)
    // update() only attributes frames while the mic is live, which is the
    // only time there are frames to attribute.
    await engine.startMic()
    engine.startSession()

    engine.onNoteStart(note('C', 60), 0)
    clock += 500
    engine.onNoteStart(note('D', 62), 1)

    // Frames arriving now were sung 120 ms ago, while C was still the target,
    // so D must not take over yet.
    expect(done).toEqual([])

    clock += 119
    engine.update()
    expect(done).toEqual([])

    clock += 2
    engine.update()
    expect(done).toEqual(['C'])
  })

  it('still owes a result for a note the run ended on', () => {
    setMicLatencyByDevice({ default: 120 })
    const engine = new PracticeEngine(stubAudioEngine())
    const done = completedNotes(engine)
    engine.startSession()

    engine.onNoteStart(note('C', 60), 0)
    clock += 10
    engine.onNoteStart(note('D', 62), 1)
    // Ends while D is still queued: both notes must still report.
    engine.endSession()

    expect(done).toEqual(['C', 'D'])
  })

  it('drops queued starts when a new session begins', async () => {
    setMicLatencyByDevice({ default: 120 })
    const engine = new PracticeEngine(stubAudioEngine())
    await engine.startMic()
    engine.startSession()
    engine.onNoteStart(note('C', 60), 0)
    engine.onNoteStart(note('D', 62), 1)

    engine.startSession()
    const done = completedNotes(engine)
    clock += 1000
    engine.update()

    expect(done).toEqual([])
  })
})

describe('PracticeEngine scoring across a rest', () => {
  const C4 = 261.63
  const D4 = 293.66

  const pitchedNote = (name: string, midi: number, freq: number): MelodyNote =>
    ({ name, octave: 4, midi, freq, duration: 1 }) as MelodyNote

  let clock = 0

  beforeEach(() => {
    clock = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
    setMicLatencyByDevice({})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    setMicLatencyByDevice({})
  })

  /** Run `frames` animation frames at 60fps, as the app's loop would. */
  const frames = (engine: PracticeEngine, count: number): void => {
    for (let i = 0; i < count; i++) {
      clock += 16
      engine.update()
    }
  }

  it('scores a note on its own duration, not on the rest that follows it', async () => {
    const { audio, sing } = singingAudioEngine()
    const engine = new PracticeEngine(audio)
    const done: { name: string; avgCents: number }[] = []
    engine.addCallbacks({
      onNoteComplete: (r) =>
        done.push({
          name: r.item?.note?.name ?? '?',
          avgCents: Math.abs(r.avgCents),
        }),
    })
    await engine.startMic()
    engine.startSession()

    // C sung in tune for its whole duration.
    engine.onNoteStart(pitchedNote('C', 60, C4), 0)
    sing(C4)
    frames(engine, 20)

    // Then the rest, where the singer feels out the next note — a whole tone
    // up, 200 cents from C. Nothing sung here belongs to C's score.
    engine.onNoteEnd()
    sing(D4)
    frames(engine, 40)

    engine.onNoteStart(pitchedNote('D', 62, D4), 2)
    frames(engine, 20)
    engine.onPlaybackComplete()

    expect(done.map((d) => d.name)).toEqual(['C', 'D'])
    expect(done[0].avgCents).toBeLessThan(10)
    expect(done[0].avgCents).toBeLessThan(done[1].avgCents + 10)
  })

  it('closes the note the moment its duration ends, so the result arrives then', async () => {
    const { audio, sing } = singingAudioEngine()
    const engine = new PracticeEngine(audio)
    const done: string[] = []
    engine.addCallbacks({
      onNoteComplete: (r) => done.push(r.item?.note?.name ?? '?'),
    })
    await engine.startMic()
    engine.startSession()

    engine.onNoteStart(pitchedNote('C', 60, C4), 0)
    sing(C4)
    frames(engine, 10)
    expect(done).toEqual([])

    engine.onNoteEnd()
    expect(done).toEqual(['C'])
  })

  it('holds the rest boundary back by the measured round trip', async () => {
    setMicLatencyByDevice({ default: 95 })
    const { audio, sing } = singingAudioEngine()
    const engine = new PracticeEngine(audio)
    const done: string[] = []
    engine.addCallbacks({
      onNoteComplete: (r) => done.push(r.item?.note?.name ?? '?'),
    })
    await engine.startMic()
    engine.startSession()

    engine.onNoteStart(pitchedNote('C', 60, C4), 0)
    sing(C4)
    frames(engine, 10)

    // Frames arriving in the 95 ms after the rest begins were sung while C was
    // still sounding, so they are still C's — the boundary waits for them.
    engine.onNoteEnd()
    expect(done).toEqual([])
    frames(engine, 5)
    expect(done).toEqual([])
    frames(engine, 2)
    expect(done).toEqual(['C'])
  })

  it('changes nothing for notes that run back to back', async () => {
    const { audio, sing } = singingAudioEngine()
    const engine = new PracticeEngine(audio)
    const done: string[] = []
    engine.addCallbacks({
      onNoteComplete: (r) => done.push(r.item?.note?.name ?? '?'),
    })
    await engine.startMic()
    engine.startSession()

    // The runtime emits a note's end and the next note's start on the same
    // tick, ends first. Two notes must still produce exactly two results, in
    // order — the pre-existing behaviour for a melody with no rests in it.
    engine.onNoteStart(pitchedNote('C', 60, C4), 0)
    sing(C4)
    frames(engine, 10)
    engine.onNoteEnd()
    engine.onNoteStart(pitchedNote('D', 62, D4), 1)
    sing(D4)
    frames(engine, 10)
    engine.onNoteEnd()

    expect(done).toEqual(['C', 'D'])
    expect(engine.onPlaybackComplete()?.length).toBe(2)
  })

  it('scores nothing while a rest is running', async () => {
    const { audio, sing } = singingAudioEngine()
    const engine = new PracticeEngine(audio)
    const done: string[] = []
    engine.addCallbacks({
      onNoteComplete: (r) => done.push(r.item?.note?.name ?? '?'),
    })
    await engine.startMic()
    engine.startSession()

    engine.onNoteStart(pitchedNote('C', 60, C4), 0)
    sing(C4)
    frames(engine, 10)
    engine.onNoteEnd()
    sing(D4)
    frames(engine, 30)

    // A run that ends inside a rest owes exactly one result: the note.
    expect(engine.onPlaybackComplete()?.length).toBe(1)
    expect(done).toEqual(['C'])
  })
})

describe('PracticeEngine score modes', () => {
  const C4 = 261.63
  const D4 = 293.66

  const pitchedNote = (name: string, midi: number, freq: number): MelodyNote =>
    ({ name, octave: 4, midi, freq, duration: 1 }) as MelodyNote

  let clock = 0

  beforeEach(() => {
    clock = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
    setMicLatencyByDevice({})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    setMicLatencyByDevice({})
  })

  const frames = (engine: PracticeEngine, count: number): void => {
    for (let i = 0; i < count; i++) {
      clock += 16
      engine.update()
    }
  }

  /**
   * One note, sung as a real singer does: the first `slideFrames` frames a
   * whole tone away (the approach), the remaining frames dead on. Returns the
   * note's |avgCents|.
   */
  const singWithSlideIn = async (
    mode: 'full' | 'settled' | 'core',
    slideFrames: number,
    totalFrames: number,
  ): Promise<number> => {
    const { audio, sing } = singingAudioEngine()
    const engine = new PracticeEngine(audio)
    engine.syncSettings({ scoreMode: mode })
    const done: number[] = []
    engine.addCallbacks({
      onNoteComplete: (r) => done.push(Math.abs(r.avgCents)),
    })
    await engine.startMic()
    engine.startSession()

    engine.onNoteStart(pitchedNote('C', 60, C4), 0)
    sing(D4) // the approach, ~200 cents out
    frames(engine, slideFrames)
    sing(C4) // settled on the note
    frames(engine, totalFrames - slideFrames)
    engine.onPlaybackComplete()

    expect(done).toHaveLength(1)
    return done[0]
  }

  it('settled mode forgives a slide-in that full mode still counts', async () => {
    // 3 of 20 frames are the approach — exactly the 15% the trim removes.
    const settled = await singWithSlideIn('settled', 3, 20)
    const full = await singWithSlideIn('full', 3, 20)

    expect(settled).toBeLessThan(10) // perfect once the slide is dropped
    expect(full).toBeGreaterThan(25) // the same take, dragged past 'good'
  })

  it('core mode also forgives a fall-off at the end of the note', async () => {
    const singWithTailOff = async (
      mode: 'settled' | 'core',
    ): Promise<number> => {
      const { audio, sing } = singingAudioEngine()
      const engine = new PracticeEngine(audio)
      engine.syncSettings({ scoreMode: mode })
      const done: number[] = []
      engine.addCallbacks({
        onNoteComplete: (r) => done.push(Math.abs(r.avgCents)),
      })
      await engine.startMic()
      engine.startSession()

      engine.onNoteStart(pitchedNote('C', 60, C4), 0)
      sing(C4)
      frames(engine, 17)
      sing(D4) // breath falls off the note for the last 3 of 20 frames
      frames(engine, 3)
      engine.onPlaybackComplete()
      return done[0]
    }

    expect(await singWithTailOff('core')).toBeLessThan(10)
    expect(await singWithTailOff('settled')).toBeGreaterThan(25)
  })

  it('defaults to settled, matching the settings-store default', async () => {
    // No syncSettings call at all: a fresh engine must already forgive the
    // slide-in, or an engine created before the first settings sync scores
    // differently from one created after.
    const { audio, sing } = singingAudioEngine()
    const engine = new PracticeEngine(audio)
    const done: number[] = []
    engine.addCallbacks({
      onNoteComplete: (r) => done.push(Math.abs(r.avgCents)),
    })
    await engine.startMic()
    engine.startSession()
    engine.onNoteStart(pitchedNote('C', 60, C4), 0)
    sing(D4)
    frames(engine, 3)
    sing(C4)
    frames(engine, 17)
    engine.onPlaybackComplete()

    expect(done[0]).toBeLessThan(10)
  })

  it('windows each note of a run independently', async () => {
    const { audio, sing } = singingAudioEngine()
    const engine = new PracticeEngine(audio)
    engine.syncSettings({ scoreMode: 'settled' })
    const done: number[] = []
    engine.addCallbacks({
      onNoteComplete: (r) => done.push(Math.abs(r.avgCents)),
    })
    await engine.startMic()
    engine.startSession()

    // First note approached from a tone away, second sung clean throughout —
    // both must come out clean, each trimmed against its own frame count.
    engine.onNoteStart(pitchedNote('C', 60, C4), 0)
    sing(D4)
    frames(engine, 3)
    sing(C4)
    frames(engine, 17)
    engine.onNoteEnd()
    engine.onNoteStart(pitchedNote('D', 62, D4), 1)
    sing(D4)
    frames(engine, 20)
    engine.onPlaybackComplete()

    expect(done).toHaveLength(2)
    expect(done[0]).toBeLessThan(10)
    expect(done[1]).toBeLessThan(10)
  })
})

describe('PracticeEngine callback subscriptions', () => {
  it('notifies every subscriber of mic state changes', async () => {
    const engine = new PracticeEngine(stubAudioEngine())
    const first: boolean[] = []
    const second: boolean[] = []
    engine.addCallbacks({ onMicStateChange: (active) => first.push(active) })
    engine.addCallbacks({ onMicStateChange: (active) => second.push(active) })

    await engine.startMic()
    engine.stopMic()

    // Regression: setCallbacks() used to replace the whole listener set, so
    // the second registration (an exercise) silently disconnected the first
    // (the app-level mic-state signal).
    expect(first).toEqual([true, false])
    expect(second).toEqual([true, false])
  })

  it('unsubscribing removes only that listener', async () => {
    const engine = new PracticeEngine(stubAudioEngine())
    const kept: boolean[] = []
    const removed: boolean[] = []
    engine.addCallbacks({ onMicStateChange: (active) => kept.push(active) })
    const unsubscribe = engine.addCallbacks({
      onMicStateChange: (active) => removed.push(active),
    })

    await engine.startMic()
    unsubscribe()
    engine.stopMic()

    expect(kept).toEqual([true, false])
    expect(removed).toEqual([true])
  })
})

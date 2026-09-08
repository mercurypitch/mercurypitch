// Live display regressions exercise real route-clock collection without a recorder or scoring engine.
import { describe, expect, it } from 'vitest'
import type { GuitarInputCapture, GuitarInputPitch, } from '@/lib/guitar/input-events'
import { createGuitarLiveHistory } from './guitar-live-history'
import type { GuitarLiveInputObservation, GuitarLiveInputRoute, } from './guitar-live-input-observations'

function route(
  generation = 1,
  source: GuitarLiveInputRoute['source'] = 'interface',
): GuitarLiveInputRoute {
  return {
    generation,
    source,
    sampleRate: 48000,
    startedAtSeconds: 100,
    currentTimeSeconds: () => 100,
  }
}

function pitch(midi: number): GuitarInputPitch {
  return { midi, noteName: 'test', cents: 0, clarity: 0.9 }
}

function tick(
  at: number,
  midi: number | null,
  generation = 1,
): GuitarLiveInputObservation {
  return {
    type: 'pitch',
    generation,
    sampleRate: 48000,
    windowStartAtSeconds: 100 + at,
    observedAtSeconds: 100 + at + 0.04,
    pitch: midi === null ? null : pitch(midi),
  }
}

function capture(
  id: string,
  at: number,
  midi: number | null,
  options: Partial<GuitarInputCapture> = {},
): GuitarLiveInputObservation {
  return {
    type: 'capture',
    generation: 1,
    id,
    capture: {
      kind: 'attack',
      source: 'interface',
      voiceId: null,
      level: 0.5,
      pitch: midi === null ? null : pitch(midi),
      clock: {
        kind: 'audio-worklet',
        atFrame: Math.round((100 + at) * 48000),
        sampleRate: 48000,
      },
      ...options,
    },
  }
}

function listening(
  source: GuitarLiveInputRoute['source'] = 'interface',
  options = {},
) {
  const history = createGuitarLiveHistory(options)
  history.observe({ type: 'route-start', route: route(1, source) })
  return history
}

describe('live input history', () => {
  it('projects exact raw attacks immediately when pitch arrives without a quantized grid or debounce', () => {
    const history = listening()
    history.observe(capture('attack', 1.123, null))
    expect(history.snapshot().notes).toEqual([])

    history.observe(tick(1.13, 64))

    expect(history.snapshot().notes).toEqual([
      expect.objectContaining({
        id: 'attack',
        midi: 64,
        source: 'audio',
        clarity: 0.9,
      }),
    ])
    expect(history.snapshot().notes[0].startSeconds).toBeCloseTo(1.123, 6)
    expect(history.snapshot().notes[0].endSeconds).toBeCloseTo(1.17, 6)
  })

  it('retains same-pitch restrikes with their stable capture identities', () => {
    const history = listening()
    history.observe(capture('first', 1, null))
    history.observe(tick(1.02, 64))
    history.observe(capture('second', 1.08, null))
    history.observe(tick(1.09, 64))

    expect(history.snapshot().notes.map((note) => note.id)).toEqual([
      'first',
      'second',
    ])
    expect(history.snapshot().notes[0].endSeconds).toBeCloseTo(1.08)
    expect(history.snapshot().notes[1].startSeconds).toBeCloseTo(1.08)
  })

  it('adopts a late exact attack without duplicating the already displayed pitch', () => {
    const history = listening()
    history.observe(tick(1.01, 64))

    history.observe(capture('late-exact', 1, null))
    history.observe(tick(1.02, 64))

    expect(history.snapshot().notes).toHaveLength(1)
    expect(history.snapshot().notes[0]).toMatchObject({
      id: 'late-exact',
      startSeconds: 1,
      midi: 64,
    })
  })

  it('enriches an unpitched route attack even when a scoring boundary produced a pitch-change event', () => {
    const history = listening()
    history.observe(capture('attack-outside-score', 1, null))
    history.observe(capture('score-legato', 1.01, 64, { kind: 'pitch-change' }))
    history.observe(tick(1.01, 64))

    expect(history.snapshot().notes).toHaveLength(1)
    expect(history.snapshot().notes[0]).toMatchObject({
      id: 'attack-outside-score',
      startSeconds: 1,
      midi: 64,
    })
  })

  it('enriches an existing event without reopening it or changing its start', () => {
    const history = listening()
    history.observe(capture('first', 1, 64))
    history.observe(capture('second', 2, 65))

    history.observe(capture('first', 1, 63))

    expect(
      history.snapshot().notes.map((note) => [note.id, note.midi]),
    ).toEqual([
      ['first', 63],
      ['second', 65],
    ])
    expect(history.snapshot().notes[0]).toMatchObject({
      startSeconds: 1,
      endSeconds: 2,
    })
  })

  it('shows legato pitch changes once whichever observation arrives first', () => {
    for (const pitchFirst of [false, true]) {
      const history = listening()
      history.observe(capture('attack', 1, 64))
      history.observe(tick(1.2, 64))
      const change = capture('legato', 1.3, 66, { kind: 'pitch-change' })
      const observations = pitchFirst
        ? [tick(1.3, 66), change]
        : [change, tick(1.3, 66)]

      observations.forEach(history.observe)

      expect(
        history.snapshot().notes.map((note) => [note.id, note.midi]),
      ).toEqual([
        ['attack', 64],
        ['legato', 66],
      ])
    }
  })

  it('ends silent audio at the last positive evidence and does not invent a release capture', () => {
    const history = listening()
    const first = capture('attack', 1, 64)
    const unchanged = structuredClone(first)
    history.observe(first)
    history.observe(tick(1.1, 64))
    history.observe(tick(1.15, null))
    history.observe(tick(1.22, null))
    history.observe(tick(1.5, 64))

    const notes = history.snapshot().notes
    expect(notes).toHaveLength(2)
    expect(notes[0].endSeconds).toBeCloseTo(1.14)
    expect(notes[1].startSeconds).toBeCloseTo(1.5)
    expect(first).toEqual(unchanged)
  })

  it('bridges a single uncertain detector frame without delaying the returning pitch', () => {
    const history = listening()
    history.observe(tick(1, 64))
    history.observe(tick(1.02, null))
    history.observe(tick(1.04, 64))

    expect(history.snapshot().notes).toHaveLength(1)
    expect(history.snapshot().notes[0].endSeconds).toBeCloseTo(1.08)
  })

  it('preserves MIDI polyphony and exact independent releases rather than monophonic detector ticks', () => {
    const history = listening('midi')
    history.observe(
      capture('low', 1.123, 48, {
        source: 'midi',
        voiceId: 'ch1-48',
        clock: {
          kind: 'web-midi',
          mappedAudioTime: 101.123,
          eventTimestampMs: 3,
          observedPerformanceMs: 9,
          inputId: 'keyboard',
          channel: 0,
        },
      }),
    )
    history.observe(
      capture('high', 1.123, 64, { source: 'midi', voiceId: 'ch1-64' }),
    )
    history.observe(tick(1.2, null))
    history.observe(
      capture('release-low', 1.5, 48, {
        source: 'midi',
        voiceId: 'ch1-48',
        kind: 'release',
      }),
    )

    const notes = history.snapshot(102).notes

    expect(notes).toHaveLength(2)
    expect(notes[0].startSeconds).toBeCloseTo(1.123)
    expect(notes[0].endSeconds).toBe(1.5)
    expect(notes[1].endSeconds).toBe(2)
  })

  it('keeps a held MIDI note overlapping six seconds of history and caps dense events and voices', () => {
    const history = listening('midi', { maxNotes: 16, maxVoices: 4 })
    for (let index = 0; index < 1000; index++)
      history.observe(
        capture(`note-${index}`, index / 1000, 64, {
          source: 'midi',
          voiceId: `voice-${index}`,
        }),
      )

    const notes = history.snapshot(110).notes

    expect(notes).toHaveLength(4)
    expect(notes.every((note) => note.endSeconds === 10)).toBe(true)
    expect(notes.map((note) => note.id)).toEqual([
      'note-996',
      'note-997',
      'note-998',
      'note-999',
    ])
  })

  it('bounds hours of audio observations to recent notes including overlapping long sustains', () => {
    const history = listening()
    for (let index = 0; index < 10000; index++) {
      history.observe(capture(`attack-${index}`, index / 10, 64))
      history.observe(tick(index / 10 + 0.01, 64))
    }

    expect(history.snapshot().notes.length).toBeLessThanOrEqual(61)
    expect(history.snapshot(1107).notes).toEqual([])

    const held = listening()
    held.observe(capture('held', 0, 64))
    for (let index = 0; index < 1000; index++)
      held.observe(tick(index / 10, 64))
    expect(held.snapshot().notes).toHaveLength(1)
    expect(held.snapshot().notes[0].startSeconds).toBe(0)
    expect(held.snapshot().notes[0].endSeconds).toBeCloseTo(99.94)
  })

  it('rejects stale routes and pre-reset evidence without applying calibration to raw times', () => {
    const history = listening()
    history.observe(capture('old', 1, 64))
    history.observe({ type: 'reset', generation: 1, atSeconds: 102 })
    history.observe(capture('stale', 1.9, 64))
    history.observe(tick(2.25, 65))
    expect(history.snapshot().notes[0].startSeconds).toBe(2.25)
    history.observe({
      type: 'route-start',
      route: { ...route(2), startedAtSeconds: 200 },
    })
    history.observe(tick(2.3, 67, 1))
    history.observe({ type: 'route-end', generation: 1, atSeconds: 103 })
    history.observe({ type: 'route-start', route: route(1) })

    expect(history.snapshot()).toEqual({
      generation: 2,
      active: true,
      nowSeconds: 0,
      notes: [],
    })
  })

  it('freezes on route loss, ignores late captures, and clears on a fresh input route', () => {
    const history = listening('midi')
    history.observe(
      capture('held', 1, 64, { source: 'midi', voiceId: 'voice' }),
    )
    history.observe({ type: 'route-end', generation: 1, atSeconds: 102 })
    history.observe(capture('late', 3, 65))

    expect(history.snapshot(110).nowSeconds).toBe(2)
    expect(history.snapshot().notes[0].endSeconds).toBe(2)
    expect(history.snapshot().active).toBe(false)
    history.observe({ type: 'route-start', route: route(2) })
    expect(history.snapshot().notes).toEqual([])
  })

  it('rejects malformed pitches and clocks instead of folding them onto the neck', () => {
    const history = listening()
    history.observe(tick(1, 128))
    history.observe(tick(Number.NaN, 64))
    history.observe(capture('invalid', Number.NaN, 64))

    expect(history.snapshot().notes).toEqual([])
  })

  it('does not repaint the current note from an older analysis callback on the same route', () => {
    const history = listening()
    history.observe(tick(1, 64))
    history.observe(tick(2, 65))

    history.observe(tick(1.5, 67))

    expect(history.snapshot().notes.map((note) => note.midi)).toEqual([64, 65])
  })
})

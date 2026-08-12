// ============================================================
// Piano instrument router tests — fallback and exact voice ownership
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { PianoInstrumentKind, PianoInstrumentPort, } from './piano-instrument-port'
import { createPianoInstrumentRouter } from './piano-instrument-router'

function instrumentHarness(
  id: string,
  kind: PianoInstrumentKind,
  initialAcceptance = true,
) {
  let acceptsNotes = initialAcceptance
  const active = new Set<string>()
  const noteOn = vi.fn((note: Parameters<PianoInstrumentPort['noteOn']>[0]) => {
    if (!acceptsNotes) return false
    active.add(note.id)
    return true
  })
  const noteOff = vi.fn((note: Parameters<PianoInstrumentPort['noteOff']>[0]) =>
    active.delete(note.id),
  )
  const pedal = vi.fn()
  const panic = vi.fn(() => active.clear())
  const dispose = vi.fn()
  const load = vi.fn(() => Promise.resolve())
  const prewarm = vi.fn(() => Promise.resolve())
  const descriptor = Object.freeze({
    id,
    name: id,
    kind,
    maximumVoices: 88,
  })
  const port: PianoInstrumentPort = {
    descriptor: () => descriptor,
    load,
    prewarm,
    noteOn,
    noteOff,
    pedal,
    panic,
    activeVoiceIds: () => Array.from(active),
    dispose,
  }
  return {
    dispose,
    load,
    noteOff,
    noteOn,
    panic,
    pedal,
    port,
    prewarm,
    setAcceptance(value: boolean) {
      acceptsNotes = value
    },
  }
}

describe('createPianoInstrumentRouter', () => {
  it('releases a voice through its exact owner after selection changes', () => {
    const fallback = instrumentHarness('fallback', 'fallback')
    const sampled = instrumentHarness('sampled', 'sampled')
    const router = createPianoInstrumentRouter({
      fallback: fallback.port,
      sampled: sampled.port,
    })

    expect(router.noteOn({ id: 'live:1', midi: 60, velocity: 0.8 })).toBe(true)
    router.setPreference('fallback')
    expect(
      router.noteOff({
        id: 'live:1',
        releaseVelocity: 0.4,
        atContextTime: 12,
      }),
    ).toBe(true)

    expect(sampled.noteOff).toHaveBeenCalledWith({
      id: 'live:1',
      releaseVelocity: 0.4,
      atContextTime: 12,
    })
    expect(fallback.noteOff).not.toHaveBeenCalled()
    expect(router.noteOn({ id: 'live:2', midi: 64, velocity: 0.7 })).toBe(true)
    expect(fallback.noteOn).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'live:2' }),
    )
  })

  it('falls back synchronously when the sampled engine cannot accept a note', () => {
    const fallback = instrumentHarness('fallback', 'fallback')
    const sampled = instrumentHarness('sampled', 'sampled', false)
    const router = createPianoInstrumentRouter({
      fallback: fallback.port,
      sampled: sampled.port,
      preference: 'sampled',
    })

    expect(router.noteOn({ id: 'score:1', midi: 72, velocity: 0.9 })).toBe(true)
    expect(sampled.noteOn).toHaveBeenCalledOnce()
    expect(fallback.noteOn).toHaveBeenCalledOnce()
    expect(router.noteOff({ id: 'score:1', releaseVelocity: 0.25 })).toBe(true)
    expect(fallback.noteOff).toHaveBeenCalledWith({
      id: 'score:1',
      releaseVelocity: 0.25,
    })
    expect(sampled.noteOff).not.toHaveBeenCalled()
  })

  it('keeps retired engines reachable for release, pedal, panic, and disposal', () => {
    const fallback = instrumentHarness('fallback', 'fallback')
    const firstSampled = instrumentHarness('sampled-a', 'sampled')
    const secondSampled = instrumentHarness('sampled-b', 'sampled')
    const router = createPianoInstrumentRouter({
      fallback: fallback.port,
      sampled: firstSampled.port,
    })
    router.noteOn({ id: 'held', midi: 60, velocity: 0.8 })

    router.setSampled(secondSampled.port)
    router.pedal({ pedal: 'soft', value: 0.6 })
    expect(router.noteOff({ id: 'held', releaseVelocity: 0.1 })).toBe(true)
    expect(firstSampled.noteOff).toHaveBeenCalledWith({
      id: 'held',
      releaseVelocity: 0.1,
    })
    router.pedal({ pedal: 'soft', value: 0.2 })
    expect(firstSampled.pedal).toHaveBeenCalledTimes(2)
    expect(secondSampled.pedal).toHaveBeenCalledTimes(2)
    expect(fallback.pedal).toHaveBeenCalledTimes(2)

    router.dispose()
    router.dispose()
    expect(firstSampled.dispose).toHaveBeenCalledOnce()
    expect(secondSampled.dispose).toHaveBeenCalledOnce()
    expect(fallback.dispose).toHaveBeenCalledOnce()
  })

  it('keeps idle engines synchronized across pedal and selection changes', () => {
    const fallback = instrumentHarness('fallback', 'fallback')
    const sampled = instrumentHarness('sampled', 'sampled')
    const router = createPianoInstrumentRouter({
      fallback: fallback.port,
      sampled: sampled.port,
      preference: 'fallback',
    })

    router.pedal({ pedal: 'sustain', value: 1, atContextTime: 4 })

    expect(fallback.pedal).toHaveBeenCalledWith({
      pedal: 'sustain',
      value: 1,
      atContextTime: 4,
    })
    expect(sampled.pedal).toHaveBeenCalledWith({
      pedal: 'sustain',
      value: 1,
      atContextTime: 4,
    })
  })

  it('replays held pedal state to a sampled engine attached later', () => {
    const fallback = instrumentHarness('fallback', 'fallback')
    const sampled = instrumentHarness('sampled', 'sampled')
    const router = createPianoInstrumentRouter({
      fallback: fallback.port,
      preference: 'fallback',
    })
    router.pedal({ pedal: 'soft', value: 0.75 })
    router.pedal({ pedal: 'sustain', value: 1 })

    router.setSampled(sampled.port)

    expect(sampled.pedal.mock.calls.map(([event]) => event)).toEqual([
      { pedal: 'soft', value: 0.75 },
      { pedal: 'sustain', value: 1 },
    ])
  })

  it('sends pedal expression to a non-selected engine that reports active voices', () => {
    const fallback = instrumentHarness('fallback', 'fallback')
    const sampled = instrumentHarness('sampled', 'sampled')
    const router = createPianoInstrumentRouter({
      fallback: fallback.port,
      sampled: sampled.port,
      preference: 'fallback',
    })
    sampled.port.noteOn({ id: 'external', midi: 67, velocity: 0.8 })

    router.pedal({ pedal: 'soft', value: 0.5 })

    expect(fallback.pedal).toHaveBeenCalledOnce()
    expect(sampled.pedal).toHaveBeenCalledWith({ pedal: 'soft', value: 0.5 })
  })

  it('releases a duplicate voice id before routing its replacement', () => {
    const fallback = instrumentHarness('fallback', 'fallback')
    const sampled = instrumentHarness('sampled', 'sampled')
    const router = createPianoInstrumentRouter({
      fallback: fallback.port,
      sampled: sampled.port,
    })
    router.noteOn({ id: 'same', midi: 60, velocity: 0.8 })

    router.setPreference('fallback')
    router.noteOn({
      id: 'same',
      midi: 62,
      velocity: 0.7,
      atContextTime: 9,
    })

    expect(sampled.noteOff).toHaveBeenCalledWith({
      id: 'same',
      atContextTime: 9,
    })
    expect(fallback.noteOn).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'same', midi: 62 }),
    )
  })

  it('keeps ownership when a future release must be shortened', () => {
    const fallback = instrumentHarness('fallback', 'fallback')
    const sampled = instrumentHarness('sampled', 'sampled')
    const router = createPianoInstrumentRouter({
      fallback: fallback.port,
      sampled: sampled.port,
    })
    router.noteOn({ id: 'score:1', midi: 60, velocity: 0.8 })

    expect(router.noteOff({ id: 'score:1', atContextTime: 12 })).toBe(true)
    expect(router.noteOff({ id: 'score:1', atContextTime: 4 })).toBe(false)

    expect(sampled.noteOff).toHaveBeenNthCalledWith(1, {
      id: 'score:1',
      atContextTime: 12,
    })
    expect(sampled.noteOff).toHaveBeenNthCalledWith(2, {
      id: 'score:1',
      atContextTime: 4,
    })
    expect(fallback.noteOff).not.toHaveBeenCalled()
  })

  it('publishes only selection changes and delegates preparation', async () => {
    const fallback = instrumentHarness('fallback', 'fallback')
    const sampled = instrumentHarness('sampled', 'sampled')
    const router = createPianoInstrumentRouter({
      fallback: fallback.port,
      sampled: sampled.port,
    })
    const listener = vi.fn()
    const unsubscribe = router.subscribe(listener)

    router.noteOn({ id: 'live:1', midi: 60, velocity: 0.8 })
    router.noteOff({ id: 'live:1' })
    expect(listener).not.toHaveBeenCalled()

    await router.load()
    expect(sampled.load).toHaveBeenCalledOnce()
    router.setPreference('fallback')
    await router.prewarm([60, 64])
    expect(fallback.prewarm).toHaveBeenCalledWith([60, 64], undefined)
    expect(listener).toHaveBeenCalledOnce()
    expect(listener.mock.calls[0][0]).toMatchObject({
      preference: 'fallback',
      selected: { id: 'fallback' },
    })

    unsubscribe()
    router.setPreference('auto')
    expect(listener).toHaveBeenCalledOnce()
  })
})

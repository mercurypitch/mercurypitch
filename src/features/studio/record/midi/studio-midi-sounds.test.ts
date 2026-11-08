// Studio MIDI sounds tests — each arm takes its sound through a node of its own and lets it go; a sound is made once on a clock and anew on another; a drum lane strikes the kit at General MIDI velocity; and a piano lane plays the synth until the sampled grand has loaded, its notes on the clock.
import { describe, expect, it, vi } from 'vitest'
import type { StudioMidiModules } from './studio-midi-sounds'
import { createStudioMidiSounds } from './studio-midi-sounds'

function fakeNode() {
  return { connect: vi.fn(), disconnect: vi.fn() }
}

function fakeContext() {
  const gains: ReturnType<typeof fakeNode>[] = []
  const context = {
    currentTime: 3,
    createGain: () => {
      const gain = fakeNode()
      gains.push(gain)
      return gain
    },
  } as unknown as AudioContext
  return { context, gains }
}

function fakeModules() {
  const player = {
    activate: vi.fn(async () => true),
    trigger: vi.fn(),
    panic: vi.fn(),
    dispose: vi.fn(),
  }
  const router = {
    noteOn: vi.fn(),
    noteOff: vi.fn(),
    panic: vi.fn(),
    dispose: vi.fn(),
    setSampled: vi.fn(),
    setPreference: vi.fn(),
  }
  let loaded!: () => void
  const sampled = {
    load: vi.fn(
      () =>
        new Promise<void>((resolve) => {
          loaded = resolve
        }),
    ),
  }
  const modules = {
    drumKit: { createDrumKitPlayer: vi.fn(() => player) },
    synth: { createPianoFallbackSynth: vi.fn(() => ({ name: 'synth' })) },
    router: { createPianoInstrumentRouter: vi.fn(() => router) },
    sampled: { createPianoSampledInstrument: vi.fn(() => sampled) },
  }
  return {
    modules: modules as unknown as StudioMidiModules,
    raw: modules,
    player,
    router,
    sampled,
    load: () => loaded(),
  }
}

describe('the Studio MIDI sounds', () => {
  it('gives each arm a node of its own from its sound, and takes it off again', () => {
    // Arrange
    const { modules } = fakeModules()
    const { context, gains } = fakeContext()
    const sounds = createStudioMidiSounds(modules)

    // Act
    const first = sounds.attach('drums', context)
    first.detach()
    const second = sounds.attach('drums', context)

    // Assert: one bus, and an arm node for each arm.
    const [bus, firstNode, secondNode] = gains
    expect(first.node).toBe(firstNode)
    expect(second.node).toBe(secondNode)
    expect(bus.connect.mock.calls).toEqual([[firstNode], [secondNode]])
    expect(bus.disconnect).toHaveBeenCalledExactlyOnceWith(firstNode)
  })

  it('makes a sound once on a clock, and anew on another', () => {
    // Arrange
    const { modules, raw, player } = fakeModules()
    const sounds = createStudioMidiSounds(modules)
    const one = fakeContext().context
    const two = fakeContext().context

    // Act
    sounds.attach('drums', one)
    sounds.attach('drums', one)
    sounds.attach('drums', two)

    // Assert
    expect(raw.drumKit.createDrumKitPlayer).toHaveBeenCalledTimes(2)
    expect(player.dispose).toHaveBeenCalledOnce()
  })

  it('strikes the kit at General MIDI velocity on the clock', () => {
    // Arrange
    const { modules, player } = fakeModules()
    const sounds = createStudioMidiSounds(modules)
    const { voice } = sounds.attach('drums', fakeContext().context)

    // Act
    voice.start('v1', 38, 1, 4.25, 0)
    voice.start('v2', 42, 0.5, 4.5, 0)

    // Assert
    expect(player.activate).toHaveBeenCalledOnce()
    expect(player.trigger.mock.calls).toEqual([
      [{ gmKey: 38, velocity: 127, atContextTime: 4.25 }],
      [{ gmKey: 42, velocity: 64, atContextTime: 4.5 }],
    ])
  })

  it('plays a piano lane on the synth until the sampled grand has loaded, its notes on the clock', async () => {
    // Arrange
    const { modules, raw, router, load } = fakeModules()
    const sounds = createStudioMidiSounds(modules)
    const { voice } = sounds.attach('piano', fakeContext().context)

    // Act
    voice.start('v1', 60, 0.8, 4.25, 0.1)
    voice.stop('v1', 4.75, 0.3)
    const before = router.setPreference.mock.calls.length
    load()
    await Promise.resolve()
    await Promise.resolve()

    // Assert
    expect(raw.router.createPianoInstrumentRouter).toHaveBeenCalledWith(
      expect.objectContaining({ preference: 'fallback' }),
    )
    expect(router.noteOn).toHaveBeenCalledExactlyOnceWith({
      id: 'v1',
      midi: 60,
      velocity: 0.8,
      softPedalValue: 0.1,
      atContextTime: 4.25,
    })
    expect(router.noteOff).toHaveBeenCalledExactlyOnceWith({
      id: 'v1',
      releaseVelocity: 0.3,
      atContextTime: 4.75,
    })
    expect(before).toBe(0)
    expect(router.setPreference).toHaveBeenCalledExactlyOnceWith('auto')
  })
})

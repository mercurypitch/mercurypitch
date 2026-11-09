// Studio MIDI sounds tests — each arm plays a sound of its own into a node of its own and lets it go; two piano lanes play two pianos, each hearing only its own notes; a drum lane strikes the kit at General MIDI velocity; a piano lane plays the synth until the sampled grand has loaded, its notes on the clock; and an offline render's sound is built the same way, its instruments told they are offline, where a live arm's never are.
import { describe, expect, it, vi } from 'vitest'
import type { StudioMidiModules } from './studio-midi-sounds'
import { buildStudioDrumSound, buildStudioPianoSound, createStudioMidiSounds, } from './studio-midi-sounds'

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
  it('gives each arm a sound of its own, played into its own node, and lets it go with the arm', () => {
    // Arrange
    const { modules, raw, player } = fakeModules()
    const { context, gains } = fakeContext()
    const sounds = createStudioMidiSounds(modules)

    // Act
    const first = sounds.attach('drums', context)
    const second = sounds.attach('drums', context)
    first.detach()
    first.detach()

    // Assert: a kit and a node for each arm, the first one let go once.
    const [firstNode, secondNode] = gains
    expect(raw.drumKit.createDrumKitPlayer).toHaveBeenCalledTimes(2)
    expect(first.node).toBe(firstNode)
    expect(second.node).toBe(secondNode)
    expect(player.panic).toHaveBeenCalledOnce()
    expect(player.dispose).toHaveBeenCalledOnce()
    expect(firstNode.disconnect).toHaveBeenCalledOnce()
    expect(secondNode.disconnect).not.toHaveBeenCalled()
  })

  it('plays two piano lanes on two pianos, so each hears only its own notes, and lets every sound go with the Studio', () => {
    // Arrange
    const { modules, raw } = fakeModules()
    const routers = [0, 1].map(() => ({
      noteOn: vi.fn(),
      noteOff: vi.fn(),
      panic: vi.fn(),
      dispose: vi.fn(),
      setSampled: vi.fn(),
      setPreference: vi.fn(),
    }))
    raw.router.createPianoInstrumentRouter
      .mockReturnValueOnce(routers[0])
      .mockReturnValueOnce(routers[1])
    const sounds = createStudioMidiSounds(modules)
    const { context } = fakeContext()
    const keys = sounds.attach('piano', context)
    const pads = sounds.attach('piano', context)

    // Act
    keys.voice.start('k1', 60, 0.5, 4, 0)
    pads.voice.start('p1', 64, 0.5, 4, 0)
    sounds.dispose()

    // Assert
    expect(raw.sampled.createPianoSampledInstrument).toHaveBeenCalledTimes(2)
    expect(routers[0].noteOn.mock.calls.map(([note]) => note.midi)).toEqual([
      60,
    ])
    expect(routers[1].noteOn.mock.calls.map(([note]) => note.midi)).toEqual([
      64,
    ])
    expect(
      routers.every((router) => router.dispose.mock.calls.length === 1),
    ).toBe(true)
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

  it("builds a live arm's instruments with their live voice caps: none is told it is offline", () => {
    // Arrange
    const { modules, raw } = fakeModules()
    const sounds = createStudioMidiSounds(modules)
    const { context } = fakeContext()

    // Act
    sounds.attach('piano', context)
    sounds.attach('drums', context)

    // Assert
    const built = [
      raw.synth.createPianoFallbackSynth.mock.calls,
      raw.sampled.createPianoSampledInstrument.mock.calls,
      raw.drumKit.createDrumKitPlayer.mock.calls,
    ].map((calls) => (calls as unknown as [object][])[0][0])
    expect(built.some((options) => 'offline' in options)).toBe(false)
  })

  it("builds an offline render's sound the same way, its instruments told they are offline, and loads nothing on its own", () => {
    // Arrange
    const { modules, raw, player, sampled } = fakeModules()
    const { context, gains } = fakeContext()

    // Act
    const piano = buildStudioPianoSound(modules, context, { offline: true })
    const drums = buildStudioDrumSound(modules, context, { offline: true })

    // Assert: the same instruments, each into the sound's own node.
    const offline = expect.objectContaining({ offline: true })
    expect(raw.synth.createPianoFallbackSynth).toHaveBeenCalledWith(offline)
    expect(raw.sampled.createPianoSampledInstrument).toHaveBeenCalledWith(
      offline,
    )
    expect(raw.drumKit.createDrumKitPlayer).toHaveBeenCalledWith(offline)
    const [[synthOptions]] = raw.synth.createPianoFallbackSynth.mock
      .calls as unknown as [[{ getOutput(): unknown }]]
    expect(synthOptions.getOutput()).toBe(piano.bus)
    expect(piano.bus).toBe(gains[0])
    expect(drums.bus).toBe(gains[1])
    expect(sampled.load).not.toHaveBeenCalled()
    expect(player.activate).not.toHaveBeenCalled()
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

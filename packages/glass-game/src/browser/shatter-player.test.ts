// Fracture output tests — cached families, mute, cancellation and capture-safe one-shots.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createShatterVariantSelector, DEFAULT_SHATTER_PROFILE, shatterSoundAssetIds, } from '../content/shatter-sounds'
import { runnerCourseFixture } from './__fixtures__/runner-course'
import { createRecordedGlassFracture, readGlassEffectsVolume, } from './fracture-audio'
import { runnerShatterSafeSeconds } from './runner-shatter-window'
import { createShatterBufferCache, prepareShatterBuffers, silenceShatterCache, } from './shatter-buffer-cache'
import { createShatterPlayer } from './shatter-player'

const { fetchBytes } = vi.hoisted(() => ({ fetchBytes: vi.fn() }))
vi.mock('@irchiinnuss/mobile-runtime/asset-fetch', () => ({
  fetchAssetBytes: fetchBytes,
}))

class NodeFake {
  gain = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  }
  playbackRate = { setValueAtTime: vi.fn() }
  buffer: AudioBuffer | null = null
  onended: (() => void) | null = null
  connect = vi.fn((node: NodeFake) => node)
  disconnect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
}

function fixture() {
  const sources: NodeFake[] = [],
    gains: NodeFake[] = []
  const buffer = {
    duration: 2,
    numberOfChannels: 1,
    length: 88200,
  } as AudioBuffer
  const context = {
    state: 'running',
    currentTime: 10,
    decodeAudioData: vi.fn(async () => buffer),
    createBufferSource: () => {
      const node = new NodeFake()
      sources.push(node)
      return node
    },
    createGain: () => {
      const node = new NodeFake()
      gains.push(node)
      return node
    },
  }
  const cache = createShatterBufferCache()
  let volume = 0.65
  const player = createShatterPlayer({
    context: context as unknown as AudioContext,
    output: new NodeFake() as unknown as AudioNode,
    cache,
    volume: () => volume,
  })
  return {
    player,
    context,
    cache,
    sources,
    gains,
    buffer,
    setVolume: (value: number) => {
      volume = value
      player.setVolume()
    },
  }
}
beforeEach(() => {
  vi.useFakeTimers()
  fetchBytes.mockReset().mockResolvedValue(new ArrayBuffer(40))
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('recorded fracture output', () => {
  it('keeps an unawaited disposal audible tail in the shared capture handoff until retirement', async () => {
    const h = fixture()
    for (const id of shatterSoundAssetIds(DEFAULT_SHATTER_PROFILE))
      h.cache.buffers.set(id, { url: id, buffer: h.buffer })
    expect(h.player.play(DEFAULT_SHATTER_PROFILE, 'first')).toBe(true)
    const disposal = h.player.dispose()
    expect(h.player.dispose()).toBe(disposal)
    expect(h.cache.silences.size).toBe(1)
    const handoff = silenceShatterCache(h.cache)
    const stopCalls = h.sources[0]!.stop.mock.calls.length
    expect(h.player.play(DEFAULT_SHATTER_PROFILE, 'retired')).toBe(false)
    let quiet = false
    void handoff.then(() => {
      quiet = true
    })
    await vi.advanceTimersByTimeAsync(239)
    expect(quiet).toBe(false)
    expect(h.sources[0]!.disconnect).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await handoff
    await disposal
    expect(quiet).toBe(true)
    expect(h.sources[0]!.stop).toHaveBeenCalledTimes(stopCalls)
    expect(h.sources[0]!.disconnect).toHaveBeenCalledOnce()
    expect(h.player.active()).toBe(false)
    expect(h.cache.silences.size).toBe(0)
  })
  it('selects different genuine families and never repeats an adjacent pool take', () => {
    const pick = createShatterVariantSelector(),
      replay = createShatterVariantSelector()
    const sequence = Array.from({ length: 12 }, () =>
      pick(DEFAULT_SHATTER_PROFILE, 'same-target', 7),
    )
    expect(sequence).toEqual(
      Array.from({ length: 12 }, () =>
        replay(DEFAULT_SHATTER_PROFILE, 'same-target', 7),
      ),
    )
    expect(sequence.every((id, i) => i === 0 || id !== sequence[i - 1])).toBe(
      true,
    )
    expect(
      shatterSoundAssetIds({
        form: 'bowl',
        size: 'medium',
        material: 'thick-crystal',
      }),
    ).toEqual(['audio-shatter-bowl-01', 'audio-shatter-bowl-02'])
    expect(
      shatterSoundAssetIds({
        form: 'panel',
        size: 'large',
        material: 'thick-crystal',
      }),
    ).toEqual(['audio-shatter-large-panel-05', 'audio-shatter-large-panel-06'])
    expect(
      shatterSoundAssetIds({
        form: 'panel',
        size: 'medium',
        material: 'faceted-crystal',
      }),
    ).toEqual(['audio-shatter-large-panel-03', 'audio-shatter-large-panel-04'])
  })
  it('predecodes once, starts immediately at native pitch, and never fetches in a hit', async () => {
    const h = fixture(),
      abort = new AbortController()
    expect(h.player.play(DEFAULT_SHATTER_PROFILE, 'a')).toBe(false)
    expect(fetchBytes).not.toHaveBeenCalled()
    await prepareShatterBuffers(
      h.cache,
      h.context as unknown as AudioContext,
      (id) => id,
      [DEFAULT_SHATTER_PROFILE],
      abort.signal,
    )
    await prepareShatterBuffers(
      h.cache,
      h.context as unknown as AudioContext,
      (id) => id,
      [DEFAULT_SHATTER_PROFILE],
      abort.signal,
    )
    expect(fetchBytes).toHaveBeenCalledTimes(2)
    expect(h.context.decodeAudioData).toHaveBeenCalledTimes(2)
    expect(h.player.play(DEFAULT_SHATTER_PROFILE, 'a')).toBe(true)
    expect(h.player.play(DEFAULT_SHATTER_PROFILE, 'a')).toBe(true)
    expect(h.sources[0]!.buffer).toBe(h.buffer)
    expect(h.sources[0]!.start).toHaveBeenCalledWith(10)
    expect(h.sources[0]!.playbackRate.setValueAtTime).toHaveBeenCalledWith(
      1,
      10,
    )
    expect(h.player.play(DEFAULT_SHATTER_PROFILE, 'a')).toBe(false)
    expect(fetchBytes).toHaveBeenCalledTimes(2)
  })
  it('mute and capture handoff release active sources before the next mic opens', async () => {
    const h = fixture()
    for (const id of shatterSoundAssetIds(DEFAULT_SHATTER_PROFILE))
      h.cache.buffers.set(id, { url: id, buffer: h.buffer })
    h.player.play(DEFAULT_SHATTER_PROFILE, 'a')
    h.setVolume(0)
    expect(h.player.play(DEFAULT_SHATTER_PROFILE, 'b')).toBe(false)
    expect(h.sources[0]!.stop).toHaveBeenLastCalledWith(10.24)
    const handoff = silenceShatterCache(h.cache)
    const releaseCalls = h.gains[0]!.gain.setTargetAtTime.mock.calls.length
    h.setVolume(1)
    expect(h.gains[0]!.gain.setTargetAtTime).toHaveBeenCalledTimes(releaseCalls)
    let quiet = false
    void handoff.then(() => {
      quiet = true
    })
    await vi.advanceTimersByTimeAsync(239)
    expect(quiet).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await handoff
    expect(h.sources[0]!.disconnect).toHaveBeenCalledOnce()
    expect(h.player.active()).toBe(false)
  })
  it('omits corrupt optional audio and cancels native decode without late playback', async () => {
    const h = fixture(),
      abort = new AbortController()
    let resolve!: (buffer: AudioBuffer) => void
    h.context.decodeAudioData.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const preparation = prepareShatterBuffers(
      h.cache,
      h.context as unknown as AudioContext,
      (id) => id,
      [DEFAULT_SHATTER_PROFILE],
      abort.signal,
    )
    for (let i = 0; i < 5; i++) await Promise.resolve()
    abort.abort()
    await preparation
    await h.player.dispose()
    resolve(h.buffer)
    for (let i = 0; i < 8; i++) await Promise.resolve()
    expect(h.player.play(DEFAULT_SHATTER_PROFILE, 'late')).toBe(false)
    expect(h.sources).toHaveLength(0)
    expect(h.context.decodeAudioData).toHaveBeenCalledTimes(1)
    const failed = fixture()
    failed.context.decodeAudioData.mockRejectedValue(new Error('corrupt audio'))
    await prepareShatterBuffers(
      failed.cache,
      failed.context as unknown as AudioContext,
      (id) => id,
      [DEFAULT_SHATTER_PROFILE],
      new AbortController().signal,
    )
    const failedFetches = fetchBytes.mock.calls.length
    await prepareShatterBuffers(
      failed.cache,
      failed.context as unknown as AudioContext,
      (id) => id,
      [DEFAULT_SHATTER_PROFILE],
      new AbortController().signal,
    )
    expect(fetchBytes).toHaveBeenCalledTimes(failedFetches)
    expect(failed.player.play(DEFAULT_SHATTER_PROFILE, 'failed')).toBe(false)
    expect(console.warn).toHaveBeenCalled()
  })
  it('shares prepared recordings between minigames and retires a cancelled preparation', async () => {
    const h = fixture()
    const options = {
      context: h.context as unknown as AudioContext,
      output: new NodeFake() as unknown as AudioNode,
      assetUrl: (id: string) => id,
      profile: DEFAULT_SHATTER_PROFILE,
      volume: () => 0.5,
    }
    const first = createRecordedGlassFracture(options)
    await first.prepare()
    await first.dispose()
    const next = createRecordedGlassFracture(options)
    await next.prepare()
    expect(fetchBytes).toHaveBeenCalledTimes(2)
    expect(next.play('next', 0)).toBe(false)
    expect(h.sources).toHaveLength(0)
    await next.dispose()
    const cancelled = createRecordedGlassFracture({
      ...options,
      assetUrl: (id) => `new/${id}`,
    })
    const pending = cancelled.prepare()
    await cancelled.dispose()
    await pending
    expect(cancelled.play('retired')).toBe(false)
  })
  it('uses the existing overall sound preference without losing a zero volume', () => {
    const storage = {
      getItem: vi.fn(() => JSON.stringify({ muted: true, ambienceVolume: 1 })),
    }
    expect(readGlassEffectsVolume('fixture', storage)).toBe(0)
    expect(storage.getItem).toHaveBeenCalledWith('fixture:museum-audio:v1')
    storage.getItem.mockReturnValue(
      JSON.stringify({ muted: false, ambienceVolume: 0 }),
    )
    expect(readGlassEffectsVolume('fixture', storage)).toBe(0)
    storage.getItem.mockReturnValue('invalid')
    expect(readGlassEffectsVolume('fixture', storage)).toBe(0.65)
  })
  it('excludes only the completed target and suppresses or ends before another protected window', () => {
    const baseCourse = runnerCourseFixture(),
      first = baseCourse.targets[0]!
    const next = {
      ...first,
      id: 'next',
      protectedFromCourseSeconds: first.protectedUntilCourseSeconds + 3,
      protectedUntilCourseSeconds: first.protectedUntilCourseSeconds + 4,
    }
    const course = {
      ...baseCourse,
      lengthCourseSeconds: next.protectedUntilCourseSeconds + 5,
      targets: [first, next],
    }
    expect(
      runnerShatterSafeSeconds(
        course,
        first.id,
        first.protectedFromCourseSeconds,
      ),
    ).toBeGreaterThan(0)
    const guardStart = next.protectedFromCourseSeconds - 0.35
    expect(runnerShatterSafeSeconds(course, first.id, guardStart)).toBe(0)
    expect(
      runnerShatterSafeSeconds(course, first.id, guardStart - 0.5),
    ).toBeCloseTo(0.47)
    const h = fixture()
    for (const id of shatterSoundAssetIds(DEFAULT_SHATTER_PROFILE))
      h.cache.buffers.set(id, { url: id, buffer: h.buffer })
    expect(h.player.play(DEFAULT_SHATTER_PROFILE, 'short', 0.47)).toBe(true)
    expect(h.sources[0]!.stop.mock.calls[0]![0]).toBeCloseTo(10.47)
    expect(h.player.play(DEFAULT_SHATTER_PROFILE, 'protected', 0)).toBe(false)
  })
})

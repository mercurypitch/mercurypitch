// ============================================================
// preview-player — the pop-free envelope contract
// ============================================================
// jsdom has no real audio graph, so what these tests lock down is the
// ORDER and SHAPE of operations that make playback pop-free:
//   * gain starts at silence and swells (exponential) after play() runs
//   * pause decays exponentially first, pausing the element only after
//     the tail is inaudible
//   * a play() during the fade-out cancels the queued pause
//   * seeking while playing dips linearly around the position jump
//     (linear is fine there — the material is continuous, which masks it;
//     at silence boundaries linear reads as a squeezed pop, hence the
//     exponential shapes for start/stop)
// Break any of these and a discontinuity reaches the speakers.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPreviewPlayer, ENVELOPE_DEFAULTS } from '@/lib/preview-player'
import { showNotification } from '@/stores/notifications-store'

vi.mock('@/stores/notifications-store', () => ({ showNotification: vi.fn() }))

type GainOp = { op: string; value?: number; at?: number; tau?: number }

class FakeGainParam {
  value = 0
  ops: GainOp[] = []
  setValueAtTime(value: number, at: number) {
    this.value = value
    this.ops.push({ op: 'set', value, at })
  }
  linearRampToValueAtTime(value: number, at: number) {
    this.value = value
    this.ops.push({ op: 'linear', value, at })
  }
  exponentialRampToValueAtTime(value: number, at: number) {
    this.value = value
    this.ops.push({ op: 'exp', value, at })
  }
  setTargetAtTime(value: number, at: number, tau: number) {
    this.value = value
    this.ops.push({ op: 'target', value, at, tau })
  }
  cancelScheduledValues(at: number) {
    this.ops.push({ op: 'cancel', at })
  }
}

class FakeAudioContext {
  currentTime = 0
  state = 'running'
  destination = {}
  gainParam = new FakeGainParam()
  source = { connect: vi.fn(), disconnect: vi.fn() }
  envelope = {
    gain: this.gainParam,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
  createMediaElementSource = vi.fn(() => this.source)
  createGain = vi.fn(() => this.envelope)
  resume() {
    return Promise.resolve()
  }
  close = vi.fn(() => Promise.resolve())
}

class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = []
  src = ''
  preload = ''
  currentTime = 0
  duration = 200
  paused = true
  seeking = false
  /** Empty string is what a real element reports with no attribute set. */
  crossOrigin = ''
  removeAttribute = vi.fn((name: string) => {
    if (name === 'crossorigin') this.crossOrigin = ''
  })
  onended: (() => void) | null = null
  play = vi.fn(() => {
    this.paused = false
    return Promise.resolve()
  })
  pause = vi.fn(() => {
    this.paused = true
  })
  load = vi.fn()
  constructor() {
    super()
    FakeAudio.instances.push(this)
  }
}

let fakeCtx: FakeAudioContext

const lastElement = () => FakeAudio.instances.at(-1)!
const gainOps = () => fakeCtx.gainParam.ops
/** Wall time by which a default release has fully settled. */
const RELEASE_SETTLED_MS = ENVELOPE_DEFAULTS.releaseMs + 100

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(showNotification).mockClear()
  FakeAudio.instances = []
  fakeCtx = new FakeAudioContext()
  vi.stubGlobal('Audio', FakeAudio)
  // A constructor-function stub (not a class) — the rule dislikes
  // constructor-only classes, and all we need is `new AudioContext()`
  // handing back the shared recorder.
  vi.stubGlobal('AudioContext', function AudioContextStub() {
    return fakeCtx
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('createPreviewPlayer', () => {
  it('positions the first Play before opening its output envelope', async () => {
    const player = createPreviewPlayer()
    const started = player.play('blob:offset', { startSeconds: 1.237 })
    expect(gainOps().some((op) => op.op === 'exp')).toBe(false)
    expect(await started).toBe(true)
    expect(lastElement().currentTime).toBe(1.237)
    expect(gainOps().at(-1)?.op).toBe('exp')
    player.dispose()
  })

  it('keeps startup silent until seeking is ready, with last scrub winning', async () => {
    const player = createPreviewPlayer()
    const started = player.play('blob:offset', { startSeconds: 12 })
    const element = lastElement()
    element.seeking = true
    await Promise.resolve()
    expect(element.currentTime).toBe(12)
    expect(gainOps().some((op) => op.op === 'exp')).toBe(false)
    player.seekToFraction(0.4)
    await Promise.resolve()
    expect(player.currentTime).toBe(80)
    element.seeking = false
    element.dispatchEvent(new Event('seeked'))
    expect(await started).toBe(true)
    expect(element.currentTime).toBe(80)
    expect(gainOps().at(-1)?.op).toBe('exp')
    player.dispose()
  })

  it.each(['pause', 'stop', 'dispose'] as const)(
    'cancels a startup decoder seek when %s wins',
    async (action) => {
      const player = createPreviewPlayer()
      const started = player.play('blob:offset', { startSeconds: 12 })
      const element = lastElement()
      element.seeking = true
      await Promise.resolve()
      player[action]()
      expect(await started).toBe(false)
      element.seeking = false
      element.dispatchEvent(new Event('seeked'))
      await vi.advanceTimersByTimeAsync(RELEASE_SETTLED_MS)
      expect(gainOps().some((op) => op.op === 'exp')).toBe(false)
      expect(player.playing).toBe(false)
      player.dispose()
    },
  )

  it.each(['pause', 'stop'] as const)(
    '%s cancels a live seek dip without reopening output',
    async (action) => {
      const player = createPreviewPlayer()
      await player.play('blob:seek')
      lastElement().currentTime = 10
      player.seekToFraction(0.5)
      player[action]()
      const operations = gainOps().length
      await vi.advanceTimersByTimeAsync(25)
      expect(gainOps()).toHaveLength(operations)
      expect(lastElement().currentTime).toBe(10)
      await vi.advanceTimersByTimeAsync(RELEASE_SETTLED_MS)
      expect(player.playing).toBe(false)
      expect(lastElement().currentTime).toBe(action === 'stop' ? 0 : 100)
      player.dispose()
    },
  )

  it('defers paused scrubs until the audible release has finished', async () => {
    const player = createPreviewPlayer()
    await player.play('blob:seek')
    lastElement().currentTime = 10
    player.pause()
    player.seekToFraction(0.1)
    player.seekToFraction(0.4)
    expect(player.currentTime).toBe(80)
    expect(lastElement().currentTime).toBe(10)
    await vi.advanceTimersByTimeAsync(RELEASE_SETTLED_MS)
    expect(lastElement().currentTime).toBe(80)
    expect(lastElement().paused).toBe(true)
    player.dispose()
  })

  it('rewinds a rapid Stop then Play, after a safe dip rather than an audible jump', async () => {
    const player = createPreviewPlayer()
    await player.play('blob:seek')
    lastElement().currentTime = 10
    player.stop()
    const restarted = player.play('blob:seek')
    await Promise.resolve()
    expect(lastElement().currentTime).toBe(10)
    expect(player.currentTime).toBe(0)
    await vi.advanceTimersByTimeAsync(25)
    expect(await restarted).toBe(true)
    expect(lastElement().currentTime).toBe(0)
    await vi.advanceTimersByTimeAsync(RELEASE_SETTLED_MS)
    expect(lastElement().paused).toBe(false)
    player.dispose()
  })

  it('keeps the latest scrub when it follows Stop before release completes', async () => {
    const player = createPreviewPlayer()
    await player.play('blob:seek')
    lastElement().currentTime = 10
    player.stop()
    player.seekToFraction(0.3)
    expect(player.currentTime).toBe(60)
    expect(lastElement().currentTime).toBe(10)
    await vi.advanceTimersByTimeAsync(RELEASE_SETTLED_MS)
    expect(player.currentTime).toBe(60)
    expect(lastElement().paused).toBe(true)
    player.dispose()
  })

  it('does not restore an old live seek when a second scrub or Pause wins', async () => {
    const player = createPreviewPlayer()
    await player.play('blob:seek')
    const element = lastElement()
    element.seeking = true
    player.seekToFraction(0.2)
    await vi.advanceTimersByTimeAsync(25)
    expect(element.currentTime).toBe(40)
    player.seekToFraction(0.6)
    const operations = gainOps().length
    // This may be the first seek's completion. A fresh dip must still finish
    // before moving to the new target or allowing it to become audible.
    element.dispatchEvent(new Event('seeked'))
    await Promise.resolve()
    expect(gainOps()).toHaveLength(operations)
    expect(element.currentTime).toBe(40)
    await vi.advanceTimersByTimeAsync(25)
    expect(element.currentTime).toBe(120)
    player.pause()
    const pausedOperations = gainOps().length
    element.seeking = false
    element.dispatchEvent(new Event('seeked'))
    await Promise.resolve()
    expect(gainOps()).toHaveLength(pausedOperations)
    expect(player.playing).toBe(false)
    player.dispose()
  })

  it('cancels startup seek readiness when the URL is replaced', async () => {
    const player = createPreviewPlayer()
    const old = player.play('blob:old', { startSeconds: 12 })
    const element = lastElement()
    element.seeking = true
    await Promise.resolve()
    const latest = player.play('blob:new')
    expect(await latest).toBe(true)
    const operations = gainOps().length
    element.seeking = false
    element.dispatchEvent(new Event('seeked'))
    expect(await old).toBe(false)
    expect(gainOps()).toHaveLength(operations)
    expect(element.src).toBe('blob:new')
    expect(player.playing).toBe(true)
    player.dispose()
  })

  it('bounds seek readiness and reports failure instead of playing the wrong offset', async () => {
    const player = createPreviewPlayer()
    const started = player.play('blob:offset', { startSeconds: 12 })
    lastElement().seeking = true
    await vi.advanceTimersByTimeAsync(5_001)
    expect(await started).toBe(false)
    expect(player.playing).toBe(false)
    expect(gainOps().some((op) => op.op === 'exp')).toBe(false)
    expect(showNotification).toHaveBeenCalledOnce()
    player.dispose()
  })

  it('ignores invalid fractions and allows an exact end position', async () => {
    const player = createPreviewPlayer()
    await player.play('blob:offset')
    player.pause()
    await vi.advanceTimersByTimeAsync(RELEASE_SETTLED_MS)
    lastElement().currentTime = 10
    player.seekToFraction(NaN)
    player.seekToFraction(Infinity)
    expect(lastElement().currentTime).toBe(10)
    player.seekToFraction(4)
    expect(lastElement().currentTime).toBe(200)
    player.seekToFraction(-1)
    expect(lastElement().currentTime).toBe(0)
    player.dispose()
  })

  it.each(['pause', 'stop', 'dispose'] as const)(
    'does not open the envelope when a pending play settles after %s',
    async (action) => {
      const player = createPreviewPlayer()
      await player.play('blob:initial')
      player.pause()
      vi.advanceTimersByTime(RELEASE_SETTLED_MS)
      const element = lastElement()
      let complete!: () => void
      element.play.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            complete = resolve
          }),
      )
      const playing = player.play('blob:pending')
      player[action]()
      const envelopeOperations = gainOps().length
      complete()
      expect(await playing).toBe(false)
      expect(gainOps()).toHaveLength(envelopeOperations)
      expect(player.playing).toBe(false)
      vi.advanceTimersByTime(RELEASE_SETTLED_MS)
      expect(element.paused).toBe(true)
      if (action === 'dispose') {
        expect(await player.play('blob:after-dispose')).toBe(false)
        expect(fakeCtx.createMediaElementSource).toHaveBeenCalledTimes(1)
      } else player.dispose()
    },
  )

  it.each(['resolve', 'reject'] as const)(
    'a stale play %s cannot affect a newer successful playback',
    async (completion) => {
      const player = createPreviewPlayer()
      await player.play('blob:initial')
      const element = lastElement()
      let resolveOld!: () => void
      let rejectOld!: (error: Error) => void
      element.play.mockImplementationOnce(
        () =>
          new Promise<void>((resolve, reject) => {
            resolveOld = resolve
            rejectOld = reject
          }),
      )
      const oldPlay = player.play('blob:old')
      expect(await player.play('blob:new')).toBe(true)
      const operations = gainOps().length
      if (completion === 'resolve') resolveOld()
      else rejectOld(new Error('Old source failed'))
      expect(await oldPlay).toBe(false)
      expect(gainOps()).toHaveLength(operations)
      expect(player.playing).toBe(true)
      expect(element.src).toBe('blob:new')
      expect(element.pause).not.toHaveBeenCalled()
      expect(showNotification).not.toHaveBeenCalled()
      player.dispose()
    },
  )

  it('creates optional processing lazily and routes it before the final envelope', async () => {
    const processing = {
      input: {} as AudioNode,
      output: { connect: vi.fn() },
      dispose: vi.fn(),
    }
    const createProcessing = vi.fn(() => ({
      ...processing,
      output: processing.output as unknown as AudioNode,
    }))
    const destination = {} as AudioNode
    const player = createPreviewPlayer({
      audioGraph: {
        context: fakeCtx as unknown as AudioContext,
        destination,
      },
      createProcessing,
    })
    expect(FakeAudio.instances).toHaveLength(0)
    expect(createProcessing).not.toHaveBeenCalled()
    expect(fakeCtx.createMediaElementSource).not.toHaveBeenCalled()

    expect(await player.play('blob:recording')).toBe(true)
    expect(createProcessing).toHaveBeenCalledWith(fakeCtx)
    expect(fakeCtx.source.connect).toHaveBeenCalledExactlyOnceWith(
      processing.input,
    )
    expect(processing.output.connect).toHaveBeenCalledExactlyOnceWith(
      fakeCtx.envelope,
    )
    expect(fakeCtx.envelope.connect).toHaveBeenCalledExactlyOnceWith(
      destination,
    )
    expect(gainOps().at(-1)).toMatchObject({ op: 'exp', value: 1 })

    player.pause()
    expect(processing.dispose).not.toHaveBeenCalled()
    expect(lastElement().pause).not.toHaveBeenCalled()
    vi.advanceTimersByTime(RELEASE_SETTLED_MS)
    expect(lastElement().pause).toHaveBeenCalledTimes(1)
    expect(processing.dispose).not.toHaveBeenCalled()
    await player.play('blob:recording')
    expect(createProcessing).toHaveBeenCalledTimes(1)

    player.dispose()
    expect(fakeCtx.source.disconnect).toHaveBeenCalledTimes(1)
    expect(processing.dispose).toHaveBeenCalledTimes(1)
    expect(fakeCtx.envelope.disconnect).toHaveBeenCalledTimes(1)
    expect(fakeCtx.close).not.toHaveBeenCalled()
    player.dispose()
    expect(processing.dispose).toHaveBeenCalledTimes(1)
  })

  it('uses a supplied context and destination without optional processing or ownership', async () => {
    const destination = {} as AudioNode
    const player = createPreviewPlayer({
      audioGraph: { context: fakeCtx as unknown as AudioContext, destination },
    })
    vi.stubGlobal('AudioContext', function ForbiddenAudioContext() {
      throw new Error('Must borrow the supplied context')
    })
    expect(await player.play('blob:recording')).toBe(true)
    expect(fakeCtx.source.connect).toHaveBeenCalledExactlyOnceWith(
      fakeCtx.envelope,
    )
    expect(fakeCtx.envelope.connect).toHaveBeenCalledExactlyOnceWith(
      destination,
    )
    player.dispose()
    expect(fakeCtx.close).not.toHaveBeenCalled()
  })

  it('disposes optional processing and closes its own context', async () => {
    const processing = {
      input: {} as AudioNode,
      output: { connect: vi.fn() } as unknown as AudioNode,
      dispose: vi.fn(),
    }
    const player = createPreviewPlayer({ createProcessing: () => processing })
    await player.play('blob:recording')
    expect(fakeCtx.envelope.connect).toHaveBeenCalledExactlyOnceWith(
      fakeCtx.destination,
    )
    player.dispose()
    expect(processing.dispose).toHaveBeenCalledTimes(1)
    expect(fakeCtx.source.disconnect).toHaveBeenCalledTimes(1)
    expect(fakeCtx.envelope.disconnect).toHaveBeenCalledTimes(1)
    expect(fakeCtx.close).toHaveBeenCalledTimes(1)
  })

  it('fails explicit processing safely and allows retry without ever playing dry', async () => {
    const processing = {
      input: {} as AudioNode,
      output: { connect: vi.fn() } as unknown as AudioNode,
      dispose: vi.fn(),
    }
    const createProcessing = vi.fn(() => processing)
    createProcessing.mockImplementationOnce(() => {
      throw new Error('Amp unavailable')
    })
    const player = createPreviewPlayer({
      audioGraph: {
        context: fakeCtx as unknown as AudioContext,
        destination: {} as AudioNode,
      },
      createProcessing,
      errorMessage: 'This take could not be processed. Try again.',
    })
    expect(await player.play('blob:recording')).toBe(false)
    const failedElement = lastElement()
    expect(failedElement.play).not.toHaveBeenCalled()
    expect(fakeCtx.source.connect).not.toHaveBeenCalled()
    expect(fakeCtx.source.disconnect).toHaveBeenCalledTimes(1)
    expect(fakeCtx.envelope.disconnect).toHaveBeenCalledTimes(1)
    expect(fakeCtx.close).not.toHaveBeenCalled()
    expect(player.playing).toBe(false)
    expect(showNotification).toHaveBeenCalledWith(
      'This take could not be processed. Try again.',
      'error',
    )

    expect(await player.play('blob:recording')).toBe(true)
    expect(lastElement()).not.toBe(failedElement)
    expect(createProcessing).toHaveBeenCalledTimes(2)
    expect(fakeCtx.source.connect).toHaveBeenCalledExactlyOnceWith(
      processing.input,
    )
    player.dispose()
  })

  it('releases a prepared processor when connecting the explicit graph fails', async () => {
    const processing = {
      input: {} as AudioNode,
      output: {
        connect: vi.fn(() => {
          throw new Error('Invalid output route')
        }),
      },
      dispose: vi.fn(),
    }
    const player = createPreviewPlayer({
      createProcessing: () => ({
        ...processing,
        output: processing.output as unknown as AudioNode,
      }),
    })
    expect(await player.play('blob:recording')).toBe(false)
    expect(lastElement().play).not.toHaveBeenCalled()
    expect(processing.dispose).toHaveBeenCalledTimes(1)
    expect(fakeCtx.source.disconnect).toHaveBeenCalledTimes(1)
    expect(fakeCtx.envelope.disconnect).toHaveBeenCalledTimes(1)
    expect(fakeCtx.close).toHaveBeenCalledTimes(1)
    player.dispose()
    expect(processing.dispose).toHaveBeenCalledTimes(1)
  })

  it('swells in exponentially, only after playback starts', async () => {
    const player = createPreviewPlayer()
    await player.play('blob:stem')

    const element = lastElement()
    expect(element.play).toHaveBeenCalledTimes(1)
    // The final op is the exponential rise to full level; the swap pinned
    // the gain to 0 before playback ran.
    expect(gainOps().at(-1)).toMatchObject({ op: 'exp', value: 1 })
    expect(player.playing).toBe(true)
  })

  it('pauses the element only after the exponential release settles', async () => {
    const player = createPreviewPlayer()
    await player.play('blob:stem')
    const element = lastElement()

    player.pause()
    // Envelope closes immediately, with the decay shape…
    expect(gainOps().at(-1)).toMatchObject({ op: 'target', value: 0 })
    // …but the transport keeps running until the tail is inaudible.
    expect(element.pause).not.toHaveBeenCalled()
    expect(player.playing).toBe(false)

    vi.advanceTimersByTime(RELEASE_SETTLED_MS)
    expect(element.pause).toHaveBeenCalledTimes(1)
    // The floor is hard-zeroed for the next attack.
    expect(fakeCtx.gainParam.value).toBe(0)
  })

  it('cancels a pending pause when play() wins the race', async () => {
    const player = createPreviewPlayer()
    await player.play('blob:stem')
    const element = lastElement()

    player.pause()
    await player.play('blob:stem') // during the fade-out window
    vi.advanceTimersByTime(RELEASE_SETTLED_MS * 2)

    expect(element.pause).not.toHaveBeenCalled()
    expect(player.playing).toBe(true)
    expect(gainOps().at(-1)).toMatchObject({ op: 'exp', value: 1 })
  })

  it('dips linearly around a seek while playing', async () => {
    const player = createPreviewPlayer()
    await player.play('blob:stem')
    const element = lastElement()

    player.seekToFraction(0.5)
    expect(gainOps().at(-1)).toMatchObject({ op: 'linear', value: 0 })
    expect(element.currentTime).toBe(0) // not moved yet — still dipping

    await vi.advanceTimersByTimeAsync(ENVELOPE_DEFAULTS.seekFadeMs + 15)
    expect(element.currentTime).toBeCloseTo(100)
    expect(gainOps().at(-1)).toMatchObject({ op: 'linear', value: 1 })
  })

  it('seeks directly while paused — no signal, no pop, no dip', async () => {
    const player = createPreviewPlayer()
    await player.play('blob:stem')
    player.pause()
    vi.advanceTimersByTime(RELEASE_SETTLED_MS)

    const before = gainOps().length
    player.seekToFraction(0.25)
    expect(lastElement().currentTime).toBeCloseTo(50)
    expect(gainOps().length).toBe(before)
  })

  it('honors custom envelope timings', async () => {
    const player = createPreviewPlayer({ releaseMs: 500 })
    await player.play('blob:stem')
    const element = lastElement()

    player.pause()
    vi.advanceTimersByTime(RELEASE_SETTLED_MS)
    // Default settle time is not enough for a 500 ms release.
    expect(element.pause).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(element.pause).toHaveBeenCalledTimes(1)
  })

  it('degrades to direct control when the audio graph is unavailable', async () => {
    vi.stubGlobal('AudioContext', function BrokenAudioContext() {
      throw new Error('no audio')
    })
    const player = createPreviewPlayer()
    await player.play('blob:stem')
    const element = lastElement()
    expect(element.play).toHaveBeenCalled()

    player.pause()
    // No envelope to wait for — pause is immediate.
    expect(element.pause).toHaveBeenCalledTimes(1)
  })

  it('reports ended and resets the logical state', async () => {
    const onEnded = vi.fn()
    const player = createPreviewPlayer({ onEnded })
    await player.play('blob:stem')

    lastElement().onended?.()
    expect(onEnded).toHaveBeenCalledTimes(1)
    expect(player.playing).toBe(false)
  })

  it('a failed source resolves false with a notification, never a rejection', async () => {
    // The owner-reported crash: a CSP-blocked R2 stem URL rejected play()
    // and the fire-and-forget caller turned it into an app-level
    // "Application Error". The player must absorb it.
    const player = createPreviewPlayer()
    const element = new (globalThis.Audio as unknown as typeof FakeAudio)()
    void element
    const first = FakeAudio.instances.at(-1)

    // Make the NEXT created element (the player's own) reject play().
    const rejecting = () =>
      Promise.reject(new DOMException('no source', 'NotSupportedError'))

    const outcomePromise = player.play('https://r2.example/expired.wav')
    const playersElement = FakeAudio.instances.at(-1)!
    expect(playersElement).not.toBe(first)
    playersElement.play.mockImplementationOnce(rejecting)

    // First call already ran with the default resolve mock, so drive a
    // fresh attempt through the rejecting implementation instead.
    await outcomePromise
    playersElement.paused = true
    const failed = await player.play('https://r2.example/expired-2.wav')

    expect(failed).toBe(false)
    expect(player.playing).toBe(false)
    expect(showNotification).toHaveBeenCalledTimes(1)
    expect(vi.mocked(showNotification).mock.calls[0][0]).toContain(
      "Couldn't play",
    )
  })

  it('uses product-specific playback error copy when provided', async () => {
    const player = createPreviewPlayer({
      errorMessage:
        "Couldn't play this exercise example. Check your connection and try again.",
    })
    void (await player.play('blob:warm-up'))
    const element = lastElement()
    element.play.mockImplementationOnce(() =>
      Promise.reject(new DOMException('no source', 'NotSupportedError')),
    )

    expect(await player.play('blob:example')).toBe(false)
    expect(showNotification).toHaveBeenCalledWith(
      "Couldn't play this exercise example. Check your connection and try again.",
      'error',
    )
  })

  it('a retry after a failed source re-assigns the src', async () => {
    const player = createPreviewPlayer()
    void (await player.play('blob:one'))
    const element = lastElement()
    element.play.mockImplementationOnce(() =>
      Promise.reject(new DOMException('no source', 'NotSupportedError')),
    )
    expect(await player.play('blob:two')).toBe(false)

    // The failed URL was forgotten: replaying it must set src again and
    // succeed with the default (resolving) play mock.
    element.src = ''
    expect(await player.play('blob:two')).toBe(true)
    expect(element.src).toBe('blob:two')
  })

  // ------------------------------------------------------------
  // A stem that lives on another origin
  // ------------------------------------------------------------
  //
  // Every preview is routed through a MediaElementAudioSourceNode, and a
  // cross-origin element loaded without CORS is tainted — which feeds
  // that node silence. The seeded example songs' stems ARE the remote
  // URLs, so their previews were the ones that played nothing.

  it('asks for a cross-origin stem with CORS', async () => {
    const player = createPreviewPlayer()
    await player.play('https://cdn.example/demo/vocal.m4a')

    expect(lastElement().crossOrigin).toBe('anonymous')
  })

  it('leaves a local stem alone', async () => {
    const player = createPreviewPlayer()
    await player.play('blob:http://localhost/abc')

    // A visitor's own separation is an object URL. Asking for CORS there
    // buys nothing, and asking a host that sends no
    // Access-Control-Allow-Origin turns silence into a failed load.
    expect(lastElement().crossOrigin).toBe('')
  })

  it('leaves a same-origin stem alone', async () => {
    const player = createPreviewPlayer()
    await player.play(`${window.location.origin}/stems/vocal.wav`)

    expect(lastElement().crossOrigin).toBe('')
  })

  it('drops the attribute when the next source is local', async () => {
    const player = createPreviewPlayer()
    await player.play('https://cdn.example/demo/vocal.m4a')
    expect(lastElement().crossOrigin).toBe('anonymous')

    await player.play('blob:http://localhost/abc')
    expect(lastElement().crossOrigin).toBe('')
  })
})

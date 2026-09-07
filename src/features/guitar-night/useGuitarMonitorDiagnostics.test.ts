// ============================================================
// Monitor diagnostic lifetime tests — no acquisition, bounded polling and cleanup
// ============================================================

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGuitarMonitorDiagnostics } from './useGuitarMonitorDiagnostics'

function route(sampleRate = 48000) {
  const context = Object.assign(new EventTarget(), {
    state: 'running',
    sampleRate,
  })
  const getSettings = vi.fn(() => ({ sampleRate, channelCount: 4 }))
  const track = Object.assign(new EventTarget(), {
    readyState: 'live',
    muted: false,
    getSettings,
    getConstraints: () => ({}),
    stop: vi.fn(),
  })
  return {
    context,
    track,
    getSettings,
    source: {
      context: context as unknown as AudioContext,
      track: track as unknown as MediaStreamTrack,
      requestedDeviceId: null,
    },
  }
}

describe('monitor diagnostic lifecycle', () => {
  let dispose: () => void
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  })
  afterEach(() => {
    dispose?.()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })
  const mount = () =>
    createRoot((cleanup) => {
      dispose = cleanup
      return useGuitarMonitorDiagnostics()
    })

  it('remains inert until the listening owner attaches its existing route', () => {
    const contextConstructor = vi.fn()
    const micRequest = vi.fn()
    vi.stubGlobal('AudioContext', contextConstructor)
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: micRequest } })

    const diagnostics = mount()
    vi.advanceTimersByTime(5000)

    expect(diagnostics.snapshot()).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    expect(contextConstructor).not.toHaveBeenCalled()
    expect(micRequest).not.toHaveBeenCalled()
  })

  it('samples once per second without touching the source or changing its channel configuration', () => {
    const active = route()
    const diagnostics = mount()
    diagnostics.attach(active.source)

    vi.advanceTimersByTime(2999)

    expect(active.getSettings).toHaveBeenCalledTimes(3)
    expect(diagnostics.snapshot()?.observationSeconds).toBe(2)
    expect(active.track.stop).not.toHaveBeenCalled()
    expect(diagnostics.snapshot()?.capture.actual.channelCount).toBe(4)
  })

  it('stops refresh while hidden and resumes from the existing route when visible', () => {
    const active = route()
    const diagnostics = mount()
    diagnostics.attach(active.source)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(3000)
    expect(active.getSettings).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)

    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))

    expect(active.getSettings).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(1)
    expect(diagnostics.snapshot()?.observationSeconds).toBe(3)
  })

  it('refreshes an explicit channel change immediately and ignores refresh after teardown', () => {
    const active = route()
    const diagnostics = mount()
    let selected = 0
    diagnostics.attach({
      ...active.source,
      monitorInputChannel: () => selected,
    })
    vi.advanceTimersByTime(1000)
    selected = 1
    diagnostics.refresh()
    expect(diagnostics.snapshot()?.capture.monitorInputChannel).toBe(1)
    expect(diagnostics.snapshot()?.routeRevision).toBe(2)
    expect(diagnostics.snapshot()?.observationSeconds).toBe(0)
    diagnostics.clear()
    const reads = active.getSettings.mock.calls.length
    diagnostics.refresh()
    expect(active.getSettings).toHaveBeenCalledTimes(reads)
    expect(diagnostics.snapshot()).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('publishes interruption state without polling and restarts a fresh epoch on resume', () => {
    const active = route()
    const diagnostics = mount()
    diagnostics.attach(active.source)
    active.context.state = 'interrupted'
    active.context.dispatchEvent(new Event('statechange'))
    vi.advanceTimersByTime(2000)
    expect(diagnostics.snapshot()?.context.state).toBe('interrupted')
    expect(active.getSettings).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)

    active.context.state = 'running'
    active.context.dispatchEvent(new Event('statechange'))

    expect(diagnostics.snapshot()?.context.state).toBe('running')
    expect(diagnostics.snapshot()?.routeRevision).toBe(3)
    expect(diagnostics.snapshot()?.observationSeconds).toBe(0)
    expect(vi.getTimerCount()).toBe(1)
  })

  it('removes obsolete route listeners and clears its last snapshot on teardown', () => {
    const old = route()
    const next = route(44100)
    const diagnostics = mount()
    diagnostics.attach(old.source)
    diagnostics.attach(next.source)
    const last = diagnostics.snapshot()

    old.context.dispatchEvent(new Event('statechange'))
    old.track.dispatchEvent(new Event('ended'))
    expect(diagnostics.snapshot()).toBe(last)
    expect(old.getSettings).toHaveBeenCalledTimes(1)
    diagnostics.clear()
    vi.advanceTimersByTime(3000)
    next.context.dispatchEvent(new Event('statechange'))

    expect(diagnostics.snapshot()).toBeNull()
    expect(next.getSettings).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    expect(old.track.stop).not.toHaveBeenCalled()
    expect(next.track.stop).not.toHaveBeenCalled()
  })

  it('retains a visibly ended track snapshot but stops polling and never reacquires input', () => {
    const active = route()
    const diagnostics = mount()
    diagnostics.attach(active.source)

    active.track.readyState = 'ended'
    active.track.dispatchEvent(new Event('ended'))
    vi.advanceTimersByTime(5000)

    expect(diagnostics.snapshot()?.capture.trackState).toBe('ended')
    expect(active.getSettings).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cannot attach late results after its Solid owner has disposed', () => {
    const active = route()
    const diagnostics = mount()
    dispose()

    diagnostics.attach(active.source)
    vi.advanceTimersByTime(3000)

    expect(diagnostics.snapshot()).toBeNull()
    expect(active.getSettings).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})

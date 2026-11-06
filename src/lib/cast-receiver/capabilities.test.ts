// ============================================================
// Cast receiver capabilities tests — REQ-TV-117 and the spike's questions
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { CapabilityScope, ProbeAudioContext, } from '@/lib/cast-receiver/capabilities'
import { probeCastCapabilities } from '@/lib/cast-receiver/capabilities'

const close = vi.fn(() => Promise.resolve())

/** An AudioContext class with `outputLatency`, as current Chromium has. */
class ModernContext implements ProbeAudioContext {
  readonly sampleRate = 48_000
  readonly baseLatency = 0.0106667
  state = 'running'
  get outputLatency(): number {
    return this.state === 'running' ? 0.0426667 : 0
  }
  close = close
}

/** One that starts suspended, as a tab with no press starts it. */
class SuspendedContext extends ModernContext {
  state = 'suspended'
  resume = vi.fn(() => Promise.resolve())
}

/** One that starts suspended and starts when asked, as a Cast device lets it. */
class StartingContext extends ModernContext {
  state = 'suspended'
  resume = vi.fn(() => {
    this.state = 'running'
    return Promise.resolve()
  })
}

/** An older one with no `outputLatency` at all. */
class OlderContext implements ProbeAudioContext {
  readonly sampleRate = 44_100
  readonly baseLatency = 0.0116
  close = close
}

class Peer {
  createDataChannel(): void {}
}

class Socket {
  close(): void {}
}

/** A peer connection that opens no data channels. */
class PeerWithoutChannels {
  close(): void {}
}

function device(overrides: Partial<CapabilityScope> = {}): CapabilityScope {
  return {
    navigator: {
      userAgent: 'Mozilla/5.0 (Linux; Android 12) CrKey/1.56',
      hardwareConcurrency: 4,
      deviceMemory: 2,
    },
    screen: { width: 1920, height: 1080 },
    devicePixelRatio: 1,
    AudioContext: ModernContext,
    WebSocket: Socket,
    RTCPeerConnection: Peer,
    ...overrides,
  }
}

describe('probing a Cast device', () => {
  it('reads the screen, the cores, the memory and the network', async () => {
    const probed = await probeCastCapabilities(device())
    expect(probed.userAgent).toContain('CrKey')
    expect(probed.screen).toEqual({ width: 1920, height: 1080, pixelRatio: 1 })
    expect(probed.cores).toBe(4)
    expect(probed.deviceMemoryGb).toBe(2)
    expect(probed.network).toEqual({ webSocket: true, dataChannel: true })
  })

  it('measures the TV’s audio delay where AudioContext reports it', async () => {
    const probed = await probeCastCapabilities(device())
    expect(probed.audio).toEqual({
      context: true,
      sampleRate: 48_000,
      baseLatencyMs: 10.7,
      outputLatencyMs: 42.7,
      latencySource: 'measured',
    })
  })

  // REQ-TV-117: an older receiver without outputLatency falls back to the
  // stored calibration rather than failing.
  it('falls back to calibration where AudioContext has no outputLatency', async () => {
    const probed = await probeCastCapabilities(
      device({ AudioContext: OlderContext }),
    )
    expect(probed.audio.context).toBe(true)
    expect(probed.audio.outputLatencyMs).toBeNull()
    expect(probed.audio.latencySource).toBe('calibration')
  })

  it('says so where there is no Web Audio at all, or it refuses to start', async () => {
    const without = await probeCastCapabilities(
      device({ AudioContext: undefined }),
    )
    expect(without.audio).toMatchObject({
      context: false,
      latencySource: 'none',
    })
    class Refusing implements ProbeAudioContext {
      readonly sampleRate = 0
      constructor() {
        throw new Error('NotAllowedError')
      }
      close = close
    }
    const refused = await probeCastCapabilities(
      device({ AudioContext: Refusing }),
    )
    expect(refused.audio.latencySource).toBe('none')
  })

  it('starts a suspended context to read its delay, and reads none from one that stays suspended', async () => {
    const started = await probeCastCapabilities(
      device({ AudioContext: StartingContext }),
    )
    expect(started.audio).toMatchObject({
      outputLatencyMs: 42.7,
      latencySource: 'measured',
    })
    // A suspended context reads 0, which is not the TV's delay: no number.
    const stayed = await probeCastCapabilities(
      device({ AudioContext: SuspendedContext }),
    )
    expect(stayed.audio).toMatchObject({
      context: true,
      outputLatencyMs: null,
      latencySource: 'measured',
    })
  })

  it('closes the context it opened to read', async () => {
    close.mockClear()
    await probeCastCapabilities(device())
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('reads a missing data channel, socket and memory as absent', async () => {
    const probed = await probeCastCapabilities(
      device({
        WebSocket: undefined,
        RTCPeerConnection: PeerWithoutChannels,
        navigator: { userAgent: 'x' },
        devicePixelRatio: undefined,
      }),
    )
    expect(probed.network).toEqual({ webSocket: false, dataChannel: false })
    expect(probed.cores).toBeNull()
    expect(probed.deviceMemoryGb).toBeNull()
    expect(probed.screen.pixelRatio).toBe(1)
  })
})

// ============================================================
// The AirPlay sound check: seven ways, their beeps, their lines, their teardown
// ============================================================
//
// The page and the phone are stand-ins (CheckHost): what is under test is
// what each variant starts, inside the tap, what its one line says, and
// that it lets go of everything once its beeps have had time to reach a TV.

import { describe, expect, it, vi } from 'vitest'
import type { NativeAudioOutputReading } from '@/stores/native-shell-store'
import type { CheckHost, CheckVariant } from './airplay-check'
import { BEEP_HZ, beepSamples, beepSeconds, HOLD_MS, PLAYED_MS, runCheck, WAV_RATE, } from './airplay-check'

/** An iPhone 11 on AirPlay, as its app session reported it (3 Nov 2026). */
const ON_AIRPLAY: NativeAudioOutputReading = {
  volume: 0.2,
  volumeKnown: 'live',
  step: null,
  steps: null,
  route: 'airplay',
  outputs: [{ type: 'AirPlay', name: 'LG webOS TV' }],
  detail: { sampleRate: 44100 },
  reason: null,
}

function fakeContext() {
  const mediaSource = { connect: vi.fn(), disconnect: vi.fn() }
  const copyToChannel = vi.fn((_samples: Float32Array, _channel: number) => {})
  const source = {
    buffer: null as unknown,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }
  const context = {
    state: 'suspended',
    sampleRate: 44100,
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => {
      context.state = 'running'
    }),
    close: vi.fn(async () => {
      context.state = 'closed'
    }),
    createBuffer: vi.fn((_channels: number, length: number) => ({
      length,
      copyToChannel,
    })),
    createBufferSource: vi.fn(() => source),
    createMediaElementSource: vi.fn((_element: unknown) => mediaSource),
  }
  return { context, source, mediaSource, copyToChannel }
}

function fakeElement(refuse = false) {
  const attributes = new Map<string, string>()
  return {
    src: '',
    loop: false,
    muted: false,
    disableRemotePlayback: false,
    play: vi.fn(async () =>
      refuse
        ? Promise.reject(new DOMException('Not now', 'NotAllowedError'))
        : Promise.resolve(),
    ),
    pause: vi.fn(),
    load: vi.fn(),
    setAttribute: vi.fn((name: string, value: string) => {
      attributes.set(name, value)
    }),
    removeAttribute: vi.fn((name: string) => {
      attributes.delete(name)
    }),
    attributes,
  }
}

function fakeHost(options: { refusePlay?: boolean } = {}) {
  const { context, source, mediaSource, copyToChannel } = fakeContext()
  const element = fakeElement(options.refusePlay === true)
  const releaseMic = vi.fn()
  const host = {
    makeContext: vi.fn(() => context as unknown as AudioContext),
    makeElement: vi.fn(() => element as unknown as HTMLAudioElement),
    openMic: vi.fn(async () => releaseMic),
    readOutput: vi.fn(async () => ON_AIRPLAY),
    pageSession: () => 'auto',
    makeUrl: vi.fn((_blob: Blob) => 'blob:check'),
    dropUrl: vi.fn(),
    wait: vi.fn(async () => undefined),
    say: vi.fn(),
  } satisfies CheckHost
  return {
    host,
    context,
    source,
    mediaSource,
    copyToChannel,
    element,
    releaseMic,
  }
}

/** The samples of the 16-bit mono WAV a check made its element's URL from. */
async function wavOf(host: ReturnType<typeof fakeHost>['host']) {
  const blob = host.makeUrl.mock.calls[0]?.[0]
  if (blob === undefined) throw new Error('no WAV was made')
  // jsdom's Blob has no arrayBuffer(); its FileReader reads one.
  const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result as ArrayBuffer)
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('unreadable WAV'))
    }
    reader.readAsArrayBuffer(blob)
  })
  const view = new DataView(bytes)
  const samples = new Float32Array((view.byteLength - 44) / 2)
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = view.getInt16(44 + i * 2, true) / 0x8000
  }
  return samples
}

/** The bursts of sound in `samples`: how many beeps they hold. */
function bursts(samples: Float32Array): number {
  let count = 0
  let quietFor = Number.POSITIVE_INFINITY
  for (const sample of samples) {
    if (Math.abs(sample) > 0.01) {
      if (quietFor > WAV_RATE * 0.05) count += 1
      quietFor = 0
    } else {
      quietFor += 1
    }
  }
  return count
}

describe('the beeps', () => {
  it.each([1, 2, 3, 4, 5, 6, 7])(
    'beeps %i times, softly edged, in its length',
    (n) => {
      const samples = beepSamples(n, WAV_RATE)

      expect(bursts(samples)).toBe(n)
      expect(samples.length).toBe(Math.ceil(beepSeconds(n) * WAV_RATE))
      // A loop, not a spread: 7's 137 592 samples overflow the call stack.
      expect(
        samples.reduce((peak, s) => Math.max(peak, Math.abs(s)), 0),
      ).toBeLessThanOrEqual(0.3)
      // Soft edges: a beep starts from and returns to silence.
      expect(samples[0]).toBe(0)
      expect(samples.at(-1)).toBe(0)
      expect(BEEP_HZ).toBe(880)
    },
  )
})

describe('a check', () => {
  const lineOf = (host: CheckHost): string =>
    String((host.say as ReturnType<typeof vi.fn>).mock.calls[0]?.[0])

  it.each([
    [
      1,
      '[airplay check] 1 Media element: route=airplay sessionRate=44100 contextRate=none pageSession=auto state=none element=playing',
    ],
    [
      2,
      '[airplay check] 2 Media element kept local: route=airplay sessionRate=44100 contextRate=none pageSession=auto state=none element=playing',
    ],
    [
      3,
      '[airplay check] 3 Web Audio alone: route=airplay sessionRate=44100 contextRate=44100 pageSession=auto state=running',
    ],
    [
      4,
      '[airplay check] 4 Web Audio beside a silent element: route=airplay sessionRate=44100 contextRate=44100 pageSession=auto state=running element=playing',
    ],
    [
      5,
      '[airplay check] 5 Web Audio with the mic open: route=airplay sessionRate=44100 contextRate=44100 pageSession=auto state=running mic=open',
    ],
    [
      6,
      '[airplay check] 6 Media element through Web Audio: route=airplay sessionRate=44100 contextRate=44100 pageSession=auto state=running element=routed',
    ],
    [
      7,
      '[airplay check] 7 Web Audio after a paused element: route=airplay sessionRate=44100 contextRate=44100 pageSession=auto state=running element=paused',
    ],
  ] as const)(
    'writes one line for variant %i, naming no port',
    async (n, line) => {
      const fake = fakeHost()

      await runCheck(n as CheckVariant, fake.host)

      expect(fake.host.say).toHaveBeenCalledTimes(1)
      expect(lineOf(fake.host)).toBe(line)
      expect(lineOf(fake.host)).not.toMatch(/LG webOS/)
    },
  )

  it('starts its sound inside the tap: the play and the resume before the first await', () => {
    const element = fakeHost()
    const context = fakeHost()

    void runCheck(1, element.host)
    void runCheck(3, context.host)

    expect(element.element.play).toHaveBeenCalledTimes(1)
    expect(context.context.resume).toHaveBeenCalledTimes(1)
  })

  it('keeps every element but 1’s off AirPlay, and loops 4’s and 7’s silence', async () => {
    const allowed = fakeHost()
    const local = fakeHost()
    const beside = fakeHost()
    const after = fakeHost()

    await runCheck(1, allowed.host)
    await runCheck(2, local.host)
    await runCheck(4, beside.host)
    await runCheck(7, after.host)

    expect(allowed.element.setAttribute).not.toHaveBeenCalled()
    for (const kept of [local, beside, after]) {
      expect(kept.element.setAttribute).toHaveBeenCalledWith(
        'x-webkit-airplay',
        'deny',
      )
    }
    expect(beside.element.loop).toBe(true)
    expect(after.element.loop).toBe(true)
    expect(local.element.loop).toBe(false)
  })

  it('routes 6’s element kept local into its context, and plays it inside the tap', () => {
    const fake = fakeHost()

    void runCheck(6, fake.host)

    expect(fake.context.resume).toHaveBeenCalledTimes(1)
    expect(fake.element.setAttribute).toHaveBeenCalledWith(
      'x-webkit-airplay',
      'deny',
    )
    expect(fake.context.createMediaElementSource).toHaveBeenCalledWith(
      fake.element,
    )
    expect(fake.mediaSource.connect).toHaveBeenCalledWith(
      fake.context.destination,
    )
    expect(fake.element.play).toHaveBeenCalledTimes(1)
    // Routed before it plays, so no beep ever leaves it on its own.
    const [routedAt] =
      fake.context.createMediaElementSource.mock.invocationCallOrder
    const [playedAt] = fake.element.play.mock.invocationCallOrder
    expect(routedAt).toBeLessThan(playedAt ?? 0)
  })

  it('beeps 6 times from 6’s element alone, and 7 times from 7’s context after silence', async () => {
    const routed = fakeHost()
    const after = fakeHost()

    await runCheck(6, routed.host)
    await runCheck(7, after.host)

    expect(bursts(await wavOf(routed.host))).toBe(6)
    expect(routed.source.start).not.toHaveBeenCalled()
    expect(bursts(await wavOf(after.host))).toBe(0)
    expect(
      bursts(after.copyToChannel.mock.calls[0]?.[0] ?? new Float32Array()),
    ).toBe(7)
    expect(after.source.start).toHaveBeenCalledTimes(1)
  })

  it('pauses 7’s element after it played a second, before the beeps, neither muted nor emptied', async () => {
    const fake = fakeHost()
    let atBeeps: unknown = null
    fake.source.start.mockImplementation(() => {
      atBeeps = {
        pauses: fake.element.pause.mock.calls.length,
        muted: fake.element.muted,
        src: fake.element.src,
        emptied: fake.element.removeAttribute.mock.calls.length,
        loads: fake.element.load.mock.calls.length,
      }
    })

    await runCheck(7, fake.host)

    expect(atBeeps).toEqual({
      pauses: 1,
      muted: false,
      src: 'blob:check',
      emptied: 0,
      loads: 0,
    })
    expect(fake.host.wait.mock.calls[0]).toEqual([PLAYED_MS])
    const [waitedAt] = fake.host.wait.mock.invocationCallOrder
    const [pausedAt] = fake.element.pause.mock.invocationCallOrder
    expect(waitedAt).toBeLessThan(pausedAt ?? 0)
  })

  it('empties 7’s element once its beeps have had time to reach a TV', async () => {
    const fake = fakeHost()

    await runCheck(7, fake.host)

    expect(fake.host.wait).toHaveBeenLastCalledWith(
      beepSeconds(7) * 1000 + HOLD_MS,
    )
    expect(fake.element.removeAttribute).toHaveBeenCalledWith('src')
    expect(fake.element.load).toHaveBeenCalledTimes(1)
    expect(fake.host.dropUrl).toHaveBeenCalledWith('blob:check')
    expect(fake.context.close).toHaveBeenCalledTimes(1)
  })

  it('lets go of 6 whole: its element emptied, its node cut and its context closed', async () => {
    const fake = fakeHost()

    await runCheck(6, fake.host)

    expect(fake.host.wait).toHaveBeenCalledWith(beepSeconds(6) * 1000 + HOLD_MS)
    expect(fake.element.pause).toHaveBeenCalledTimes(1)
    expect(fake.element.removeAttribute).toHaveBeenCalledWith('src')
    expect(fake.element.load).toHaveBeenCalledTimes(1)
    expect(fake.host.dropUrl).toHaveBeenCalledWith('blob:check')
    expect(fake.mediaSource.disconnect).toHaveBeenCalledTimes(1)
    expect(fake.context.close).toHaveBeenCalledTimes(1)
  })

  it('says 6’s element could not be routed, and never plays it on its own', async () => {
    const fake = fakeHost()
    fake.context.createMediaElementSource.mockImplementationOnce(() => {
      throw new DOMException('Taken', 'InvalidStateError')
    })

    await runCheck(6, fake.host)

    expect(lineOf(fake.host)).toMatch(/element=unrouted:InvalidStateError$/)
    expect(fake.element.play).not.toHaveBeenCalled()
    expect(fake.host.dropUrl).toHaveBeenCalledWith('blob:check')
  })

  it('plays Web Audio from a source on the context, once its beeps are laid in', async () => {
    const fake = fakeHost()

    await runCheck(3, fake.host)

    expect(fake.context.createBuffer).toHaveBeenCalledWith(
      1,
      Math.ceil(beepSeconds(3) * 44100),
      44100,
    )
    expect(fake.source.connect).toHaveBeenCalledWith(fake.context.destination)
    expect(fake.source.start).toHaveBeenCalledTimes(1)
  })

  it('holds while AirPlay plays late, then lets go of everything', async () => {
    const fake = fakeHost()

    await runCheck(5, fake.host)

    expect(fake.host.wait).toHaveBeenCalledWith(beepSeconds(5) * 1000 + HOLD_MS)
    expect(fake.context.close).toHaveBeenCalledTimes(1)
    expect(fake.releaseMic).toHaveBeenCalledTimes(1)
    expect(fake.source.stop).toHaveBeenCalledTimes(1)
  })

  it('empties its element and revokes its URL', async () => {
    const fake = fakeHost()

    await runCheck(4, fake.host)

    expect(fake.element.pause).toHaveBeenCalled()
    expect(fake.element.removeAttribute).toHaveBeenCalledWith('src')
    expect(fake.element.load).toHaveBeenCalled()
    expect(fake.host.dropUrl).toHaveBeenCalledWith('blob:check')
    expect(fake.context.close).toHaveBeenCalledTimes(1)
  })

  it('says an element WebKit would not play, and still lets go of it', async () => {
    const fake = fakeHost({ refusePlay: true })

    await runCheck(1, fake.host)

    expect(lineOf(fake.host)).toMatch(/element=refused:NotAllowedError$/)
    expect(fake.host.dropUrl).toHaveBeenCalledWith('blob:check')
  })

  it('says a mic it could not open, and still closes its context', async () => {
    const fake = fakeHost()
    fake.host.openMic.mockRejectedValueOnce(
      new DOMException('Denied', 'NotAllowedError'),
    )

    await runCheck(5, fake.host)

    expect(lineOf(fake.host)).toMatch(/mic=refused:NotAllowedError$/)
    expect(fake.context.close).toHaveBeenCalledTimes(1)
    expect(fake.releaseMic).not.toHaveBeenCalled()
  })
})

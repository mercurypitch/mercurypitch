// ============================================================
// The AirPlay sound check: five ways, their beeps, their lines, their teardown
// ============================================================
//
// The page and the phone are stand-ins (CheckHost): what is under test is
// what each variant starts, inside the tap, what its one line says, and
// that it lets go of everything once its beeps have had time to reach a TV.

import { describe, expect, it, vi } from 'vitest'
import type { NativeAudioOutputReading } from '@/stores/native-shell-store'
import type { CheckHost, CheckVariant } from './airplay-check'
import { BEEP_HZ, beepSamples, beepSeconds, HOLD_MS, runCheck, WAV_RATE, } from './airplay-check'

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
      copyToChannel: vi.fn(),
    })),
    createBufferSource: vi.fn(() => source),
  }
  return { context, source }
}

function fakeElement(refuse = false) {
  const attributes = new Map<string, string>()
  return {
    src: '',
    loop: false,
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
  const { context, source } = fakeContext()
  const element = fakeElement(options.refusePlay === true)
  const releaseMic = vi.fn()
  const host = {
    makeContext: vi.fn(() => context as unknown as AudioContext),
    makeElement: vi.fn(() => element as unknown as HTMLAudioElement),
    openMic: vi.fn(async () => releaseMic),
    readOutput: vi.fn(async () => ON_AIRPLAY),
    pageSession: () => 'auto',
    makeUrl: vi.fn(() => 'blob:check'),
    dropUrl: vi.fn(),
    wait: vi.fn(async () => undefined),
    say: vi.fn(),
  } satisfies CheckHost
  return { host, context, source, element, releaseMic }
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
  it.each([1, 2, 3, 4, 5])(
    'beeps %i times, softly edged, in its length',
    (n) => {
      const samples = beepSamples(n, WAV_RATE)

      expect(bursts(samples)).toBe(n)
      expect(samples.length).toBe(Math.ceil(beepSeconds(n) * WAV_RATE))
      expect(Math.max(...samples.map(Math.abs))).toBeLessThanOrEqual(0.3)
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

  it('keeps the element off AirPlay for 2 and 4 only, and loops 4’s silence', async () => {
    const allowed = fakeHost()
    const local = fakeHost()
    const beside = fakeHost()

    await runCheck(1, allowed.host)
    await runCheck(2, local.host)
    await runCheck(4, beside.host)

    expect(allowed.element.setAttribute).not.toHaveBeenCalled()
    expect(local.element.setAttribute).toHaveBeenCalledWith(
      'x-webkit-airplay',
      'deny',
    )
    expect(beside.element.setAttribute).toHaveBeenCalledWith(
      'x-webkit-airplay',
      'deny',
    )
    expect(beside.element.loop).toBe(true)
    expect(local.element.loop).toBe(false)
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

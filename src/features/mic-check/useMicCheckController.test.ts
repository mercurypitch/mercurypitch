// The Settings mic check's controller, from the click that opens the
// microphone to the cleanup that lets it go: what it says when the input is
// paused, goes completely silent or will not open, and the switches it
// refuses while another feature holds the microphone.
//
// The voice session, the shared manager's stream and its consumers, the
// device list and the audio graph are faked at their edges; the roster, the
// analysis, the timeline and the words are the real ones.

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MicState } from '@/lib/mic-manager'
import { micManager } from '@/lib/mic-manager'
import type { OpenResult, ProbeResult, VoiceSession } from '@/lib/voice-session'
import type { FakeCapture, FakeMediaDevices } from './fake-capture.fixture'
import { audioInput, fakeCapture, fakeMediaDevices, fakeStream, fakeTrack, sine, } from './fake-capture.fixture'
import type { MicCheckController } from './useMicCheckController'
import { MIC_CHECK_ID, useMicCheckController } from './useMicCheckController'

const voice = vi.hoisted(() => ({
  opened: { ok: true } as OpenResult,
  context: null as AudioContext | null,
  /** The inputs the session was asked to switch to. */
  picked: [] as string[],
  close: vi.fn(),
  probe: (): Promise<ProbeResult> => Promise.resolve('ok'),
}))

vi.mock('@/lib/voice-session', () => ({
  createVoiceSession: (): VoiceSession =>
    ({
      open: (): Promise<OpenResult> => Promise.resolve(voice.opened),
      probe: (): Promise<ProbeResult> => voice.probe(),
      context: () => voice.context,
      useDevice: (deviceId: string): Promise<ProbeResult> => {
        voice.picked.push(deviceId)
        return Promise.resolve('ok' as ProbeResult)
      },
      isOpen: (): boolean => true,
      close: voice.close,
    }) as unknown as VoiceSession,
}))

const SCARLETT = audioInput('usb', 'Scarlett 4i4 USB', 'focusrite')
const BUILT_IN = audioInput('built-in', 'Built-in Microphone')

let capture: FakeCapture
let devices: FakeMediaDevices
let track: MediaStreamTrack
let queued: Map<number, FrameRequestCallback>
let nextId: number
/** The manager's listener, to tell the check who else holds the mic. */
let tellConsumers: (consumers: readonly string[]) => void

beforeEach(() => {
  voice.opened = { ok: true }
  voice.picked = []
  voice.close.mockClear()
  voice.probe = () => Promise.resolve('ok')
  capture = fakeCapture()
  voice.context = capture.context
  devices = fakeMediaDevices([SCARLETT, BUILT_IN])
  track = fakeTrack({
    label: 'Scarlett 4i4 USB',
    deviceId: 'usb',
    groupId: 'focusrite',
  })
  vi.spyOn(micManager, 'getStream').mockReturnValue(fakeStream(track))
  vi.spyOn(micManager, 'subscribe').mockImplementation((listener) => {
    tellConsumers = (consumers) =>
      listener({
        active: true,
        error: null,
        consumers,
        blockedBy: null,
      } satisfies MicState)
    tellConsumers([])
    return () => {}
  })
  queued = new Map()
  nextId = 1
  vi.spyOn(performance, 'now').mockReturnValue(0)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextId++
    queued.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => queued.delete(id))
})

afterEach(() => {
  devices.restore()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** A controller under its own root, and the way to end that root. */
function mounted(): MicCheckController & { dispose: () => void } {
  return createRoot((dispose) => ({ ...useMicCheckController(), dispose }))
}

/** Started, and past the line that says which input it listens on. */
async function listening(): Promise<
  MicCheckController & { dispose: () => void }
> {
  const check = mounted()
  check.start()
  await vi.waitFor(() =>
    expect(check.events()[0]?.text).toBe('Listening on Scarlett 4i4 USB'),
  )
  return check
}

/** Runs the frames asked for so far at `at` ms, as the browser would. */
function tick(at: number): void {
  const due = [...queued.values()]
  queued.clear()
  for (const callback of due) callback(at)
}

const lines = (check: MicCheckController): string[] =>
  check.events().map((event) => event.text)

describe('useMicCheckController', () => {
  it('listens once the session opens, on the input the track opened', async () => {
    // Arrange
    const check = mounted()

    // Act
    check.start()

    // Assert
    await vi.waitFor(() => expect(check.phase()).toBe('listening'))
    await vi.waitFor(() =>
      expect(lines(check)).toContain('Listening on Scarlett 4i4 USB'),
    )
    expect(check.roster().inputs.find((input) => input.isListening)?.name).toBe(
      'Scarlett 4i4 USB',
    )
    check.dispose()
  })

  it('goes back to idle and says why when the microphone will not open', async () => {
    // Arrange
    voice.opened = { ok: false, message: 'Microphone access was blocked.' }
    const check = mounted()

    // Act
    check.start()

    // Assert
    await vi.waitFor(() =>
      expect(check.events()[0]).toMatchObject({
        tone: 'bad',
        text: 'Microphone access was blocked.',
      }),
    )
    expect(check.phase()).toBe('idle')
    check.dispose()
  })

  it('says when the input goes completely silent', async () => {
    // Arrange: the analyser hands back exact zeros, as a muted input does.
    const check = await listening()

    // Act
    for (let at = 1_000; at <= 2_600; at += 100) tick(at)

    // Assert
    expect(check.events()).toContainEqual(
      expect.objectContaining({
        tone: 'bad',
        text: 'Scarlett 4i4 USB went completely silent',
      }),
    )
    check.dispose()
  })

  it('says when the system pauses the input', async () => {
    // Arrange
    const check = await listening()
    Object.assign(track, { muted: true })

    // Act
    track.dispatchEvent(new Event('mute'))

    // Assert
    expect(check.events()[0]).toMatchObject({
      tone: 'bad',
      text: 'Your system paused Scarlett 4i4 USB',
    })
    expect(check.track()?.muted).toBe(true)
    check.dispose()
  })

  it('treats a switch that opens nothing as a lost microphone', async () => {
    // Arrange
    const check = await listening()
    vi.mocked(micManager.getStream).mockReturnValue(null)

    // Act
    await check.listenTo('built-in')

    // Assert
    expect(check.phase()).toBe('idle')
    expect(check.events()[0]?.text).toBe(
      'The microphone was closed under the check',
    )
    check.dispose()
  })

  it('will not switch inputs while another feature holds the microphone', async () => {
    // Arrange
    const check = await listening()
    tellConsumers([MIC_CHECK_ID, 'stem-mixer'])

    // Act
    await check.listenTo('built-in')

    // Assert
    expect(voice.picked).toEqual([])
    expect(check.canSwitch()).toBe(false)
    expect(lines(check)).toContain('Karaoke started using the microphone')
    check.dispose()
  })

  it('stops cleanly while its first probe is still running', async () => {
    // Arrange: a probe that fails once the session closes under it.
    let fail: (reason: unknown) => void = () => undefined
    voice.probe = () =>
      new Promise<ProbeResult>((_resolve, reject) => {
        fail = reject
      })
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason)
    }
    process.on('unhandledRejection', onUnhandled)
    const check = await listening()

    // Act
    check.stop()
    fail(new TypeError("Cannot read properties of null (reading 'takeFrames')"))
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Assert
    process.off('unhandledRejection', onUnhandled)
    expect(unhandled).toEqual([])
    expect(check.phase()).toBe('idle')
    check.dispose()
  })

  it('does not blame the input when MercuryPitch let go of it', async () => {
    // Arrange: the manager stops the track itself when another tab asks for
    // the microphone or the page goes to the background, so it reads ended.
    const check = await listening()
    Object.assign(track, { readyState: 'ended' })

    // Act: the manager drops every hold, the check's with them.
    tellConsumers([])

    // Assert
    expect(check.phase()).toBe('idle')
    expect(check.events()[0]?.text).toBe(
      'The microphone was closed under the check',
    )
    check.dispose()
  })

  it('says the input went away when the device ended it', async () => {
    // Arrange
    const check = await listening()
    Object.assign(track, { readyState: 'ended' })
    vi.mocked(micManager.getStream).mockReturnValue(null)

    // Act: the stream is gone, the check's hold is kept.
    tellConsumers([MIC_CHECK_ID])

    // Assert
    expect(check.events()[0]?.text).toBe('The microphone went away')
    check.dispose()
  })

  it('gives the microphone lock back when it closes during a handoff', async () => {
    // Arrange
    let answer: (won: boolean) => void = () => undefined
    vi.spyOn(micManager, 'takeOverFromOtherTab').mockReturnValue(
      new Promise<boolean>((resolve) => {
        answer = resolve
      }),
    )
    const release = vi
      .spyOn(micManager, 'releaseTakeoverIfUnused')
      .mockResolvedValue()
    const check = mounted()
    const handoff = check.takeOver()

    // Act: Settings closes before the other tab answers.
    check.dispose()
    answer(true)
    await handoff

    // Assert
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('keeps saying it hears singing between held notes', async () => {
    // Arrange: a held A3 lands on its key.
    const check = await listening()
    capture.play(sine(220, 0.3))
    let at = 1_000
    for (; at < 1_400; at += 16) tick(at)
    expect(check.verdict().kind).toBe('singing')

    // Act: a breath, long enough for the note to let go.
    capture.play(sine(220, 0))
    for (; at < 1_800; at += 16) tick(at)

    // Assert
    expect(check.note()).toBeNull()
    expect(check.verdict().kind).toBe('singing')
    check.dispose()
  })

  it('lets the microphone go when its owner is gone', async () => {
    // Arrange
    const check = await listening()

    // Act
    check.dispose()

    // Assert
    expect(voice.close).toHaveBeenCalled()
    expect(check.live.active).toBe(false)
    for (const node of capture.nodes) expect(node.disconnect).toHaveBeenCalled()
  })
})

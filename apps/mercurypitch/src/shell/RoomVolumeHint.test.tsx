// ============================================================
// RoomVolumeHint: shown while the phone is low, gone when it rises
// ============================================================
//
// The phone is stood in for by an output that answers a read and sends
// changes, as AudioOutput does on both phones (native-device.ts wires it).

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NativeAudioOutput, NativeAudioOutputReading, NativeDeviceApi, } from '@/stores/native-shell-store'
import { registerNativeDevice, registerPushedBarEnd, } from '@/stores/native-shell-store'
import type { RenderedShell } from './render-for-test'
import { renderShell } from './render-for-test'
import type { MicWatch, RoomVolumeNotice } from './RoomVolumeHint'
import { HINT_LOW, HINT_SILENT, onRoomVolumeNotice, READ_AGAIN_MS, RoomVolumeHint, SETTLE_MS, } from './RoomVolumeHint'

const reading = (
  volume: number,
  volumeKnown: NativeAudioOutputReading['volumeKnown'] = 'live',
): NativeAudioOutputReading => ({
  volume,
  volumeKnown,
  step: null,
  steps: null,
  route: 'speaker',
  outputs: [{ type: 'Speaker', name: 'Speaker' }],
  detail: {},
  reason: null,
})

interface FakePhone extends NativeAudioOutput {
  /** The volume moves, and the phone says so. */
  send: (volume: number) => void
  /** The volume moves, and the phone says nothing: a read still finds it. */
  turn: (volume: number) => void
  stopped: () => boolean
  reads: () => number
}

/**
 * A phone at `first` (null: no reading at all) that answers a read with the
 * volume as it is when asked, and sends what `send` is given. `known` is how
 * far its readings can be taken at their word.
 */
function phone(
  first: number | null,
  known: NativeAudioOutputReading['volumeKnown'] = 'live',
): FakePhone {
  let handler: ((r: NativeAudioOutputReading) => void) | null = null
  let stopped = false
  let now = first
  const read = vi.fn(async () => (now === null ? null : reading(now, known)))
  return {
    read,
    watch: vi.fn((next: (r: NativeAudioOutputReading) => void) => {
      handler = next
      return () => {
        stopped = true
      }
    }),
    send: (volume) => {
      now = volume
      handler?.(reading(volume, known))
    },
    turn: (volume) => {
      now = volume
    },
    stopped: () => stopped,
    reads: () => read.mock.calls.length,
  }
}

interface FakeMic {
  readonly watch: MicWatch
  /** The page's mic opens (true) or closes (false). */
  set: (open: boolean) => void
  watching: () => boolean
}

/** The page's microphone, which the rooms open and close. */
function mic(): FakeMic {
  let handler: ((open: boolean) => void) | null = null
  return {
    watch: (next) => {
      handler = next
      return () => {
        handler = null
      }
    },
    set: (open) => handler?.(open),
    watching: () => handler !== null,
  }
}

/** The page shown or hidden, as the app going behind another one does. */
function pageShown(shown: boolean): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (shown ? 'visible' : 'hidden'),
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

let view: RenderedShell | null = null
const cleanups: (() => void)[] = []

afterEach(() => {
  view?.unmount()
  view = null
  for (const cleanup of cleanups.splice(0)) cleanup()
})

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

const hint = (): HTMLElement | null =>
  view?.container.querySelector<HTMLElement>(
    '[data-testid="room-volume-hint"]',
  ) ?? null

describe('RoomVolumeHint', () => {
  it('shows nothing where the app has no reading of the volume, as on the web', async () => {
    view = renderShell(() => <RoomVolumeHint />)
    await settle()
    expect(hint()).toBeNull()
    expect(
      view.container.querySelector('[data-testid="room-volume-slot"]'),
    ).not.toBeNull()
  })

  it('asks for the volume to go up when the room opens on a low one', async () => {
    const output = phone(0.125)
    view = renderShell(() => <RoomVolumeHint output={output} />)
    await settle()
    expect(hint()?.textContent).toBe(HINT_LOW)
    expect(hint()?.dataset.silent).toBe('false')
    // Announced as it appears: the region was there before it.
    expect(hint()?.parentElement?.getAttribute('role')).toBe('status')
  })

  it('says so when the volume is at zero', async () => {
    const output = phone(0)
    view = renderShell(() => <RoomVolumeHint output={output} />)
    await settle()
    expect(hint()?.textContent).toBe(HINT_SILENT)
    expect(hint()?.dataset.silent).toBe('true')
  })

  it('stays away when the volume is fine', async () => {
    const output = phone(0.75)
    view = renderShell(() => <RoomVolumeHint output={output} />)
    await settle()
    expect(hint()).toBeNull()
  })

  it('goes the moment the volume rises, and comes back on a fall to low', async () => {
    const output = phone(0)
    view = renderShell(() => <RoomVolumeHint output={output} />)
    await settle()
    expect(hint()).not.toBeNull()

    output.send(0.0625)
    expect(hint()).toBeNull()

    output.send(0.5)
    expect(hint()).toBeNull()

    output.send(0.1875)
    expect(hint()?.textContent).toBe(HINT_LOW)
  })

  it('drops a read answered after a change it has already heard', async () => {
    const output = phone(0)
    view = renderShell(() => <RoomVolumeHint output={output} />)
    // The change lands before the read's answer, which is older.
    output.send(0.75)
    await settle()
    expect(hint()).toBeNull()
  })

  it('stops listening when the room closes', async () => {
    const output = phone(0.5)
    view = renderShell(() => <RoomVolumeHint output={output} />)
    await settle()
    expect(output.stopped()).toBe(false)
    view.unmount()
    view = null
    expect(output.stopped()).toBe(true)
  })

  it('listens to the phone the app registered when none is handed in', async () => {
    const output = phone(0.0625)
    cleanups.push(
      registerNativeDevice({
        audioOutput: output,
      } as unknown as NativeDeviceApi),
    )
    view = renderShell(() => <RoomVolumeHint />)
    await settle()
    expect(hint()?.textContent).toBe(HINT_LOW)
  })

  // iOS hears the volume only while the app's own audio session is active,
  // and the system ends that session whenever it suspends the app; Android
  // says nothing when a stream is muted or unmuted without its level
  // moving. A change can come with no word from the phone, so the hint
  // asks again while it is up, and whenever the app comes back.
  describe('when the phone sends no word of a change', () => {
    afterEach(() => {
      vi.useRealTimers()
      Reflect.deleteProperty(document, 'visibilityState')
    })

    it('goes when a read while it is up finds the volume raised', async () => {
      vi.useFakeTimers()
      const output = phone(0)
      view = renderShell(() => <RoomVolumeHint output={output} />)
      await settle()
      expect(hint()?.textContent).toBe(HINT_SILENT)

      output.turn(0.0625)
      await vi.advanceTimersByTimeAsync(READ_AGAIN_MS)
      expect(hint()).toBeNull()
    })

    it('stops asking once it has gone, and never asks while the volume is fine', async () => {
      vi.useFakeTimers()
      const output = phone(0)
      view = renderShell(() => <RoomVolumeHint output={output} />)
      await settle()
      output.send(0.5)
      expect(hint()).toBeNull()
      // The one read the room's opening is owed once WebKit has settled.
      await vi.advanceTimersByTimeAsync(SETTLE_MS)
      const asked = output.reads()

      await vi.advanceTimersByTimeAsync(READ_AGAIN_MS * 10)
      expect(output.reads()).toBe(asked)
    })

    it('asks again when the app comes back to the front', async () => {
      vi.useFakeTimers()
      const output = phone(0.75)
      view = renderShell(() => <RoomVolumeHint output={output} />)
      await settle()
      expect(hint()).toBeNull()

      // Turned down behind another app, with no word from the phone.
      pageShown(false)
      output.turn(0)
      pageShown(true)
      await settle()
      expect(hint()?.textContent).toBe(HINT_SILENT)
    })

    it('does not ask while the app is behind another one', async () => {
      vi.useFakeTimers()
      const output = phone(0)
      view = renderShell(() => <RoomVolumeHint output={output} />)
      await settle()
      pageShown(false)
      const asked = output.reads()

      await vi.advanceTimersByTimeAsync(READ_AGAIN_MS * 4)
      expect(output.reads()).toBe(asked)
    })

    it('drops an answer that comes after a newer change', async () => {
      vi.useFakeTimers()
      const output = phone(0)
      view = renderShell(() => <RoomVolumeHint output={output} />)
      await settle()
      let answer: (r: NativeAudioOutputReading) => void = () => undefined
      vi.mocked(output.read).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            answer = resolve
          }),
      )
      await vi.advanceTimersByTimeAsync(READ_AGAIN_MS)
      output.send(0.0625)
      expect(hint()).toBeNull()

      // The read was asked before the change: its zero is older.
      answer(reading(0))
      await settle()
      expect(hint()).toBeNull()
    })

    it('asks once at a time while an answer is slow', async () => {
      vi.useFakeTimers()
      const output = phone(0)
      view = renderShell(() => <RoomVolumeHint output={output} />)
      await settle()
      vi.mocked(output.read).mockImplementation(
        () => new Promise<NativeAudioOutputReading | null>(() => undefined),
      )
      const asked = output.reads()

      await vi.advanceTimersByTimeAsync(READ_AGAIN_MS * 5)
      expect(output.reads()).toBe(asked + 1)
    })

    it('keeps asking after a read that fails', async () => {
      vi.useFakeTimers()
      const output = phone(0)
      view = renderShell(() => <RoomVolumeHint output={output} />)
      await settle()
      vi.mocked(output.read).mockRejectedValueOnce(new Error('bridge gone'))
      await vi.advanceTimersByTimeAsync(READ_AGAIN_MS)

      output.turn(0.0625)
      await vi.advanceTimersByTimeAsync(READ_AGAIN_MS)
      expect(hint()).toBeNull()
    })

    it('stops asking when the room closes', async () => {
      vi.useFakeTimers()
      const output = phone(0)
      view = renderShell(() => <RoomVolumeHint output={output} />)
      await settle()
      view.unmount()
      view = null
      const asked = output.reads()

      pageShown(true)
      await vi.advanceTimersByTimeAsync(READ_AGAIN_MS * 4)
      expect(output.reads()).toBe(asked)
    })
  })

  // An iPhone's own session can read 0 while the room plays out loud (build
  // 880): from that reading alone the hint claims no number.
  it("never says zero from the iPhone session's reading alone", async () => {
    const output = phone(0, 'session')
    view = renderShell(() => <RoomVolumeHint output={output} />)
    await settle()
    expect(hint()?.textContent).toBe(HINT_LOW)
    expect(hint()?.dataset.silent).toBe('false')
  })

  it('says zero once a reading taken at its word confirms it', async () => {
    const output = phone(0, 'session')
    view = renderShell(() => <RoomVolumeHint output={output} />)
    await settle()
    vi.mocked(output.read).mockResolvedValue(reading(0, 'agreed'))
    pageShown(true)
    await settle()
    expect(hint()?.textContent).toBe(HINT_SILENT)
    Reflect.deleteProperty(document, 'visibilityState')
  })

  // Opening the mic moves WebKit's session, and with it the volume iOS
  // plays the room at (WebKit bug 236219). The phone may say nothing.
  describe('when WebKit may have moved the sound to another volume', () => {
    afterEach(() => {
      vi.useRealTimers()
      Reflect.deleteProperty(document, 'visibilityState')
    })

    it('reads again once the room has settled', async () => {
      vi.useFakeTimers()
      const output = phone(0.5)
      view = renderShell(() => (
        <RoomVolumeHint output={output} mic={mic().watch} />
      ))
      await settle()
      expect(hint()).toBeNull()

      // WebKit switched as the room opened, after the first read.
      output.turn(0)
      await vi.advanceTimersByTimeAsync(SETTLE_MS)
      expect(hint()?.textContent).toBe(HINT_SILENT)
    })

    it('reads again as the mic opens and as it closes, at once and once settled', async () => {
      vi.useFakeTimers()
      const output = phone(0.5)
      const page = mic()
      view = renderShell(() => (
        <RoomVolumeHint output={output} mic={page.watch} />
      ))
      await settle()
      await vi.advanceTimersByTimeAsync(SETTLE_MS)
      const asked = output.reads()

      page.set(true)
      await settle()
      expect(output.reads()).toBe(asked + 1)
      output.turn(0.125)
      await vi.advanceTimersByTimeAsync(SETTLE_MS)
      expect(output.reads()).toBe(asked + 2)
      expect(hint()?.textContent).toBe(HINT_LOW)

      output.send(0.5)
      page.set(false)
      await settle()
      expect(output.reads()).toBe(asked + 3)
      await vi.advanceTimersByTimeAsync(SETTLE_MS)
      expect(output.reads()).toBe(asked + 4)
      expect(hint()).toBeNull()
    })

    it('does not read once settled while the app is behind another one', async () => {
      vi.useFakeTimers()
      const output = phone(0.5)
      const page = mic()
      view = renderShell(() => (
        <RoomVolumeHint output={output} mic={page.watch} />
      ))
      await settle()
      pageShown(false)
      const asked = output.reads()
      await vi.advanceTimersByTimeAsync(SETTLE_MS * 2)
      expect(output.reads()).toBe(asked)
    })

    it('stops hearing the mic, and reads nothing more, when the room closes', async () => {
      vi.useFakeTimers()
      const output = phone(0.5)
      const page = mic()
      view = renderShell(() => (
        <RoomVolumeHint output={output} mic={page.watch} />
      ))
      await settle()
      page.set(true)
      expect(page.watching()).toBe(true)
      view.unmount()
      view = null
      expect(page.watching()).toBe(false)
      const asked = output.reads()
      await vi.advanceTimersByTimeAsync(SETTLE_MS * 2)
      expect(output.reads()).toBe(asked)
    })
  })

  it('tells its listeners each change to what it shows, with the reading behind it', async () => {
    const heard: RoomVolumeNotice[] = []
    cleanups.push(onRoomVolumeNotice((notice) => heard.push(notice)))
    const output = phone(0)
    view = renderShell(() => <RoomVolumeHint output={output} />)
    await settle()
    output.send(0)
    output.send(0.0625)
    output.send(0.5)

    expect(heard.map((n) => [n.text, n.reading.volume, n.cause])).toEqual([
      [HINT_SILENT, 0, 'room open'],
      [null, 0.0625, 'change: unnamed'],
    ])
    expect(heard[0]?.reading.volumeKnown).toBe('live')
  })

  it("ends where the room's controls in the bar begin", async () => {
    vi.stubGlobal('innerWidth', 390)
    const end = document.createElement('div')
    document.body.append(end)
    vi.spyOn(end, 'getBoundingClientRect').mockReturnValue({
      left: 247,
      width: 131,
    } as DOMRect)
    cleanups.push(registerPushedBarEnd(end), () => {
      end.remove()
      vi.unstubAllGlobals()
    })
    const output = phone(0.125)
    view = renderShell(() => <RoomVolumeHint output={output} />)
    await settle()
    const slot = hint()?.parentElement
    // 390 - 247 + 8: an 8 px gap before the level pill.
    expect(slot?.style.right).toBe('151px')
  })
})

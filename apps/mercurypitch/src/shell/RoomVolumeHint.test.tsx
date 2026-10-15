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
import { HINT_LOW, HINT_SILENT, RoomVolumeHint } from './RoomVolumeHint'

const reading = (volume: number): NativeAudioOutputReading => ({
  volume,
  step: null,
  steps: null,
  route: 'speaker',
  outputs: [{ type: 'Speaker', name: 'Speaker' }],
  detail: {},
  reason: null,
})

interface FakePhone extends NativeAudioOutput {
  send: (volume: number) => void
  stopped: () => boolean
}

/** A phone that answers `first` to a read, and sends what `send` is given. */
function phone(first: number | null): FakePhone {
  let handler: ((r: NativeAudioOutputReading) => void) | null = null
  let stopped = false
  return {
    read: vi.fn(async () => (first === null ? null : reading(first))),
    watch: vi.fn((next: (r: NativeAudioOutputReading) => void) => {
      handler = next
      return () => {
        stopped = true
      }
    }),
    send: (volume) => handler?.(reading(volume)),
    stopped: () => stopped,
  }
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

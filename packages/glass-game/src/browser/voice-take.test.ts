// Take lifecycle — recording is explicitly started, finite, local, and discarded on interruption.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBrowserVoiceTake, supportedTakeMime } from './voice-take'

class FakeRecorder {
  static instances: FakeRecorder[] = []
  static isTypeSupported(type: string) {
    return type === 'audio/webm;codecs=opus'
  }
  readonly mimeType = 'audio/webm;codecs=opus'
  state = 'inactive'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(readonly stream: MediaStream) {
    FakeRecorder.instances.push(this)
  }
  start() {
    this.state = 'recording'
  }
  stop() {
    this.state = 'inactive'
  }
  data(value = 'voice') {
    this.ondataavailable?.({ data: new Blob([value]) })
  }
  ended() {
    this.onstop?.()
  }
}
beforeEach(() => {
  vi.useFakeTimers()
  FakeRecorder.instances = []
  vi.stubGlobal('MediaRecorder', FakeRecorder)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('explicit local voice takes', () => {
  it('uses the supplied stream and finalizes the last chunk after stop', async () => {
    const source = { getTracks: vi.fn() } as unknown as MediaStream
    const take = createBrowserVoiceTake(source)
    const recorder = FakeRecorder.instances[0]!
    expect(recorder.stream).toBe(source)
    recorder.data('first')
    const result = take.finish()
    recorder.data('last')
    recorder.ended()
    expect(await (await result)?.text()).toBe('firstlast')
    expect((await result)?.type).toBe('audio/webm;codecs=opus')
    expect(source.getTracks).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
  it.each([
    'cancel',
    'error',
    'unexpected-stop',
    'time-limit',
    'size-limit',
  ] as const)(
    'discards %s without preserving partial audio',
    async (reason) => {
      const take = createBrowserVoiceTake({} as MediaStream)
      const recorder = FakeRecorder.instances[0]!
      recorder.data()
      if (reason === 'cancel') take.discard()
      if (reason === 'error') recorder.onerror?.()
      if (reason === 'unexpected-stop') recorder.ended()
      if (reason === 'time-limit') vi.advanceTimersByTime(45_000)
      if (reason === 'size-limit')
        recorder.ondataavailable?.({
          data: new Blob([new Uint8Array(13 * 1024 * 1024)]),
        })
      expect(await take.finish()).toBeNull()
      expect(vi.getTimerCount()).toBe(0)
    },
  )
  it('bounds finalization and allows discarding a pending completion', async () => {
    const take = createBrowserVoiceTake({} as MediaStream)
    FakeRecorder.instances[0]!.data()
    const result = take.finish()
    vi.advanceTimersByTime(2000)
    expect(await result).toBeNull()
    const second = createBrowserVoiceTake({} as MediaStream)
    FakeRecorder.instances[1]!.data()
    const pending = second.finish()
    second.discard()
    FakeRecorder.instances[1]!.ended()
    expect(await pending).toBeNull()
  })
  it('reports unsupported browsers without acquiring any input', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    expect(supportedTakeMime()).toBeUndefined()
    expect(() => createBrowserVoiceTake({} as MediaStream)).toThrow(
      'cannot save',
    )
  })
})

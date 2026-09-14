// Metadata probe tests prove successful, failed and cancelled reads release every browser resource.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { audioDurationSecs } from './audio-duration'

class MetadataAudio {
  static instances: MetadataAudio[] = []
  duration = 12
  preload = ''
  src = ''
  onloadedmetadata: (() => void) | null = null
  onerror: (() => void) | null = null
  load = vi.fn()
  removeAttribute = vi.fn()
  constructor() {
    MetadataAudio.instances.push(this)
  }
}
beforeEach(() => {
  vi.useFakeTimers()
  MetadataAudio.instances = []
  vi.stubGlobal('Audio', MetadataAudio)
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:metadata')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('audio duration metadata', () => {
  it.each(['metadata', 'error', 'timeout', 'abort'] as const)(
    'cleans up after %s',
    async (result) => {
      const abort = new AbortController()
      const pending = audioDurationSecs(
        new File(['wav'], 'one.wav'),
        abort.signal,
      )
      const element = MetadataAudio.instances[0]!
      if (result === 'metadata') element.onloadedmetadata?.()
      else if (result === 'error') element.onerror?.()
      else if (result === 'abort') abort.abort()
      else vi.advanceTimersByTime(3000)
      await expect(pending).resolves.toBe(result === 'metadata' ? 12 : null)
      expect(element.preload).toBe('metadata')
      expect(element.removeAttribute).toHaveBeenCalledWith('src')
      expect(element.load).toHaveBeenCalledOnce()
      expect(element.onloadedmetadata).toBeNull()
      expect(element.onerror).toBeNull()
      expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
        'blob:metadata',
      )
      expect(vi.getTimerCount()).toBe(0)
    },
  )
  it('does not allocate a URL for an already cancelled probe', async () => {
    const abort = new AbortController()
    abort.abort()
    await expect(
      audioDurationSecs(new File(['wav'], 'one.wav'), abort.signal),
    ).resolves.toBeNull()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
})

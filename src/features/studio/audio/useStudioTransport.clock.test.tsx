// Studio transport on the page's clock — each song opened plays on the clock the Studio page lends, and lets it go only once its own audio is released.
import { createRoot } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import type { StudioClock } from './studio-clock'
import { createStudioClock, StudioClockContext } from './studio-clock'
import { useStudioTransport } from './useStudioTransport'
import type { StudioWebLease } from './web-audio-lease'

type Transport = ReturnType<typeof useStudioTransport>

function fakeLease() {
  return {
    ensure: () => null,
    unlock: vi.fn(() => Promise.resolve(false)),
    sampleRate: 48000,
    close: vi.fn(() => Promise.resolve()),
  } satisfies StudioWebLease
}

/** A song's workspace transport, mounted under the page's clock; returns it and its unmount. */
function openSong(clock: StudioClock): [Transport, () => void] {
  let transport!: Transport
  const Song = () => {
    transport = useStudioTransport({
      project: () => null,
      assets: () => [],
      readCanonicalAsset: () => Promise.reject(new Error('no audio')),
    })
    return null
  }
  const unmount = createRoot((dispose) => {
    ;<StudioClockContext.Provider value={clock}>
      <Song />
    </StudioClockContext.Provider>
    return dispose
  })
  return [transport, unmount]
}

describe('Studio transport on the page clock', () => {
  it('plays every song opened on the page clock, and the clock closes after the Studio and its last song', async () => {
    const lease = fakeLease()
    const clock = createStudioClock(lease)
    const [first, closeFirst] = openSong(clock)
    await first.primeAudio()
    expect(lease.unlock).toHaveBeenCalledOnce()

    // The next song opens as the first closes: the same clock, still open.
    const [second, closeSecond] = openSong(clock)
    closeFirst()
    await second.primeAudio()
    expect(lease.unlock).toHaveBeenCalledTimes(2)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(lease.close).not.toHaveBeenCalled()

    // Leaving the Studio closes it once the open song has let it go.
    clock.close()
    expect(lease.close).not.toHaveBeenCalled()
    closeSecond()
    await vi.waitFor(() => expect(lease.close).toHaveBeenCalledOnce())
  })
})

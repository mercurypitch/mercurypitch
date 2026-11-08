// Studio microphone share tests — every armed audio lane records from the one input opened once, held until its last lane lets go; a lane asking for another input while lanes are armed on one is refused in words that name both; an input whose lanes have all left gives way; a re-arm keeps it open; a failed open holds nothing.
import { describe, expect, it, vi } from 'vitest'
import type { StudioOpenedInput } from './studio-mic-share'
import { createStudioMicShare, StudioInputRefusal, studioOneInputWords, } from './studio-mic-share'

const NAMES: Record<string, string> = {
  vox: 'Vocals',
  gtr: 'Guitar',
  bass: 'Bass',
}

function share(armed: (trackId: string | null) => boolean = () => true) {
  const releases: ReturnType<typeof vi.fn>[] = []
  const open = vi.fn(async (deviceId: string | null) => {
    const release = vi.fn()
    releases.push(release)
    return {
      stream: { id: deviceId ?? 'default' } as unknown as MediaStream,
      missing: false,
      release,
    } satisfies StudioOpenedInput
  })
  const mic = createStudioMicShare({
    open,
    armed,
    laneName: (trackId) => (trackId === null ? 'the new lane' : NAMES[trackId]),
  })
  return { mic, open, releases }
}

const SCARLETT = { deviceId: 'scarlett', name: 'Scarlett 2i2' }
const WEBCAM = { deviceId: 'webcam', name: 'Webcam microphone' }

describe('the one input armed audio lanes share', () => {
  it('opens it once for every lane on it, and lets it go with the last', async () => {
    // Arrange
    const { mic, open, releases } = share()

    // Act
    const vox = await mic.open('vox', SCARLETT)
    const gtr = await mic.open('gtr', SCARLETT)
    vox.release()
    const afterOne = releases[0].mock.calls.length
    gtr.release()
    await Promise.resolve()

    // Assert
    expect(open).toHaveBeenCalledExactlyOnceWith('scarlett')
    expect(gtr.stream).toBe(vox.stream)
    expect(afterOne).toBe(0)
    expect(releases[0]).toHaveBeenCalledOnce()
    expect(mic.name()).toBeNull()
  })

  it('shares the default between lanes that follow it, and opens the input inside the press', () => {
    // Arrange
    const { mic, open } = share()

    // Act
    void mic.open('vox', { deviceId: null, name: 'Default input' })
    void mic.open('gtr', { deviceId: null, name: 'Default input' })

    // Assert: asked for before anything was awaited.
    expect(open).toHaveBeenCalledExactlyOnceWith(null)
    expect(mic.name()).toBe('Default input')
  })

  it('refuses a lane on another input while lanes are armed on one, naming both lanes and both inputs', async () => {
    // Arrange
    const { mic, open } = share()
    await mic.open('vox', SCARLETT)

    // Act
    const one = await mic.open('bass', WEBCAM).catch((error: unknown) => error)
    await mic.open('gtr', SCARLETT)
    const two = await mic.open('bass', WEBCAM).catch((error: unknown) => error)

    // Assert
    expect(one).toBeInstanceOf(StudioInputRefusal)
    expect((one as StudioInputRefusal).words).toBe(
      'Bass records from Webcam microphone, and Vocals is armed on Scarlett 2i2. Studio records from one audio input at a time: disarm Vocals, or choose Scarlett 2i2 for Bass.',
    )
    expect((two as StudioInputRefusal).words).toBe(
      'Bass records from Webcam microphone, and Vocals and Guitar are armed on Scarlett 2i2. Studio records from one audio input at a time: disarm them, or choose Scarlett 2i2 for Bass.',
    )
    expect(open).toHaveBeenCalledOnce()
  })

  it('gives way to another input once every lane on it has left, even before their late releases', async () => {
    // Arrange
    let voxArmed = true
    const { mic, open, releases } = share(
      (trackId) => trackId !== 'vox' || voxArmed,
    )
    const vox = await mic.open('vox', SCARLETT)

    // Act: Escape left the lane while its input opened, then another input.
    voxArmed = false
    const bass = await mic.open('bass', WEBCAM)
    vox.release()
    await Promise.resolve()

    // Assert
    expect(open.mock.calls).toEqual([['scarlett'], ['webcam']])
    expect(releases[0]).toHaveBeenCalledOnce()
    expect(releases[1]).not.toHaveBeenCalled()
    expect(mic.name()).toBe('Webcam microphone')
    bass.release()
  })

  it('keeps the input open while a lane on it re-arms, and holds nothing for another input', async () => {
    // Arrange
    const { mic, open, releases } = share()
    const before = await mic.open('vox', SCARLETT)

    // Act: the lane's channel changed; it re-arms on the same input.
    const keep = mic.retain('scarlett')
    before.release()
    const after = await mic.open('vox', SCARLETT)
    keep()
    const noop = mic.retain('webcam')
    noop()
    await Promise.resolve()

    // Assert
    expect(open).toHaveBeenCalledOnce()
    expect(releases[0]).not.toHaveBeenCalled()
    after.release()
    await Promise.resolve()
    expect(releases[0]).toHaveBeenCalledOnce()
  })

  it('holds nothing when the input is refused, and tries again on the next arm', async () => {
    // Arrange
    const open = vi
      .fn<(deviceId: string | null) => Promise<StudioOpenedInput>>()
      .mockRejectedValueOnce(
        Object.assign(new Error('denied'), { kind: 'permission-denied' }),
      )
    const mic = createStudioMicShare({
      open,
      armed: () => true,
      laneName: (trackId) => String(trackId),
    })

    // Act
    const first = mic.open('vox', SCARLETT).catch((error: unknown) => error)
    const second = mic.open('gtr', SCARLETT).catch((error: unknown) => error)
    const refused = await Promise.all([first, second])
    open.mockResolvedValueOnce({
      stream: {} as MediaStream,
      missing: false,
      release: vi.fn(),
    })
    const again = await mic.open('vox', SCARLETT)

    // Assert
    expect(refused.map((error) => (error as Error).message)).toEqual([
      'denied',
      'denied',
    ])
    expect(open).toHaveBeenCalledTimes(2)
    expect(again.missing).toBe(false)
  })

  it('names one lane, or several, in its words', () => {
    // Arrange, Act, Assert
    expect(studioOneInputWords('Bass', 'B', ['Vocals'], 'A')).toBe(
      'Bass records from B, and Vocals is armed on A. Studio records from one audio input at a time: disarm Vocals, or choose A for Bass.',
    )
    expect(
      studioOneInputWords('Bass', 'B', ['Vocals', 'Guitar', 'Keys'], 'A'),
    ).toBe(
      'Bass records from B, and Vocals, Guitar and Keys are armed on A. Studio records from one audio input at a time: disarm them, or choose A for Bass.',
    )
  })
})

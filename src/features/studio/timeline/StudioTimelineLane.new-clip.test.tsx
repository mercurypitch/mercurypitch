// Studio lane tests for a new MIDI clip — a double-click with a mouse, or two taps with a finger, on an empty stretch of a lane that plays MIDI asks for an empty clip from the bar under it, four bars long; a lane of audio, and a song that cannot be edited now, make none; and a lane with no room for a bar there says why.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { studioMidiFixture } from '@/lib/studio/model/model.test-fixtures'
import { STUDIO_NEW_CLIP_NO_ROOM } from '@/lib/studio/model/new-midi-clips'
import { StudioTimeline } from './StudioTimeline'

// jsdom has no PointerEvent; without one the events lose their pointer's type.
if (typeof window.PointerEvent === 'undefined')
  window.PointerEvent = class extends MouseEvent {
    readonly pointerId: number
    readonly pointerType: string
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
      this.pointerType = init.pointerType ?? 'mouse'
    }
  } as unknown as typeof PointerEvent

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** The song's lanes at 20 px a second, its keys lane holding a clip from 1 s to 2.5 s; bars of two seconds at 120 bpm. */
function mount(writable = true) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  const make = vi.fn()
  const { project, assets } = studioMidiFixture()
  const view = render(() => (
    <StudioTimeline
      project={project}
      assets={assets}
      selectedClipId={null}
      playheadFrame={0}
      pixelsPerSecond={20}
      writable={writable}
      phone={false}
      onSelectClip={vi.fn()}
      onSeek={vi.fn()}
      onCommand={vi.fn(() => true)}
      onClipDetails={vi.fn()}
      onTrackDetails={vi.fn()}
      onNewMidiClip={make}
      readCanonicalAsset={vi.fn(() => Promise.reject(new Error('Missing')))}
    />
  ))
  /** Lane `trackId`'s empty stretch, its left edge on the song's first frame. */
  const lane = (trackId: string) => {
    const element = view.container.querySelector<HTMLElement>(
      `[data-studio-track="${trackId}"] [data-studio-lane-audio]`,
    )!
    element.getBoundingClientRect = () => new DOMRect(0, 0, 2000, 64)
    return element
  }
  return { make, lane }
}

/** A mouse's double-click at `seconds` into the song. */
function doubleClick(element: HTMLElement, seconds: number): void {
  fireEvent.pointerDown(element, { pointerType: 'mouse' })
  fireEvent.dblClick(element, { clientX: seconds * 20, detail: 2 })
}

/** Two taps of a finger at `seconds` into the song. */
function twoTaps(element: HTMLElement, seconds: number): void {
  for (let tap = 0; tap < 2; tap++) {
    fireEvent.pointerDown(element, { pointerType: 'touch' })
    fireEvent.click(element, { clientX: seconds * 20, detail: 1 })
  }
}

describe('a new clip in a lane', () => {
  it('comes from a double-click on an empty stretch of a lane that plays MIDI, from the bar under it, four bars long', () => {
    // Arrange
    const { make, lane } = mount()

    // Act: 6.5 s, in bar 4, which starts at 6 s.
    doubleClick(lane('track-keys'), 6.5)

    // Assert
    expect(make).toHaveBeenCalledExactlyOnceWith('track-keys', {
      startFrame: 288_000,
      frames: 384_000,
    })
  })

  it('comes from two taps of a finger there', () => {
    // Arrange
    const { make, lane } = mount()

    // Act
    twoTaps(lane('track-keys'), 6.5)

    // Assert
    expect(make).toHaveBeenCalledExactlyOnceWith('track-keys', {
      startFrame: 288_000,
      frames: 384_000,
    })
  })

  it('is not made on a lane of audio, nor while the song cannot be edited', () => {
    // Arrange
    const audio = mount()
    doubleClick(audio.lane('track-1'), 6.5)
    cleanup()
    const locked = mount(false)

    // Act
    doubleClick(locked.lane('track-keys'), 6.5)

    // Assert
    expect(audio.make).not.toHaveBeenCalled()
    expect(locked.make).not.toHaveBeenCalled()
  })

  it('says why when the lane has no room for a bar there', () => {
    // Arrange
    const { make, lane } = mount()

    // Act: 0.5 s, in bar 1, the keys clip a second in.
    doubleClick(lane('track-keys'), 0.5)

    // Assert
    expect(make).not.toHaveBeenCalled()
    expect(
      screen
        .getAllByRole('status')
        .some((status) => status.textContent === STUDIO_NEW_CLIP_NO_ROOM),
    ).toBe(true)
  })
})

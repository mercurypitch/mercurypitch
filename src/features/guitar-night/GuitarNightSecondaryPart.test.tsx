import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import { GUITAR_NIGHT_SECONDARY_COLLAPSED_STORAGE_KEY, GUITAR_NIGHT_SECONDARY_LAYOUT_STORAGE_KEY, GuitarNightSecondaryPart, } from './GuitarNightSecondaryPart'
import type { SheetLane } from './sheet/sheet-model'

function note(startBeat: number, fret: number, stringIndex = 0): GuitarNote {
  return {
    id: `n${startBeat}-${stringIndex}`,
    midi: 64,
    noteName: 'E4',
    stringIndex,
    fret,
    startBeat,
    duration: 1,
    targetFreq: 329.63,
  }
}

function lane(overrides: Partial<SheetLane> = {}): SheetLane {
  return {
    trackId: 'track-rhythm',
    trackName: 'Rhythm guitar',
    kind: 'authored',
    instrument: 'guitar',
    tuning: DEFAULT_GUITAR_TUNING,
    notes: [note(0, 3), note(2, 5, 1), note(40, 7)],
    outOfRangeNotes: 0,
    ...overrides,
  }
}

describe('GuitarNightSecondaryPart', () => {
  beforeEach(() => {
    localStorage.removeItem(GUITAR_NIGHT_SECONDARY_LAYOUT_STORAGE_KEY)
    localStorage.removeItem(GUITAR_NIGHT_SECONDARY_COLLAPSED_STORAGE_KEY)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('names the part it is showing', () => {
    render(() => (
      <GuitarNightSecondaryPart lane={() => lane()} playheadBeat={() => 0} />
    ))
    expect(screen.getByText('Rhythm guitar')).toBeInTheDocument()
  })

  it('shows only the notes inside its window', () => {
    const { container } = render(() => (
      <GuitarNightSecondaryPart lane={() => lane()} playheadBeat={() => 0} />
    ))
    const frets = Array.from(container.querySelectorAll('b')).map(
      (node) => node.textContent,
    )
    expect(frets).toContain('3')
    expect(frets).toContain('5')
    // Beat 40 is far outside a six beat window.
    expect(frets).not.toContain('7')
  })

  it('draws one line per string of the part its own neck has', () => {
    const { container } = render(() => (
      <GuitarNightSecondaryPart lane={() => lane()} playheadBeat={() => 0} />
    ))
    expect(
      container.querySelectorAll('[data-secondary-part-string]'),
    ).toHaveLength(6)
  })

  it('reads out what is sounding, for anyone not looking at it', () => {
    render(() => (
      <GuitarNightSecondaryPart lane={() => lane()} playheadBeat={() => 0.5} />
    ))
    expect(
      screen.getByLabelText('Rhythm guitar, 1 note sounding'),
    ).toBeInTheDocument()
  })

  it('says when the part is resting', () => {
    render(() => (
      <GuitarNightSecondaryPart lane={() => lane()} playheadBeat={() => 3.5} />
    ))
    expect(screen.getByLabelText('Rhythm guitar, resting')).toBeInTheDocument()
  })

  it('is a display when there is nothing to swap to', () => {
    render(() => (
      <GuitarNightSecondaryPart lane={() => lane()} playheadBeat={() => 0} />
    ))
    expect(
      screen.queryByRole('button', { name: 'Read Rhythm guitar instead' }),
    ).toBeNull()
    expect(
      screen.getByLabelText('Rhythm guitar, 1 note sounding'),
    ).toHaveAttribute('role', 'img')
  })

  it('offers dedicated move, reset, and horizontal resize controls', () => {
    render(() => (
      <GuitarNightSecondaryPart lane={() => lane()} playheadBeat={() => 0} />
    ))

    expect(
      screen.getByRole('button', { name: 'Move Rhythm guitar preview' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Reset Rhythm guitar preview position',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('slider', {
        name: 'Resize Rhythm guitar preview horizontally',
      }),
    ).toHaveAttribute('aria-orientation', 'horizontal')
  })

  it('reads that part instead when tapped', () => {
    const onSwap = vi.fn()
    render(() => (
      <GuitarNightSecondaryPart
        lane={() => lane()}
        playheadBeat={() => 0}
        onSwap={onSwap}
      />
    ))

    const swap = screen.getByRole('button', {
      name: 'Read Rhythm guitar instead',
    })
    fireEvent.click(swap)
    expect(onSwap).toHaveBeenCalledWith('track-rhythm')
  })

  it('follows the playhead it was given', () => {
    const [beat, setBeat] = [() => 0, vi.fn()]
    void setBeat
    const { container } = render(() => (
      <GuitarNightSecondaryPart lane={() => lane()} playheadBeat={beat} />
    ))
    const first = container.querySelector('b')
    expect(first?.getAttribute('style')).toContain('left:')
  })

  it('moves and resizes from the keyboard, then persists that layout', async () => {
    const rect = (width: number, height: number): DOMRect =>
      ({
        x: 0,
        y: 0,
        top: 0,
        right: width,
        bottom: height,
        left: 0,
        width,
        height,
        toJSON: () => ({}),
      }) as DOMRect
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const element = this as HTMLElement
        if (element.hasAttribute('data-secondary-boundary')) {
          return rect(900, 540)
        }
        if (
          element.getAttribute('data-testid') === 'guitar-night-secondary-part'
        ) {
          const width = Number.parseFloat(element.style.width)
          return rect(Number.isFinite(width) && width > 0 ? width : 300, 140)
        }
        return rect(0, 0)
      })
    let boundary: HTMLDivElement | undefined
    render(() => (
      <div ref={boundary} data-secondary-boundary>
        <GuitarNightSecondaryPart
          lane={() => lane()}
          playheadBeat={() => 0}
          layoutKey={() => 'highway'}
          boundaryElement={() => boundary}
        />
      </div>
    ))

    const panel = screen.getByTestId('guitar-night-secondary-part')
    await waitFor(() =>
      expect(panel).toHaveAttribute('data-positioned', 'true'),
    )
    fireEvent.keyDown(
      screen.getByRole('button', { name: 'Move Rhythm guitar preview' }),
      { key: 'ArrowRight' },
    )
    fireEvent.keyDown(
      screen.getByRole('slider', {
        name: 'Resize Rhythm guitar preview horizontally',
      }),
      { key: 'ArrowRight' },
    )

    await waitFor(() =>
      expect(panel.getAttribute('style')).toContain('width: 324px'),
    )
    const stored = JSON.parse(
      localStorage.getItem(GUITAR_NIGHT_SECONDARY_LAYOUT_STORAGE_KEY) ?? '{}',
    ) as Record<string, { width: number; xRatio: number }>
    expect(stored.highway?.width).toBe(324)
    expect(stored.highway?.xRatio).toBeGreaterThan(0)
    rectSpy.mockRestore()
  })

  it('moves away when an opened stage picker enters its protected area', async () => {
    const rect = (
      x: number,
      y: number,
      width: number,
      height: number,
    ): DOMRect =>
      ({
        x,
        y,
        top: y,
        right: x + width,
        bottom: y + height,
        left: x,
        width,
        height,
        toJSON: () => ({}),
      }) as DOMRect
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this.hasAttribute('data-secondary-boundary')) {
          return rect(0, 0, 900, 540)
        }
        if (this.hasAttribute('data-stage-picker')) {
          return this.closest('details')?.hasAttribute('open') === true
            ? rect(12, 268, 340, 260)
            : rect(0, 0, 0, 0)
        }
        if (
          this.getAttribute('data-testid') === 'guitar-night-secondary-part'
        ) {
          const width = Number.parseFloat(this.style.width)
          return rect(0, 0, Number.isFinite(width) ? width : 300, 140)
        }
        return rect(0, 0, 0, 0)
      },
    )

    let boundary: HTMLDivElement | undefined
    const [pickerOpen, setPickerOpen] = createSignal(false)
    render(() => (
      <div ref={boundary} data-secondary-boundary>
        <details open={pickerOpen()}>
          <summary>Camera</summary>
          <div data-stage-picker data-guitar-night-secondary-protected />
        </details>
        <GuitarNightSecondaryPart
          lane={() => lane()}
          playheadBeat={() => 0}
          boundaryElement={() => boundary}
        />
      </div>
    ))

    const panel = screen.getByTestId('guitar-night-secondary-part')
    await waitFor(() =>
      expect(panel.style.transform).toBe('translate3d(12px, 388px, 0)'),
    )
    setPickerOpen(true)
    await waitFor(() =>
      expect(panel.style.transform).not.toBe('translate3d(12px, 388px, 0)'),
    )
  })

  it('uses the open space between separately protected header faceplates', async () => {
    const rect = (
      x: number,
      y: number,
      width: number,
      height: number,
    ): DOMRect =>
      ({
        x,
        y,
        top: y,
        right: x + width,
        bottom: y + height,
        left: x,
        width,
        height,
        toJSON: () => ({}),
      }) as DOMRect
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this.hasAttribute('data-secondary-boundary')) {
          return rect(100, 50, 1_400, 640)
        }
        if (this.hasAttribute('data-guide-faceplate')) {
          return rect(112, 62, 300, 54)
        }
        if (this.hasAttribute('data-tool-faceplate')) {
          return rect(1_200, 62, 288, 54)
        }
        if (this.hasAttribute('data-hidden-picker')) {
          return rect(900, 62, 400, 280)
        }
        if (
          this.getAttribute('data-testid') === 'guitar-night-secondary-part'
        ) {
          const width = Number.parseFloat(this.style.width)
          return rect(100, 50, Number.isFinite(width) ? width : 300, 140)
        }
        return rect(0, 0, 0, 0)
      },
    )
    localStorage.setItem(
      GUITAR_NIGHT_SECONDARY_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        highway: { xRatio: 0.401_960_784, yRatio: 0, width: 560 },
      }),
    )

    let boundary: HTMLDivElement | undefined
    render(() => (
      <div ref={boundary} data-secondary-boundary>
        <div data-guide-faceplate data-guitar-night-secondary-protected />
        <div data-tool-faceplate data-guitar-night-secondary-protected />
        <details>
          <summary>Camera</summary>
          <div data-hidden-picker data-guitar-night-secondary-protected />
        </details>
        <GuitarNightSecondaryPart
          lane={() => lane()}
          playheadBeat={() => 0}
          layoutKey={() => 'highway'}
          boundaryElement={() => boundary}
        />
      </div>
    ))

    const panel = screen.getByTestId('guitar-night-secondary-part')
    await waitFor(() =>
      expect(panel.style.transform).toBe('translate3d(340px, 12px, 0)'),
    )
    expect(panel.style.width).toBe('560px')
  })

  it('lets a small-screen player collapse the dock and remembers the choice', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(
        (query: string) =>
          ({
            matches: query === '(max-width: 720px)',
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          }) as MediaQueryList,
      ),
    )

    const first = render(() => (
      <GuitarNightSecondaryPart
        lane={() => lane()}
        playheadBeat={() => 0}
        layoutKey={() => 'highway'}
      />
    ))
    const panel = screen.getByTestId('guitar-night-secondary-part')
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Collapse Rhythm guitar preview',
      }),
    )
    expect(panel).toHaveAttribute('data-collapsed', 'true')
    expect(screen.queryByLabelText('Rhythm guitar, 1 note sounding')).toBeNull()
    first.unmount()

    render(() => (
      <GuitarNightSecondaryPart
        lane={() => lane()}
        playheadBeat={() => 0}
        layoutKey={() => 'highway'}
      />
    ))
    expect(
      await screen.findByRole('button', {
        name: 'Expand Rhythm guitar preview',
      }),
    ).toBeInTheDocument()
  })
})

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { DEFAULT_BASS_TUNING, DEFAULT_GUITAR_TUNING, } from '@/lib/guitar/instrument-tuning'
import { GuitarNightSheetView } from './GuitarNightSheetView'
import type { SheetLane } from './sheet-model'

function note(startBeat: number, fret = 3): GuitarNote {
  return {
    id: `n${startBeat}`,
    midi: 64,
    noteName: 'E4',
    stringIndex: 0,
    fret,
    startBeat,
    duration: 1,
    targetFreq: 329.63,
  }
}

function lane(overrides: Partial<SheetLane> = {}): SheetLane {
  return {
    trackId: 'track-1',
    trackName: 'Lead guitar',
    kind: 'authored',
    instrument: 'guitar',
    tuning: DEFAULT_GUITAR_TUNING,
    notes: [note(0)],
    outOfRangeNotes: 0,
    ...overrides,
  }
}

/** jsdom reports every box as zero; the sheet is a layout, so give it one. */
function sizeThePage(width: number, height: number): () => void {
  const originals = {
    width: Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientWidth',
    ),
    height: Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientHeight',
    ),
  }
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => width,
  })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => height,
  })
  return () => {
    if (originals.width !== undefined) {
      Object.defineProperty(
        HTMLElement.prototype,
        'clientWidth',
        originals.width,
      )
    }
    if (originals.height !== undefined) {
      Object.defineProperty(
        HTMLElement.prototype,
        'clientHeight',
        originals.height,
      )
    }
  }
}

/** jsdom has no 2d context, so stand one in and watch what gets drawn. */
function stubCanvas(): { calls: string[] } {
  const calls: string[] = []
  const context = new Proxy(
    {},
    {
      get: (_target, property: string) => {
        if (property === 'setTransform' || property === 'canvas') {
          return () => undefined
        }
        return (...args: unknown[]) => {
          calls.push(`${property}:${args.join(',')}`)
        }
      },
      set: (_target, property: string, value: unknown) => {
        calls.push(`${property}=${String(value)}`)
        return true
      },
    },
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    (() => context) as unknown as typeof HTMLCanvasElement.prototype.getContext,
  )
  return { calls }
}

describe('GuitarNightSheetView', () => {
  let painted: { calls: string[] }

  beforeEach(() => {
    painted = stubCanvas()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('says so when there is nothing to read', () => {
    render(() => (
      <GuitarNightSheetView lanes={() => []} playheadBeat={() => 0} />
    ))
    expect(screen.getByText('Attach a tab to read it here.')).toBeTruthy()
    expect(screen.queryByTestId('guitar-night-sheet-playhead')).toBeNull()
  })

  it('takes the empty note it was given', () => {
    render(() => (
      <GuitarNightSheetView
        lanes={() => []}
        playheadBeat={() => 0}
        emptyNote="Nothing loaded yet."
      />
    ))
    expect(screen.getByText('Nothing loaded yet.')).toBeTruthy()
  })

  it('names every part it draws', () => {
    render(() => (
      <GuitarNightSheetView
        lanes={() => [
          lane(),
          lane({
            trackId: 'track-2',
            trackName: 'Bass',
            tuning: DEFAULT_BASS_TUNING,
          }),
        ]}
        playheadBeat={() => 0}
      />
    ))
    expect(screen.getByText('Lead guitar')).toBeTruthy()
    expect(screen.getByText('Bass')).toBeTruthy()
  })

  it('leaves the names as plain text when nothing can be scored', () => {
    render(() => (
      <GuitarNightSheetView lanes={() => [lane()]} playheadBeat={() => 0} />
    ))
    expect(screen.queryByRole('button', { name: /Lead guitar/ })).toBeNull()
  })

  it('offers each name as a way to score that part', () => {
    const onSelectTrack = vi.fn()
    render(() => (
      <GuitarNightSheetView
        lanes={() => [lane(), lane({ trackId: 'track-2', trackName: 'Bass' })]}
        playheadBeat={() => 0}
        scoredTrackId={() => 'track-1'}
        onSelectTrack={onSelectTrack}
      />
    ))

    const scored = screen.getByRole('button', { name: 'Lead guitar' })
    const other = screen.getByRole('button', { name: 'Bass' })
    expect(scored.getAttribute('aria-pressed')).toBe('true')
    expect(other.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(other)
    expect(onSelectTrack).toHaveBeenCalledWith('track-2')
  })

  it('keeps an authored percussion lane readable but never scoreable', () => {
    const onSelectTrack = vi.fn()
    render(() => (
      <GuitarNightSheetView
        lanes={() => [
          lane({
            trackId: 'track-drums',
            trackName: 'Drum kit',
            content: 'percussion',
            scoreable: false,
            notes: [],
            percussionHits: [
              {
                id: 'midi-t2-e1',
                gmKey: 36,
                startBeat: 0,
                velocity: 117,
              },
              {
                id: 'midi-t2-e2',
                gmKey: 49,
                startBeat: 1,
                velocity: 91,
              },
            ],
            droppedPercussionHits: 1,
          }),
        ]}
        playheadBeat={() => 0}
        scoredTrackId={() => 'track-lead'}
        onSelectTrack={onSelectTrack}
      />
    ))

    expect(
      screen.getByText(
        'Drum kit — 2 authored hits · 1 unmapped · reference only',
      ),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Drum kit/ })).toBeNull()
    expect(onSelectTrack).not.toHaveBeenCalled()
  })

  it('says how many notes a part could not reach', () => {
    render(() => (
      <GuitarNightSheetView
        lanes={() => [lane({ outOfRangeNotes: 1 })]}
        playheadBeat={() => 0}
      />
    ))
    expect(screen.getByText('Lead guitar — 1 note off this neck')).toBeTruthy()
  })

  it('counts more than one unreachable note in the plural', () => {
    render(() => (
      <GuitarNightSheetView
        lanes={() => [lane({ outOfRangeNotes: 3 })]}
        playheadBeat={() => 0}
      />
    ))
    expect(screen.getByText('Lead guitar — 3 notes off this neck')).toBeTruthy()
  })

  it('draws one canvas per system on the page', () => {
    const restore = sizeThePage(800, 400)
    try {
      const { container } = render(() => (
        <GuitarNightSheetView
          lanes={() => [lane({ notes: [note(0), note(20)] })]}
          playheadBeat={() => 0}
        />
      ))
      const systems = container.querySelectorAll('[data-system]')
      expect(systems.length).toBeGreaterThan(0)
      expect(container.querySelectorAll('canvas')).toHaveLength(systems.length)
    } finally {
      restore()
    }
  })

  it('lays the page out in the time signature the score is in', () => {
    const restore = sizeThePage(800, 400)
    try {
      // Twelve beats is four bars of 3/4 but only three of common time. At
      // three bars to a system that is two rows against one, which is what
      // tells the two layouts apart from outside.
      const inThree = render(() => (
        <GuitarNightSheetView
          lanes={() => [lane({ notes: [note(0), note(11)] })]}
          playheadBeat={() => 0}
          timeSignatures={() => [{ beat: 0, numerator: 3, denominator: 4 }]}
        />
      ))
      const inFour = render(() => (
        <GuitarNightSheetView
          lanes={() => [lane({ notes: [note(0), note(11)] })]}
          playheadBeat={() => 0}
        />
      ))
      expect(
        inThree.container.querySelectorAll('[data-system]').length,
      ).toBeGreaterThan(
        inFour.container.querySelectorAll('[data-system]').length,
      )
    } finally {
      restore()
    }
  })

  it('builds only the systems near the reader, not the whole score', () => {
    const restore = sizeThePage(800, 400)
    try {
      const { container } = render(() => (
        <GuitarNightSheetView
          lanes={() => [lane({ notes: [note(0), note(236)] })]}
          playheadBeat={() => 0}
        />
      ))
      // 240 beats at three four-four bars a system is twenty systems of music.
      const built = container.querySelectorAll('[data-system]')
      expect(built.length).toBeGreaterThan(0)
      expect(built.length).toBeLessThan(10)
    } finally {
      restore()
    }
  })

  it('puts the playhead where the beat falls', () => {
    const restore = sizeThePage(800, 400)
    try {
      const { container } = render(() => (
        <GuitarNightSheetView
          lanes={() => [lane({ notes: [note(0), note(11)] })]}
          playheadBeat={() => 6}
        />
      ))
      const playhead = container.querySelector<HTMLElement>(
        '[data-testid="guitar-night-sheet-playhead"]',
      )
      // Halfway through the first system of three four-four bars.
      expect(playhead?.style.transform).toBe('translate3d(413px, 0px, 0)')
    } finally {
      restore()
    }
  })

  it('paints read-only A/B fragments on each system they cross', () => {
    const restore = sizeThePage(800, 1_000)
    try {
      const { container } = render(() => (
        <GuitarNightSheetView
          lanes={() => [lane({ notes: [note(0), note(20)] })]}
          playheadBeat={() => 9}
          loopStart={() => 6}
          loopEnd={() => 18}
          loopActive={() => true}
        />
      ))

      expect(
        screen.getByRole('group', {
          name: /Score sheet.*Loop from beat 7 to beat 19, repeating/,
        }),
      ).toBeVisible()
      expect(
        container.querySelectorAll(
          '[data-testid^="guitar-night-sheet-loop-region-"]',
        ),
      ).toHaveLength(2)
      expect(
        screen.getByTestId('guitar-night-sheet-loop-marker-a'),
      ).toHaveAttribute('data-active', 'true')
      expect(
        screen.getByTestId('guitar-night-sheet-loop-marker-b'),
      ).toHaveAttribute('data-active', 'true')
    } finally {
      restore()
    }
  })

  it('makes each notation row a keyboard and pointer seek surface', () => {
    const restore = sizeThePage(800, 400)
    const onSeekBeat = vi.fn()
    const onSeekStart = vi.fn()
    const onSeekEnd = vi.fn()
    try {
      render(() => (
        <GuitarNightSheetView
          lanes={() => [lane({ notes: [note(0), note(11)] })]}
          playheadBeat={() => 0}
          onSeekBeat={onSeekBeat}
          onSeekStart={onSeekStart}
          onSeekEnd={onSeekEnd}
        />
      ))

      const row = screen.getByRole('slider', {
        name: 'Playback position in score row 1',
      })
      fireEvent.pointerDown(row)
      fireEvent.input(row, { target: { value: '5' } })
      fireEvent.pointerUp(row)

      expect(onSeekStart).toHaveBeenCalledOnce()
      expect(onSeekBeat).toHaveBeenCalledWith(5)
      expect(onSeekEnd).toHaveBeenCalledOnce()
    } finally {
      restore()
    }
  })

  it('ends an active row seek when virtualization removes its owner', () => {
    const restore = sizeThePage(800, 400)
    const onSeekStart = vi.fn()
    const onSeekEnd = vi.fn()
    try {
      const view = render(() => (
        <GuitarNightSheetView
          lanes={() => [lane({ notes: [note(0), note(11)] })]}
          playheadBeat={() => 0}
          onSeekBeat={() => undefined}
          onSeekStart={onSeekStart}
          onSeekEnd={onSeekEnd}
        />
      ))

      fireEvent.pointerDown(
        screen.getByRole('slider', {
          name: 'Playback position in score row 1',
        }),
      )
      expect(onSeekStart).toHaveBeenCalledOnce()
      expect(onSeekEnd).not.toHaveBeenCalled()

      view.unmount()
      expect(onSeekEnd).toHaveBeenCalledOnce()
    } finally {
      restore()
    }
  })

  it('publishes a sheet loop-boundary edit only when the gesture settles', () => {
    const restore = sizeThePage(800, 1_000)
    const onMoveLoopMark = vi.fn()
    const onCommitLoopMark = vi.fn()
    try {
      render(() => (
        <GuitarNightSheetView
          lanes={() => [lane({ notes: [note(0), note(20)] })]}
          playheadBeat={() => 9}
          loopStart={() => 6}
          loopEnd={() => 18}
          loopActive={() => true}
          onMoveLoopMark={onMoveLoopMark}
          onCommitLoopMark={onCommitLoopMark}
        />
      ))

      const marker = screen.getByRole('slider', {
        name: 'Loop start marker on sheet',
      })
      expect(marker).toHaveAttribute('aria-valuetext', 'Beat 7')

      fireEvent.keyDown(marker, { key: 'ArrowRight' })
      expect(onMoveLoopMark).not.toHaveBeenCalled()
      fireEvent.keyUp(marker, { key: 'ArrowRight' })

      expect(onMoveLoopMark).toHaveBeenCalledWith('A', 7)
      expect(onCommitLoopMark).toHaveBeenCalledWith('A')
    } finally {
      restore()
    }
  })

  it('keeps an active loop-boundary edit when virtualization removes its row', () => {
    const restore = sizeThePage(800, 1_000)
    const onMoveLoopMark = vi.fn()
    const onCommitLoopMark = vi.fn()
    try {
      const view = render(() => (
        <GuitarNightSheetView
          lanes={() => [lane({ notes: [note(0), note(20)] })]}
          playheadBeat={() => 9}
          loopStart={() => 6}
          loopEnd={() => 18}
          loopActive={() => true}
          onMoveLoopMark={onMoveLoopMark}
          onCommitLoopMark={onCommitLoopMark}
        />
      ))

      fireEvent.keyDown(
        screen.getByRole('slider', {
          name: 'Loop start marker on sheet',
        }),
        { key: 'ArrowRight' },
      )
      expect(onCommitLoopMark).not.toHaveBeenCalled()

      view.unmount()
      expect(onMoveLoopMark).toHaveBeenCalledWith('A', 7)
      expect(onCommitLoopMark).toHaveBeenCalledWith('A')
    } finally {
      restore()
    }
  })

  it('paints the music onto the canvas it mounted', () => {
    const restore = sizeThePage(800, 400)
    try {
      render(() => (
        <GuitarNightSheetView
          lanes={() => [lane({ notes: [note(0, 7)] })]}
          playheadBeat={() => 0}
        />
      ))
      expect(painted.calls).toContain('fillText:7,26,28')
      expect(
        painted.calls.filter((call) => call.startsWith('stroke')),
      ).not.toHaveLength(0)
    } finally {
      restore()
    }
  })

  it('scrolls a system back into view once the music has left the page', () => {
    const restore = sizeThePage(800, 200)
    let scrollTop = 0
    const original = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollTop',
    )
    Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value
      },
    })

    try {
      render(() => (
        <GuitarNightSheetView
          lanes={() => [lane({ notes: [note(0), note(236)] })]}
          playheadBeat={() => 200}
        />
      ))
      expect(scrollTop).toBeGreaterThan(0)
    } finally {
      if (original !== undefined) {
        Object.defineProperty(HTMLElement.prototype, 'scrollTop', original)
      }
      restore()
    }
  })

  it('preserves a manual scroll while the playhead stays in the same system', () => {
    const restore = sizeThePage(800, 200)
    const [playheadBeat, setPlayheadBeat] = createSignal(0)
    let scrollTop = 0
    const original = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollTop',
    )
    Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value
      },
    })

    try {
      render(() => (
        <GuitarNightSheetView
          lanes={() => [lane({ notes: [note(0), note(236)] })]}
          playheadBeat={playheadBeat}
        />
      ))
      const scroller = screen.getByTestId('guitar-night-sheet-scroll')
      scrollTop = 80
      fireEvent.scroll(scroller)
      setPlayheadBeat(5)

      expect(scrollTop).toBe(80)
    } finally {
      if (original !== undefined) {
        Object.defineProperty(HTMLElement.prototype, 'scrollTop', original)
      }
      restore()
    }
  })
  describe('magnification', () => {
    beforeEach(() => {
      localStorage.removeItem('guitar-night-sheet-zoom-v1')
    })

    it('spends the row on fewer bars instead of widening the page', () => {
      const restore = sizeThePage(900, 600)
      try {
        render(() => (
          <GuitarNightSheetView
            lanes={() => [
              lane({ notes: [note(0), note(4), note(8), note(12)] }),
            ]}
            playheadBeat={() => 0}
          />
        ))
        const page = screen.getByTestId('guitar-night-sheet-page')
        // The suite stubs ResizeObserver with a no-op, so nothing re-measures
        // after jsdom lays the page out. A scroll is the cheapest honest
        // nudge; a real browser gets this from the observer.
        fireEvent.scroll(screen.getByTestId('guitar-night-sheet-scroll'))
        // Rows are virtualized, so count them from the page rather than from
        // what happens to be mounted.
        const rowCount = (): number => {
          const row = document.querySelector('[data-system]') as HTMLElement
          return Math.round(
            parseFloat(page.style.height) / parseFloat(row.style.height),
          )
        }
        const beforeRows = rowCount()
        const beforeHeight = parseFloat(page.style.height)

        fireEvent.input(screen.getByTestId('guitar-night-sheet-zoom'), {
          target: { value: '2' },
        })

        // The page never grows sideways -- that would be a side-scroll, not a
        // magnification -- so it carries no width of its own at all.
        expect(page.style.width).toBe('')
        // The rows re-broke: fewer bars fit each one, so the same music needs
        // more of them, and each is taller than it was.
        expect(rowCount()).toBeGreaterThan(beforeRows)
        expect(parseFloat(page.style.height)).toBeGreaterThan(beforeHeight)
      } finally {
        restore()
      }
    })

    it('paints the notation itself larger, not just the layout', () => {
      const restore = sizeThePage(900, 600)
      try {
        render(() => (
          <GuitarNightSheetView lanes={() => [lane()]} playheadBeat={() => 0} />
        ))
        const fontOf = (calls: string[]): number => {
          const set = calls.filter((call) => call.startsWith('font=')).at(-1)
          return set === undefined ? 0 : parseFloat(set.slice('font='.length))
        }
        const before = fontOf(painted.calls)
        expect(before).toBeGreaterThan(0)

        painted.calls.length = 0
        fireEvent.input(screen.getByTestId('guitar-night-sheet-zoom'), {
          target: { value: '2' },
        })
        // The fret numbers are what the reader came for.
        expect(fontOf(painted.calls)).toBeGreaterThan(before)
      } finally {
        restore()
      }
    })

    it('zooms on ctrl+wheel and leaves a plain wheel to scroll', () => {
      const restore = sizeThePage(900, 600)
      try {
        render(() => (
          <GuitarNightSheetView lanes={() => [lane()]} playheadBeat={() => 0} />
        ))
        const sheet = screen.getByTestId('guitar-night-sheet')
        const scroll = screen.getByTestId('guitar-night-sheet-scroll')
        expect(sheet.style.getPropertyValue('--sheet-zoom')).toBe('1')

        scroll.dispatchEvent(
          new WheelEvent('wheel', { deltaY: -240, bubbles: true }),
        )
        expect(sheet.style.getPropertyValue('--sheet-zoom')).toBe('1')

        scroll.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY: -240,
            ctrlKey: true,
            bubbles: true,
          }),
        )
        expect(
          Number(sheet.style.getPropertyValue('--sheet-zoom')),
        ).toBeGreaterThan(1)
      } finally {
        restore()
      }
    })

    it('returns to 100% from the readout', () => {
      const restore = sizeThePage(900, 600)
      try {
        render(() => (
          <GuitarNightSheetView lanes={() => [lane()]} playheadBeat={() => 0} />
        ))
        const sheet = screen.getByTestId('guitar-night-sheet')
        fireEvent.input(screen.getByTestId('guitar-night-sheet-zoom'), {
          target: { value: '1.5' },
        })
        expect(sheet.style.getPropertyValue('--sheet-zoom')).toBe('1.5')

        fireEvent.click(screen.getByTestId('guitar-night-sheet-zoom-reset'))
        expect(sheet.style.getPropertyValue('--sheet-zoom')).toBe('1')
      } finally {
        restore()
      }
    })

    it('clamps to the readable range', () => {
      const restore = sizeThePage(900, 600)
      try {
        render(() => (
          <GuitarNightSheetView lanes={() => [lane()]} playheadBeat={() => 0} />
        ))
        const sheet = screen.getByTestId('guitar-night-sheet')
        const scroll = screen.getByTestId('guitar-night-sheet-scroll')
        for (let step = 0; step < 40; step += 1) {
          scroll.dispatchEvent(
            new WheelEvent('wheel', {
              deltaY: -240,
              ctrlKey: true,
              bubbles: true,
            }),
          )
        }
        expect(Number(sheet.style.getPropertyValue('--sheet-zoom'))).toBe(3)
      } finally {
        restore()
      }
    })
  })
})

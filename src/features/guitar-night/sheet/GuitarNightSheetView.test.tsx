import { fireEvent, render, screen } from '@solidjs/testing-library'
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
      set: () => true,
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
})

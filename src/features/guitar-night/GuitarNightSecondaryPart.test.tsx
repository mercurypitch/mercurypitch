import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import { GuitarNightSecondaryPart } from './GuitarNightSecondaryPart'
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
      container.querySelectorAll('[class*="secondaryPartString"]'),
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
    expect(screen.queryByRole('button')).toBeNull()
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
})

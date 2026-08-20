import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuitarNightOnRecording } from './GuitarNightOnRecording'
import type { GuitarNightReferenceSummary } from './reference-port'

afterEach(cleanup)

const SCORES: readonly GuitarNightReferenceSummary[] = [
  {
    songId: 'gsong-a',
    title: 'Wrathchild',
    trackCount: 6,
    importedAt: Date.UTC(2026, 7, 1),
  },
  {
    songId: 'gsong-b',
    title: 'Aces High',
    trackCount: 4,
    importedAt: Date.UTC(2026, 7, 2),
  },
]

function mount(
  overrides: Partial<Parameters<typeof GuitarNightOnRecording>[0]> = {},
) {
  const onRead = vi.fn()
  const onPlaceByHand = vi.fn()
  const onStop = vi.fn()
  render(() => (
    <GuitarNightOnRecording
      scores={SCORES}
      reading={null}
      offer={true}
      status={null}
      fallback={null}
      placingByHand={false}
      onRead={onRead}
      onPlaceByHand={onPlaceByHand}
      onStop={onStop}
      {...overrides}
    />
  ))
  return { onRead, onPlaceByHand, onStop }
}

describe('GuitarNightOnRecording', () => {
  it('offers every score that could be hung on the recording', () => {
    mount()
    expect(screen.getByRole('button', { name: 'Wrathchild' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Aces High' })).toBeTruthy()
  })

  it('names the score the reader picked', () => {
    const { onRead } = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Aces High' }))
    expect(onRead).toHaveBeenCalledWith('gsong-b')
  })

  it('offers nothing against a written tab, which is not a recording', () => {
    mount({ offer: false })
    expect(screen.queryByRole('button', { name: 'Wrathchild' })).toBeNull()
  })

  it('offers nothing when the library is empty', () => {
    mount({ scores: [] })
    expect(
      screen.queryByRole('group', {
        name: 'Read a written part on this recording',
      }),
    ).toBeNull()
  })

  it('says how much of the part the recording confirmed', () => {
    mount({
      reading: {
        matchedFraction: 0.82,
        driftSeconds: 0.2,
        placedBy: 'measured',
      },
    })
    expect(screen.getByText(/82% of it was heard here/)).toBeTruthy()
  })

  it('says out loud when the two drift apart', () => {
    mount({
      reading: {
        matchedFraction: 0.9,
        driftSeconds: 11.4,
        placedBy: 'measured',
      },
    })
    expect(screen.getByText(/drift 11.4s apart end to end/)).toBeTruthy()
  })

  it('leaves a drift too small to chase unsaid', () => {
    mount({
      reading: {
        matchedFraction: 0.9,
        driftSeconds: 0.4,
        placedBy: 'measured',
      },
    })
    expect(screen.queryByText(/drift/)).toBeNull()
  })

  it('offers the way back to what was heard', () => {
    const { onStop } = mount({
      reading: { matchedFraction: 0.9, driftSeconds: 0, placedBy: 'measured' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Back to what was heard' }),
    )
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('stops offering once a part is being read', () => {
    mount({
      reading: { matchedFraction: 0.9, driftSeconds: 0, placedBy: 'measured' },
    })
    expect(screen.queryByRole('button', { name: 'Wrathchild' })).toBeNull()
  })

  it('claims no measurement for a part placed by hand', () => {
    mount({
      reading: { driftSeconds: 0, placedBy: 'hand' },
    })
    expect(screen.getByText(/placed on this recording by hand/)).toBeTruthy()
    expect(screen.queryByText(/heard here/)).toBeNull()
  })

  it('still says out loud when a hand-placed part drifts', () => {
    mount({
      reading: { driftSeconds: 4.2, placedBy: 'hand' },
    })
    expect(screen.getByText(/drift 4.2s apart end to end/)).toBeTruthy()
  })

  it('offers to place by hand the score the matcher refused', () => {
    const { onPlaceByHand } = mount({
      status: 'Check it is the same song.',
      fallback: { songId: 'gsong-a', title: 'Wrathchild' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Place Wrathchild by hand instead' }),
    )
    expect(onPlaceByHand).toHaveBeenCalledWith('gsong-a')
  })

  it('sends the reader to the room once a part is claimed by hand', () => {
    mount({ placingByHand: true })
    expect(screen.getByText(/mark the part.s first note/)).toBeTruthy()
  })

  it('says what went wrong instead of failing silently', () => {
    mount({ status: 'Check it is the same song.' })
    expect(screen.getByText('Check it is the same song.')).toBeTruthy()
  })
})

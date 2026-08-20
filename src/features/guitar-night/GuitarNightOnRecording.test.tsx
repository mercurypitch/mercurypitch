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
  const onStop = vi.fn()
  render(() => (
    <GuitarNightOnRecording
      scores={SCORES}
      reading={null}
      offer={true}
      status={null}
      onRead={onRead}
      onStop={onStop}
      {...overrides}
    />
  ))
  return { onRead, onStop }
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
    mount({ reading: { matchedFraction: 0.82, driftSeconds: 0.2 } })
    expect(screen.getByText(/82% of it was heard here/)).toBeTruthy()
  })

  it('says out loud when the two drift apart', () => {
    mount({ reading: { matchedFraction: 0.9, driftSeconds: 11.4 } })
    expect(screen.getByText(/drift 11.4s apart end to end/)).toBeTruthy()
  })

  it('leaves a drift too small to chase unsaid', () => {
    mount({ reading: { matchedFraction: 0.9, driftSeconds: 0.4 } })
    expect(screen.queryByText(/drift/)).toBeNull()
  })

  it('offers the way back to what was heard', () => {
    const { onStop } = mount({
      reading: { matchedFraction: 0.9, driftSeconds: 0 },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Back to what was heard' }),
    )
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('stops offering once a part is being read', () => {
    mount({ reading: { matchedFraction: 0.9, driftSeconds: 0 } })
    expect(screen.queryByRole('button', { name: 'Wrathchild' })).toBeNull()
  })

  it('says what went wrong instead of failing silently', () => {
    mount({ status: 'Check it is the same song.' })
    expect(screen.getByText('Check it is the same song.')).toBeTruthy()
  })
})

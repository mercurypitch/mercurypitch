import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuitarNightHandSync } from './GuitarNightHandSync'

afterEach(cleanup)

const format = (seconds: number) => `${seconds.toFixed(1)}s`

function mount(
  overrides: Partial<Parameters<typeof GuitarNightHandSync>[0]> = {},
) {
  const onMarkFirst = vi.fn()
  const onMarkLast = vi.fn()
  const onClear = vi.fn()
  const onNudge = vi.fn()
  render(() => (
    <GuitarNightHandSync
      partName="Bass"
      firstMarkSeconds={null}
      lastMarkSeconds={null}
      placed={false}
      format={format}
      onMarkFirst={onMarkFirst}
      onMarkLast={onMarkLast}
      onClear={onClear}
      onNudge={onNudge}
      {...overrides}
    />
  ))
  return { onMarkFirst, onMarkLast, onClear, onNudge }
}

describe('GuitarNightHandSync', () => {
  it('names the part being placed', () => {
    mount()
    expect(
      screen.getByRole('group', { name: 'Place Bass on this recording' }),
    ).toBeTruthy()
  })

  it('marks the first note where the recording is', () => {
    const { onMarkFirst } = mount()
    fireEvent.click(screen.getByRole('button', { name: 'First note here' }))
    expect(onMarkFirst).toHaveBeenCalledTimes(1)
  })

  it('marks the last note where the recording is', () => {
    const { onMarkLast } = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Last note here' }))
    expect(onMarkLast).toHaveBeenCalledTimes(1)
  })

  it('says nothing is marked before anything is', () => {
    mount()
    expect(screen.getByText('Nothing marked yet.')).toBeTruthy()
  })

  it('reads back the moments that were marked', () => {
    mount({ firstMarkSeconds: 3, lastMarkSeconds: 46.5 })
    expect(screen.getByText(/First note at 3.0s/)).toBeTruthy()
    expect(screen.getByText(/last note at 46.5s/)).toBeTruthy()
  })

  it('says which end is still missing', () => {
    mount({ firstMarkSeconds: 3 })
    expect(screen.getByText(/last note not marked/)).toBeTruthy()
  })

  it('says so when only the last note was marked', () => {
    mount({ lastMarkSeconds: 46.5 })
    expect(screen.getByText(/First note not marked/)).toBeTruthy()
  })

  it('shows a marked end as set', () => {
    mount({ firstMarkSeconds: 3 })
    expect(
      screen.getByRole('button', { name: 'First note here' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: 'Last note here' }),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('offers nothing to clear until something is marked', () => {
    mount()
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
  })

  it('clears the marks', () => {
    const { onClear } = mount({ firstMarkSeconds: 3 })
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('offers no nudge before the part is on the recording', () => {
    mount({ firstMarkSeconds: 3 })
    expect(screen.queryByRole('group', { name: 'Nudge the tab' })).toBeNull()
  })

  it('nudges the tab earlier and later', () => {
    const { onNudge } = mount({ firstMarkSeconds: 3, placed: true })
    fireEvent.click(
      screen.getByRole('button', { name: 'Move the tab 0.1 seconds earlier' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Move the tab 0.5 seconds later' }),
    )
    expect(onNudge).toHaveBeenNthCalledWith(1, -0.1)
    expect(onNudge).toHaveBeenNthCalledWith(2, 0.5)
  })
})

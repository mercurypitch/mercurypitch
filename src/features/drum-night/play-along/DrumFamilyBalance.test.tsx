// ============================================================
// Drum family balance tests — controlled selection, levels, and mute intent
// ============================================================

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DrumFamilyBalanceProps, DrumFamilyBalanceRow, } from './DrumFamilyBalance'
import { DrumFamilyBalance } from './DrumFamilyBalance'

afterEach(cleanup)

const FAMILIES: readonly DrumFamilyBalanceRow[] = [
  { id: 'kick', label: 'Kick', level: 0.92, muted: false },
  { id: 'snare', label: 'Snare', level: 0.76, muted: false },
  { id: 'hats', label: 'Hats', level: 0.64, muted: true },
  { id: 'toms', label: 'Toms', level: 0.58, muted: false },
  { id: 'cymbals', label: 'Cymbals', level: 0.48, muted: false },
]

function familyBalanceProps(
  overrides: Partial<DrumFamilyBalanceProps> = {},
): DrumFamilyBalanceProps {
  return {
    families: FAMILIES,
    selectedFamily: 'snare',
    onFamilySelect: vi.fn(),
    onFamilyLevelChange: vi.fn(),
    onFamilyMuteChange: vi.fn(),
    ...overrides,
  }
}

describe('DrumFamilyBalance', () => {
  it('identifies the authored-only scope and exposes every kit family', () => {
    render(() => <DrumFamilyBalance {...familyBalanceProps()} />)

    expect(screen.getByRole('heading', { name: 'Kit pieces' })).toBeVisible()
    expect(
      screen.getByText('Authored kit only · your live hits stay independent.'),
    ).toBeVisible()

    const rail = screen.getByRole('group', { name: 'Kit pieces' })
    expect(within(rail).getAllByRole('button')).toHaveLength(5)
    expect(within(rail).getByRole('button', { name: /Snare/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      within(rail).getByRole('button', { name: /Hats/ }),
    ).toHaveTextContent('Muted')
    expect(screen.getByText('Selected piece')).toBeVisible()
  })

  it('reports selection, shared level, and mute changes for the selected family', () => {
    const onFamilySelect = vi.fn()
    const onFamilyLevelChange = vi.fn()
    const onFamilyMuteChange = vi.fn()
    render(() => (
      <DrumFamilyBalance
        {...familyBalanceProps({
          onFamilySelect,
          onFamilyLevelChange,
          onFamilyMuteChange,
        })}
      />
    ))

    fireEvent.click(screen.getByRole('button', { name: /Cymbals/ }))
    expect(onFamilySelect).toHaveBeenCalledWith('cymbals')

    const slider = screen.getByRole('slider', {
      name: 'Snare authored level',
    })
    expect(slider).toHaveValue('76')
    expect(
      screen.getByRole('status', {
        name: 'Snare authored level value',
      }),
    ).toHaveTextContent('76%')

    fireEvent.input(slider, { target: { value: '53' } })
    expect(onFamilyLevelChange).toHaveBeenCalledWith('snare', 0.53)

    fireEvent.click(screen.getByRole('button', { name: 'Mute authored Snare' }))
    expect(onFamilyMuteChange).toHaveBeenCalledWith('snare', true)
  })
})

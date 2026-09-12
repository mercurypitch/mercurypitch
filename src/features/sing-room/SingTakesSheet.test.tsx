// ============================================================
// Your takes — the list, its order, and its one control
// ============================================================
//
// The rows themselves are `take-list`'s and are proved there. What is here is
// what the sheet does with them: newest first, a Remove that names the take
// it would forget, and an empty state that says so rather than drawing an
// empty box.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SingTake } from '@/stores/sing-takes-store'
import { SingTakesSheet } from './SingTakesSheet'

afterEach(cleanup)

function take(overrides: Partial<SingTake> = {}): SingTake {
  return {
    id: 'take-1',
    startedAt: new Date(2026, 8, 2, 9, 38).getTime(),
    endedAt: new Date(2026, 8, 2, 9, 41).getTime(),
    durationMs: 182_000,
    takeNumber: 1,
    lowNote: 'D3',
    highNote: 'A4',
    heldWithinCents: 12,
    ...overrides,
  }
}

function mount(takes: SingTake[]) {
  const handlers = { close: vi.fn(), onRemove: vi.fn() }
  render(() => (
    <SingTakesSheet
      isOpen
      takes={() => takes}
      close={handlers.close}
      onRemove={handlers.onRemove}
    />
  ))
  return handlers
}

describe('the takes sheet', () => {
  it('says so when nothing has been kept', () => {
    mount([])
    expect(screen.getByTestId('sing-takes-empty').textContent).toBe(
      'No takes kept yet.',
    )
    expect(screen.queryByTestId('sing-takes-row')).toBeNull()
  })

  it('lists the kept takes newest first', () => {
    mount([
      take({ id: 'older', endedAt: new Date(2026, 7, 25, 9, 13).getTime() }),
      take({ id: 'newer' }),
    ])
    const rows = screen.getAllByTestId('sing-takes-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('2 September 2026')
    expect(rows[1].textContent).toContain('25 August 2026')
  })

  it('says the four things a take is', () => {
    mount([take()])
    const text = screen.getByTestId('sing-takes-row').textContent ?? ''
    expect(text).toContain('2 September 2026, 9:41')
    expect(text).toContain('3 min')
    expect(text).toContain('D3 to A4')
    expect(text).toContain('held within 12 cents')
  })

  it('removes the row it was pressed on, by the store id', () => {
    const handlers = mount([take({ id: 'older' }), take({ id: 'newer' })])
    fireEvent.click(screen.getAllByTestId('sing-takes-remove')[0])
    // Newest first: the first Remove is the newest take's.
    expect(handlers.onRemove).toHaveBeenCalledWith('newer')
  })

  it('names what each Remove would forget', () => {
    mount([take()])
    expect(
      screen.getByTestId('sing-takes-remove').getAttribute('aria-label'),
    ).toBe('Remove the take from 2 September 2026, 9:41')
  })

  it('draws nothing at all while it is closed', () => {
    const handlers = { close: vi.fn(), onRemove: vi.fn() }
    render(() => (
      <SingTakesSheet
        isOpen={false}
        takes={() => [take()]}
        close={handlers.close}
        onRemove={handlers.onRemove}
      />
    ))
    expect(screen.queryByTestId('sing-takes-sheet')).toBeNull()
  })
})

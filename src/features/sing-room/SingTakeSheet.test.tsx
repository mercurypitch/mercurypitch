// ============================================================
// Your take — what the end card says, and what it promises
// ============================================================
//
// The numbers are `take-summary`'s and are proved there. What is here is the
// card's own three promises: four counts and the same four as one sentence,
// a comparison that only appears once there is something to compare against,
// and two answers of which exactly one writes anything.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SingTake } from '@/stores/sing-takes-store'
import { historyLine, SingTakeSheet } from './SingTakeSheet'
import type { TakeSummary } from './take-summary'

afterEach(cleanup)

const SUMMARY: TakeSummary = {
  durationMs: 182_000,
  voicedMs: 120_000,
  takeNumber: 2,
  range: { lowMidi: 50, highMidi: 69, lowLabel: 'D3', highLabel: 'A4' },
  heldWithinCents: 12,
}

const PREVIOUS: SingTake = {
  id: 'earlier',
  startedAt: new Date(2026, 7, 25, 9, 10).getTime(),
  endedAt: new Date(2026, 7, 25, 9, 13).getTime(),
  durationMs: 180_000,
  takeNumber: 1,
  lowNote: 'D3',
  highNote: 'G4',
  heldWithinCents: 18,
}

function mount(over: Partial<Parameters<typeof SingTakeSheet>[0]> = {}) {
  const handlers = {
    onKeep: vi.fn(),
    onDismiss: vi.fn(),
    onDiscard: vi.fn(),
  }
  render(() => (
    <SingTakeSheet
      isOpen
      summary={SUMMARY}
      previous={null}
      startedAt={new Date(2026, 8, 2, 9, 38).getTime()}
      endedAt={new Date(2026, 8, 2, 9, 41).getTime()}
      roomLabel="Retro Analog Studio"
      {...handlers}
      {...over}
    />
  ))
  return handlers
}

describe('the four counts', () => {
  it('says duration, takes, range and cents', () => {
    mount()
    expect(screen.getByTestId('sing-stat-duration').textContent).toBe('3 min')
    expect(screen.getByTestId('sing-stat-takes').textContent).toBe('2 takes')
    expect(screen.getByTestId('sing-stat-range').textContent).toBe('D3 to A4')
    expect(screen.getByTestId('sing-stat-cents').textContent).toBe('12 cents')
  })

  it('repeats them as the one sentence, in the mock’s own words', () => {
    mount()
    expect(screen.getByTestId('sing-take-sentence').textContent).toBe(
      '3 min · 2 takes · D3 to A4 touched · held within 12 cents',
    )
  })

  it('never says a total, a grade or a verdict', () => {
    mount()
    const text = screen.getByTestId('sing-take-sheet').textContent ?? ''
    expect(text).not.toMatch(/score|%|grade|total|well done/iu)
  })

  it('names the room and dates the take', () => {
    mount()
    const text = screen.getByTestId('sing-take-sheet').textContent ?? ''
    expect(text).toContain('Retro Analog Studio')
    expect(text).toContain('2 September 2026')
  })
})

describe('against your own history', () => {
  it('is absent on a first ever take', () => {
    mount()
    expect(screen.queryByTestId('sing-take-history')).toBeNull()
  })

  it('reads the last kept take once there is one', () => {
    mount({ previous: PREVIOUS })
    expect(screen.getByTestId('sing-take-history').textContent).toBe(
      'Against your own history: on 25 August 2026 you touched D3 to G4 and held within 18 cents.',
    )
  })

  it('drops the range clause when the earlier take had none', () => {
    expect(historyLine({ ...PREVIOUS, lowNote: null, highNote: null })).toBe(
      'Against your own history: on 25 August 2026 you held within 18 cents.',
    )
  })

  it('is nothing at all, rather than an empty sentence, with no history', () => {
    expect(historyLine(null)).toBeNull()
  })
})

describe('the two answers', () => {
  it('keeps on Keep', () => {
    const handlers = mount()
    fireEvent.click(screen.getByTestId('sing-take-keep'))
    expect(handlers.onKeep).toHaveBeenCalledTimes(1)
    expect(handlers.onDiscard).not.toHaveBeenCalled()
  })

  it('discards on Discard', () => {
    const handlers = mount()
    fireEvent.click(screen.getByTestId('sing-take-discard'))
    expect(handlers.onDiscard).toHaveBeenCalledTimes(1)
    expect(handlers.onKeep).not.toHaveBeenCalled()
  })

  it('treats being dismissed as keeping, never as a silent discard', () => {
    // Back, a drag, leaving the room. None of them is somebody choosing to
    // throw four numbers away, and the take used to vanish on all three.
    const handlers = mount()
    // The kit's backdrop is the dialog's own parent; a tap on it closes.
    const backdrop = screen.getByRole('dialog').parentElement
    expect(backdrop).not.toBeNull()
    fireEvent.click(backdrop!)
    expect(handlers.onDismiss).toHaveBeenCalledTimes(1)
    expect(handlers.onDiscard).not.toHaveBeenCalled()
  })

  it('says what Keep does with it, in the footer', () => {
    mount()
    const text = screen.getByTestId('sing-take-sheet').textContent ?? ''
    expect(text).toContain('Keep stores it on this phone.')
    // R6: the promise is kept by saying where the take goes, not by naming
    // the thing that does not happen to it. "Nothing uploaded" reads as a
    // denial, and a denial is what puts the idea there in the first place.
    expect(text).not.toContain('uploaded')
  })

  it('shows nothing at all when there is no summary', () => {
    mount({ summary: null })
    expect(screen.queryByTestId('sing-take-sheet')).toBeNull()
  })
})

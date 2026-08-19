// Guitar Night Learn shelf tests protect its focused, silent setlist interaction.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal, Show } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarFirstWinProgressV1 } from './first-win-progress'
import { GuitarNightLearnShelf } from './GuitarNightLearnShelf'

const PROGRESS: GuitarFirstWinProgressV1 = {
  schemaVersion: 1,
  flowVersion: 'first-win-v1',
  configVersion: 'test',
  status: 'completed',
  currentStepId: 'one-string-tab',
  completedStepIds: ['open-string-groove', 'one-string-tab'],
  attemptsByStep: {},
  bestAbsoluteTimingMsByStep: {},
  lastInputKind: 'touch',
  tuningMidiHighToLow: [64, 59, 55, 50, 45, 40],
  handedness: null,
  tabFamiliarity: null,
  completedAt: new Date(0).toISOString(),
  skippedAt: null,
}

describe('GuitarNightLearnShelf', () => {
  afterEach(cleanup)

  it('focuses the returning activity and names replay truthfully', () => {
    render(() => (
      <GuitarNightLearnShelf
        firstWinProgress={PROGRESS}
        tuningLabel="6-string guitar"
        initialFocus="note-hunt"
        onFirstSteps={vi.fn()}
        onActivity={vi.fn()}
        onClose={vi.fn()}
      />
    ))

    expect(screen.getByRole('button', { name: /Note Hunt/ })).toHaveFocus()
    expect(
      screen.getByRole('button', { name: /Replay first steps/ }),
    ).toHaveTextContent('Replay')
  })

  it('closes on Escape and traps focus at either edge', () => {
    const onClose = vi.fn()
    render(() => (
      <GuitarNightLearnShelf
        firstWinProgress={{ ...PROGRESS, status: 'in-progress' }}
        tuningLabel="6-string guitar"
        onFirstSteps={vi.fn()}
        onActivity={vi.fn()}
        onClose={onClose}
      />
    ))

    const close = screen.getByRole('button', { name: 'Close' })
    const shapeWalk = screen.getByRole('button', { name: /Shape Walk/ })
    close.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(shapeWalk).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('locks background scrolling and restores the host on cleanup', () => {
    document.body.style.overflow = 'clip'
    const result = render(() => (
      <div data-testid="guitar-night-shell" style={{ overflow: 'auto' }}>
        <GuitarNightLearnShelf
          firstWinProgress={PROGRESS}
          tuningLabel="6-string guitar"
          onFirstSteps={vi.fn()}
          onActivity={vi.fn()}
          onClose={vi.fn()}
        />
      </div>
    ))
    const shell = screen.getByTestId('guitar-night-shell')

    expect(document.body.style.overflow).toBe('hidden')
    expect(shell.style.overflow).toBe('hidden')

    result.unmount()
    expect(document.body.style.overflow).toBe('clip')
    expect(shell.style.overflow).toBe('auto')
    document.body.style.overflow = ''
  })

  it('puts the reading back where the reader left it', () => {
    // The shelf used to save and restore `shell.scrollTop`, and the shell has
    // never been the scroller — it is `overflow: clip`, and before that it
    // only ever held the scaled backdrop's bleed, so the position it
    // preserved was always 0. `.main` is the box that actually moves.
    //
    // jsdom does no layout and reports `scrollTop` as 0 forever, so the
    // property is replaced with a plain writable one: what is under test is
    // the snapshot-and-restore, not the browser's scrolling.
    const [open, setOpen] = createSignal(false)
    render(() => (
      <div data-testid="guitar-night-shell">
        <main>
          <Show when={open()}>
            <GuitarNightLearnShelf
              firstWinProgress={PROGRESS}
              tuningLabel="6-string guitar"
              onFirstSteps={vi.fn()}
              onActivity={vi.fn()}
              onClose={vi.fn()}
            />
          </Show>
        </main>
      </div>
    ))
    const region = screen
      .getByTestId('guitar-night-shell')
      .querySelector('main')
    expect(region).not.toBeNull()
    Object.defineProperty(region, 'scrollTop', {
      configurable: true,
      value: 0,
      writable: true,
    })

    // The reader is 240px down the column when they open Learn.
    region!.scrollTop = 240
    setOpen(true)
    expect(screen.getByTestId('guitar-night-learn-shelf')).toBeTruthy()

    // Something moves it while the shelf owns the screen.
    region!.scrollTop = 0

    setOpen(false)
    expect(region?.scrollTop).toBe(240)
    document.body.style.overflow = ''
  })

  it('offers every rebuilt activity without placeholder copy', () => {
    const onActivity = vi.fn()
    render(() => (
      <GuitarNightLearnShelf
        firstWinProgress={PROGRESS}
        tuningLabel="Drop D"
        onFirstSteps={vi.fn()}
        onActivity={onActivity}
        onClose={vi.fn()}
      />
    ))

    fireEvent.click(screen.getByRole('button', { name: /Hear & Find/ }))
    expect(onActivity).toHaveBeenCalledWith('hear-find')
    expect(screen.getByText(/keeps Drop D/)).toBeInTheDocument()
    expect(screen.queryByText(/will join/)).not.toBeInTheDocument()
  })
})

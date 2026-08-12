// Guitar Night Learn shelf tests protect its focused, silent setlist interaction.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
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
        initialFocus="note-hunt"
        onFirstSteps={vi.fn()}
        onNoteHunt={vi.fn()}
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
        onFirstSteps={vi.fn()}
        onNoteHunt={vi.fn()}
        onClose={onClose}
      />
    ))

    const close = screen.getByRole('button', { name: 'Close' })
    const noteHunt = screen.getByRole('button', { name: /Note Hunt/ })
    close.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(noteHunt).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('locks background scrolling and restores the host on cleanup', () => {
    document.body.style.overflow = 'clip'
    const result = render(() => (
      <div data-testid="guitar-night-shell" style={{ overflow: 'auto' }}>
        <GuitarNightLearnShelf
          firstWinProgress={PROGRESS}
          onFirstSteps={vi.fn()}
          onNoteHunt={vi.fn()}
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
})

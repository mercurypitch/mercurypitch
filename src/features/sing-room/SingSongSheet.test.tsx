// ============================================================
// The song chip's three answers
// ============================================================
//
// R1: the chip used to go straight back to the picker, so a melody could be
// changed and never played again or put down. The sheet is the tap menu that
// replaced it — a long press is not discoverable.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SingSongSheet } from './SingSongSheet'

afterEach(cleanup)

function mount() {
  const handlers = {
    close: vi.fn(),
    onPlayAgain: vi.fn(),
    onChangeSong: vi.fn(),
    onRemove: vi.fn(),
  }
  render(() => (
    <SingSongSheet isOpen songName={() => 'Twinkle'} {...handlers} />
  ))
  return handlers
}

describe('the song sheet', () => {
  it('names the melody it is about', () => {
    mount()
    expect(screen.getByTestId('sing-song-sheet').textContent).toContain(
      'Twinkle',
    )
  })

  it('offers exactly Play again, Change song and Remove', () => {
    mount()
    const labels = [
      ...screen.getByTestId('sing-song-sheet').querySelectorAll('button'),
    ].map((button) => button.textContent?.trim())
    expect(labels).toEqual(['Play again', 'Change song', 'Remove'])
  })

  it('calls each of them once, and nothing else', () => {
    for (const [testId, key] of [
      ['sing-song-play-again', 'onPlayAgain'],
      ['sing-song-change', 'onChangeSong'],
      ['sing-song-remove', 'onRemove'],
    ] as const) {
      const handlers = mount()
      fireEvent.click(screen.getByTestId(testId))
      expect(handlers[key], testId).toHaveBeenCalledTimes(1)
      for (const other of ['onPlayAgain', 'onChangeSong', 'onRemove'] as const) {
        if (other !== key) expect(handlers[other], other).not.toHaveBeenCalled()
      }
      cleanup()
    }
  })

  it('draws nothing while it is closed', () => {
    const handlers = {
      close: vi.fn(),
      onPlayAgain: vi.fn(),
      onChangeSong: vi.fn(),
      onRemove: vi.fn(),
    }
    render(() => (
      <SingSongSheet isOpen={false} songName={() => 'Twinkle'} {...handlers} />
    ))
    expect(screen.queryByTestId('sing-song-sheet')).toBeNull()
  })
})

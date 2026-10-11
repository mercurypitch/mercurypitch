// ============================================================
// The exercise row: the last exercise, or the way to all of them
// ============================================================
//
// What the row prints comes from stored signals (the last exercise, the
// note Long note opens on, its best there), each read once per module
// graph. Every case seeds storage and loads the row fresh.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import styles from './premium-exercises.module.css'

interface Seed {
  last?: string
  /** The note Long note opens on, as MIDI. */
  note?: number
  /** The best on that note, in seconds held in the band. */
  best?: number
}

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
})

afterEach(() => {
  cleanup()
  document.head.querySelector('style[data-row-css]')?.remove()
})

/**
 * The module's shipped CSS in the document, its class names as the test
 * build writes them, so jsdom's computed style reads the real rules. The
 * test build names any class asked for, so a dotted word in a comment is
 * renamed too, which changes nothing.
 */
function withRowCss(): void {
  const css = readFileSync(
    'src/features/premium-exercises/premium-exercises.module.css',
    'utf8',
  ).replace(/\.([a-zA-Z][\w-]*)/gu, (_, name: string) => `.${styles[name]}`)
  const sheet = document.createElement('style')
  sheet.dataset.rowCss = ''
  sheet.textContent = css
  document.head.append(sheet)
}

const opacity = (testId: string): number =>
  Number(window.getComputedStyle(screen.getByTestId(testId)).opacity || '1')

async function mountRow(seed: Seed = {}, disabled = false) {
  if (seed.last !== undefined) {
    localStorage.setItem('mp_last_exercise', seed.last)
  }
  if (seed.note !== undefined) {
    localStorage.setItem(
      'pitchperfect_long_note_lantern_note',
      JSON.stringify(seed.note),
    )
  }
  if (seed.note !== undefined && seed.best !== undefined) {
    localStorage.setItem(
      'pitchperfect_long_note_lantern_bests',
      JSON.stringify({
        [seed.note]: { inBandSeconds: seed.best, steadiness: 80, at: 1 },
      }),
    )
  }
  const { ExerciseRow } = await import('./ExerciseRow')
  const onOpen = vi.fn()
  const onBrowse = vi.fn()
  render(() => (
    <ExerciseRow disabled={disabled} onOpen={onOpen} onBrowse={onBrowse} />
  ))
  return { onOpen, onBrowse }
}

const testIds = (): string[] =>
  Array.from(
    screen.getByTestId('sing-exercise-row').querySelectorAll('button'),
  ).map((button) => button.dataset.testid ?? '')

describe('with no exercise opened yet', () => {
  it('is one pill, "Exercises", that opens the picker', async () => {
    const { onBrowse, onOpen } = await mountRow()

    expect(testIds()).toEqual(['sing-exercise-browse'])
    const browse = screen.getByRole('button', { name: 'Exercises' })
    fireEvent.click(browse)

    expect(onBrowse).toHaveBeenCalledTimes(1)
    expect(onOpen).not.toHaveBeenCalled()
  })
})

describe('with a last exercise', () => {
  const lastRun = { last: 'long-note-lantern', note: 57, best: 9.46 }

  it('is the pill and the door beside it', async () => {
    await mountRow(lastRun)

    expect(testIds()).toEqual(['sing-exercise-pill', 'sing-exercise-door'])
    expect(
      screen.getByTestId('sing-exercise-door').getAttribute('aria-label'),
    ).toBe('All exercises')
  })

  it('prints the exercise, its note and its best, floored as the card does', async () => {
    await mountRow(lastRun)

    expect(screen.getByTestId('sing-exercise-title').textContent).toBe(
      'Long note · A3',
    )
    expect(screen.getByTestId('sing-exercise-best').textContent).toBe(
      'Best 9.4 s',
    )
  })

  it('has a name that starts with the words on it, then says what it does', async () => {
    await mountRow(lastRun)

    expect(
      screen.getByTestId('sing-exercise-pill').getAttribute('aria-label'),
    ).toBe('Long note · A3. Best 9.4 s. Open your last exercise')
  })

  it('drops the second line when that note has no best', async () => {
    await mountRow({ last: 'long-note-lantern', note: 57 })

    expect(screen.queryByTestId('sing-exercise-best')).toBeNull()
    expect(
      screen.getByTestId('sing-exercise-pill').getAttribute('aria-label'),
    ).toBe('Long note · A3. Open your last exercise')
  })

  it('prints the name alone before Long note has a note', async () => {
    await mountRow({ last: 'long-note-lantern' })

    expect(screen.getByTestId('sing-exercise-title').textContent).toBe(
      'Long note',
    )
  })

  it('opens the exercise by its id from the pill, and the picker from the door', async () => {
    const { onOpen, onBrowse } = await mountRow(lastRun)

    fireEvent.click(screen.getByTestId('sing-exercise-pill'))
    expect(onOpen.mock.calls).toEqual([['long-note-lantern']])
    expect(onBrowse).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('sing-exercise-door'))
    expect(onBrowse).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})

describe('before the room has arrived', () => {
  it('is drawn, marked aria-disabled, and takes no tap', async () => {
    const { onOpen, onBrowse } = await mountRow(
      { last: 'long-note-lantern', note: 57 },
      true,
    )

    const pill = screen.getByTestId('sing-exercise-pill')
    const door = screen.getByTestId('sing-exercise-door')
    fireEvent.click(pill)
    fireEvent.click(door)

    expect([
      pill.getAttribute('aria-disabled'),
      door.getAttribute('aria-disabled'),
    ]).toEqual(['true', 'true'])
    expect(onOpen).not.toHaveBeenCalled()
    expect(onBrowse).not.toHaveBeenCalled()
  })

  it('keeps the lone "Exercises" pill quiet too', async () => {
    const { onBrowse } = await mountRow({}, true)

    const browse = screen.getByTestId('sing-exercise-browse')
    fireEvent.click(browse)

    expect(browse.getAttribute('aria-disabled')).toBe('true')
    expect(onBrowse).not.toHaveBeenCalled()
  })

  // A tap that does nothing on a control that looks live reads as broken
  // (docs/agent/MISTAKES.md, "A control that refuses silently").
  it('dims what it will not open', async () => {
    withRowCss()
    await mountRow({ last: 'long-note-lantern', note: 57 }, true)

    expect([
      opacity('sing-exercise-pill'),
      opacity('sing-exercise-door'),
    ]).toEqual([0.5, 0.5])
  })

  it('dims the lone "Exercises" pill too', async () => {
    withRowCss()
    await mountRow({}, true)

    expect(opacity('sing-exercise-browse')).toBe(0.5)
  })

  it('is at full strength once the room is there', async () => {
    withRowCss()
    await mountRow({ last: 'long-note-lantern', note: 57 })

    expect([
      opacity('sing-exercise-pill'),
      opacity('sing-exercise-door'),
    ]).toEqual([1, 1])
  })
})

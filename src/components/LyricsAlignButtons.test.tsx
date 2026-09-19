// ============================================================
// LyricsAlignButtons tests
// ============================================================
//
// Three glyph-only buttons are the easiest control in the world to ship
// as three anonymous divs: nothing says which is on, nothing answers to a
// keyboard, and a screen reader hears "button, button, button". So the
// contract is asserted here -- a named radio group, exactly one checked,
// one tab stop, and arrows that move the choice rather than just the
// focus.
//
// jsdom applies no CSS Modules, so the touch sizes are read off the
// stylesheet; the real boxes are measured in jam-stage-layout.spec.ts.

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LyricsAlignButtons } from '@/components/LyricsAlignButtons'
import type { LyricsAlign } from '@/components/LyricsAlignIcon'

function renderButtons(initial: LyricsAlign = 'center') {
  const [align, setAlign] = createSignal<LyricsAlign>(initial)
  const utils = render(() => (
    <LyricsAlignButtons lyricsAlign={align} setLyricsAlign={setAlign} />
  ))
  const radio = (name: string) =>
    utils.getByRole('radio', { name }) as HTMLButtonElement
  return {
    ...utils,
    align,
    setAlign,
    group: utils.getByRole('radiogroup', { name: 'Lyric alignment' }),
    left: radio('Left'),
    middle: radio('Middle'),
    right: radio('Right'),
  }
}

describe('the lyric alignment buttons', () => {
  afterEach(cleanup)

  it('offers the three alignments as one named group, in reading order', () => {
    const { group } = renderButtons()
    const radios = [...group.querySelectorAll('[role="radio"]')]
    expect(radios.map((radio) => radio.getAttribute('aria-label'))).toEqual([
      'Left',
      'Middle',
      'Right',
    ])
    // Glyph-only buttons: the tooltip is the only name a mouse user gets.
    expect(radios.map((radio) => radio.getAttribute('title'))).toEqual([
      'Left',
      'Middle',
      'Right',
    ])
  })

  it('checks exactly the alignment it was given', () => {
    const { left, middle, right } = renderButtons('right')
    expect(left).toHaveAttribute('aria-checked', 'false')
    expect(middle).toHaveAttribute('aria-checked', 'false')
    expect(right).toHaveAttribute('aria-checked', 'true')
  })

  it('follows the signal when something else changes the alignment', () => {
    const { left, middle, setAlign } = renderButtons('center')
    setAlign('left')
    expect(left).toHaveAttribute('aria-checked', 'true')
    expect(middle).toHaveAttribute('aria-checked', 'false')
  })

  it('selects the button that was clicked', () => {
    const { align, left, middle } = renderButtons('center')
    fireEvent.click(left)
    expect(align()).toBe('left')
    expect(left).toHaveAttribute('aria-checked', 'true')
    expect(middle).toHaveAttribute('aria-checked', 'false')
  })

  it('keeps one tab stop, and it is the button that is on', () => {
    const { left, middle, right } = renderButtons('center')
    expect([left.tabIndex, middle.tabIndex, right.tabIndex]).toEqual([
      -1, 0, -1,
    ])
    fireEvent.click(right)
    expect([left.tabIndex, middle.tabIndex, right.tabIndex]).toEqual([
      -1, -1, 0,
    ])
  })

  it('moves the choice and the focus together on an arrow', () => {
    const { align, left, middle, right } = renderButtons('center')
    middle.focus()
    fireEvent.keyDown(middle, { key: 'ArrowRight' })
    expect(align()).toBe('right')
    expect(document.activeElement).toBe(right)

    fireEvent.keyDown(right, { key: 'ArrowLeft' })
    fireEvent.keyDown(middle, { key: 'ArrowLeft' })
    expect(align()).toBe('left')
    expect(document.activeElement).toBe(left)
  })

  it('reads Up and Down as the same two directions', () => {
    const { align, middle, right } = renderButtons('center')
    middle.focus()
    fireEvent.keyDown(middle, { key: 'ArrowDown' })
    expect(align()).toBe('right')
    fireEvent.keyDown(right, { key: 'ArrowUp' })
    expect(align()).toBe('center')
  })

  it('wraps at both ends instead of going dead', () => {
    const { align, left, right } = renderButtons('right')
    right.focus()
    fireEvent.keyDown(right, { key: 'ArrowRight' })
    expect(align()).toBe('left')
    expect(document.activeElement).toBe(left)
    fireEvent.keyDown(left, { key: 'ArrowLeft' })
    expect(align()).toBe('right')
  })

  it('jumps to either end on Home and End', () => {
    const { align, left, middle } = renderButtons('center')
    middle.focus()
    fireEvent.keyDown(middle, { key: 'End' })
    expect(align()).toBe('right')
    fireEvent.keyDown(left, { key: 'Home' })
    expect(align()).toBe('left')
  })

  it('keeps a key it used away from the shortcuts listening on window', () => {
    // Home seeks the song to its start and Up/Down change playback speed,
    // for anything that lets the key through. Choosing an alignment is
    // not a request to restart the song.
    const onWindowKey = vi.fn()
    window.addEventListener('keydown', onWindowKey)
    try {
      const { middle } = renderButtons('center')
      middle.focus()
      const used = fireEvent.keyDown(middle, { key: 'Home' })
      expect(used).toBe(false) // preventDefault was called
      expect(onWindowKey).not.toHaveBeenCalled()

      // A key that is not ours goes through untouched.
      fireEvent.keyDown(middle, { key: 'k' })
      expect(onWindowKey).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('keydown', onWindowKey)
    }
  })

  it('leaves a modified arrow to whoever owns the chord', () => {
    const { align, middle } = renderButtons('center')
    middle.focus()
    fireEvent.keyDown(middle, { key: 'ArrowRight', altKey: true })
    expect(align()).toBe('center')
  })
})

describe('how big the buttons are', () => {
  const css = readFileSync(
    'src/components/LyricsAlignButtons.module.css',
    'utf8',
  )

  it('never goes under the 24px pointer floor', () => {
    expect(css).toMatch(
      /\.btn \{[^}]*width: var\(--lyrics-align-target, 24px\)/,
    )
    expect(css).toMatch(
      /\.btn \{[^}]*height: var\(--lyrics-align-target, 24px\)/,
    )
  })

  it('grows to a thumb on a coarse pointer', () => {
    const coarse = css.slice(css.indexOf('@media (pointer: coarse)'))
    expect(coarse).toContain('width: var(--lyrics-align-target, 40px)')
    expect(coarse).toContain('height: var(--lyrics-align-target, 40px)')
  })
})

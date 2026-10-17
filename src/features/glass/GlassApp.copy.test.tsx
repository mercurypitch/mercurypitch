// ============================================================
// Break Glass: the words a visitor reads carry no em dash
// ============================================================
//
// The 0.9.19 clips showed the coach line as "You're 69¢ sharp — ease off."
// The product voice keeps em dashes out of visible copy, so the page and the
// text a visitor shares use a full stop, a colon or a comma instead. A cell
// that holds only "—" is a placeholder for a reading not taken yet, and stays.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { glassShareText } from './card-renderer'
import { GlassApp } from './GlassApp'

afterEach(cleanup)

const EM_DASH = '—'
const READ_ALOUD = ['aria-label', 'title', 'alt', 'placeholder']

/** Every visible string or read-aloud attribute that carries an em dash. */
function emDashes(root: HTMLElement): string[] {
  const found: string[] = []
  const carries = (text: string) =>
    text.includes(EM_DASH) && text.trim() !== EM_DASH
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? ''
    if (carries(text)) found.push(text.trim())
  }
  for (const element of root.querySelectorAll('*')) {
    for (const name of READ_ALOUD) {
      const value = element.getAttribute(name)
      if (value !== null && carries(value)) found.push(`${name}: ${value}`)
    }
  }
  return found
}

describe('Break Glass copy', () => {
  it('reads without an em dash on the landing page and in How it works', () => {
    const { container } = render(() => <GlassApp />)

    expect(container.textContent).toContain(
      'until the glass gives way. Real fracture physics, live in your browser.',
    )
    expect(emDashes(container)).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'How it works' }))

    expect(container.textContent).toContain(
      'bursts into a hundred shards. Persistence always wins.',
    )
    expect(emDashes(container)).toEqual([])
  })

  it('shares without an em dash, whether or not the glass broke', () => {
    expect(glassShareText(true)).toBe(
      'I shattered it: https://mercurypitch.com/glass?utm_source=glasscard&utm_medium=share',
    )
    expect(glassShareText(false)).toBe(
      'The glass is still standing… for now. https://mercurypitch.com/glass?utm_source=glasscard&utm_medium=share',
    )
  })
})

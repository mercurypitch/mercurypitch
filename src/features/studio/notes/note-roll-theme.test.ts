// Studio note roll theme tests — every colour the roll reads is declared on the editor, from the Studio's tokens and the lane's colour, and the light theme declares again each colour that differs from the dark one; and a read gives each colour its custom property's value and the editor's font, leaving no probe behind.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readStudioRollTheme, STUDIO_ROLL_THEME_TOKENS, } from './note-roll-theme'

const CSS = readFileSync(
  resolve(__dirname, 'StudioNoteEditor.module.css'),
  'utf8',
)

/** The declarations of the first rule whose selector is exactly `selector`. */
function block(selector: string): string {
  const start = CSS.indexOf(`${selector} {`)
  return start < 0 ? '' : CSS.slice(start, CSS.indexOf('}', start))
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

describe('the editor’s stylesheet', () => {
  it('declares every colour the roll reads on the editor', () => {
    const editor = block('.editor')

    for (const token of STUDIO_ROLL_THEME_TOKENS)
      expect(editor, token).toContain(`${token}:`)
  })

  it('builds the notes from the lane’s colour and the playhead from the Studio’s', () => {
    const editor = block('.editor')

    expect(editor).toContain('--roll-note: var(--studio-track);')
    expect(editor).toContain('--roll-playhead: var(--studio-playhead);')
  })

  it('declares again in the light theme the keys, the shading and the notes’ ink', () => {
    const light = block(":global(html[data-theme='light']) .editor")

    for (const token of [
      '--roll-row-shade',
      '--roll-key-white',
      '--roll-key-black',
      '--roll-note-text',
      '--roll-note-glow',
    ])
      expect(light, token).toContain(`${token}:`)
  })
})

describe('readStudioRollTheme', () => {
  it('gives each colour its custom property’s value and the editor’s font, and leaves no probe behind', () => {
    // Arrange: jsdom resolves no var(), so the computed colour says what it was asked.
    const host = document.createElement('div')
    document.body.append(host)
    vi.spyOn(globalThis, 'getComputedStyle').mockImplementation(
      (element) =>
        ({
          color: (element as HTMLElement).style.color,
          fontFamily: element === host ? 'Inter, sans-serif' : '',
        }) as CSSStyleDeclaration,
    )

    // Act
    const theme = readStudioRollTheme(host)

    // Assert
    expect(theme.note).toBe('var(--roll-note)')
    expect(theme.playheadGlow).toBe('var(--roll-playhead-glow)')
    expect(theme.font).toBe('Inter, sans-serif')
    expect(host.childElementCount).toBe(0)
  })
})

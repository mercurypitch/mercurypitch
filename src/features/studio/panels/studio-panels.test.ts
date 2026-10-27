// Studio panel state tests — top-bar buttons toggle their own panel, focus returns to the opener, and Add takes from Mix returns to Mix.
import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStudioPanels } from './studio-panels'

afterEach(() => {
  document.body.replaceChildren()
})

function panels(options: Parameters<typeof createStudioPanels>[0] = {}) {
  return createRoot((dispose) => ({
    ...createStudioPanels(options),
    dispose,
  }))
}

describe('Studio panels', () => {
  it('opens a panel from its button, switches on another, and closes on a second press', () => {
    const state = panels()

    state.toggle('sound')
    expect(state.panel()).toBe('sound')
    state.toggle('export')
    expect(state.panel()).toBe('export')
    state.toggle('export')

    expect(state.panel()).toBeNull()
    state.dispose()
  })

  it('returns to Mix after a take added from Add takes opened in Mix, and keeps Mix when added there', () => {
    const state = panels()

    state.open('mix')
    state.open('sources')
    state.afterAdd()
    expect(state.panel()).toBe('mix')
    state.afterAdd()
    expect(state.panel()).toBe('mix')
    state.close()
    state.open('sources')
    state.afterAdd()

    expect(state.panel()).toBeNull()
    state.dispose()
  })

  it('forgets the way back to Mix once another panel opened in between', () => {
    const state = panels()

    state.open('mix')
    state.open('sources')
    state.open('sound')
    state.open('sources')
    state.afterAdd()

    expect(state.panel()).toBeNull()
    state.dispose()
  })

  it('tells its owner before each change and after each opening, and gives focus back to the opener', async () => {
    const before = vi.fn()
    const opened = vi.fn()
    const button = document.createElement('button')
    document.body.append(button)
    button.focus()
    const state = panels({ beforeChange: before, onOpen: opened })

    state.open('sources')
    document.body.focus()
    state.close()
    await Promise.resolve()

    expect(before.mock.calls).toEqual([['sources'], [null]])
    expect(opened).toHaveBeenCalledWith('sources')
    expect(document.activeElement).toBe(button)
    state.dispose()
  })
})

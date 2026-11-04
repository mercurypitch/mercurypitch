// Studio zoom key tests — = and + zoom in, - zooms out, Z fits the song, from the Studio only, never from a text field, a dialog or a chord.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installStudioZoomKeys } from './zoom-keys'

afterEach(() => {
  document.body.replaceChildren()
})

function studio() {
  const scope = document.createElement('div')
  scope.innerHTML = `
    <button type="button" id="clip">Clip</button>
    <input type="range" id="fader" />
    <input type="text" id="clock" />
    <div role="dialog"><button type="button" id="in-dialog">OK</button></div>
  `
  const outside = document.createElement('button')
  outside.id = 'app-nav'
  document.body.append(scope, outside)
  const zoom = { step: vi.fn(), fit: vi.fn() }
  const remove = installStudioZoomKeys({ scope: () => scope, zoom })
  return { scope, zoom, remove }
}

function press(target: Element, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  })
  target.dispatchEvent(event)
  return event
}

const byId = (id: string) => document.getElementById(id)!

describe('Studio zoom keys', () => {
  it('zooms in on = and +, out on -, and fits the song on Z, and claims each key', () => {
    const { zoom, remove } = studio()

    const zoomIn = press(byId('clip'), { key: '=' })
    // + needs Shift on most layouts, and the keypad sends its own.
    press(byId('fader'), { key: '+', shiftKey: true })
    press(document.body, { key: '-' })
    const fit = press(byId('clip'), { key: 'z' })
    press(document.body, { key: 'Z' })

    expect(zoom.step.mock.calls).toEqual([[1], [1], [-1]])
    expect(zoom.fit).toHaveBeenCalledTimes(2)
    expect(zoomIn.defaultPrevented).toBe(true)
    expect(fit.defaultPrevented).toBe(true)
    remove()
  })

  it('keeps zooming while + or - is held, but fits once per press', () => {
    const { zoom, remove } = studio()

    press(byId('clip'), { key: '=', repeat: true })
    press(byId('clip'), { key: 'z', repeat: true })

    expect(zoom.step).toHaveBeenCalledOnce()
    expect(zoom.fit).not.toHaveBeenCalled()
    remove()
  })

  it('leaves the keys to the clock, dialogs, the rest of the app and chords', () => {
    const { zoom, remove } = studio()

    press(byId('clock'), { key: '-' })
    press(byId('in-dialog'), { key: '=' })
    press(byId('app-nav'), { key: 'z' })
    // Ctrl or Cmd with + and - zooms the page; Ctrl or Cmd with Z undoes.
    for (const chord of ['ctrlKey', 'metaKey', 'altKey'])
      press(byId('clip'), { key: '=', [chord]: true })
    press(byId('clip'), { key: 'z', ctrlKey: true })
    press(byId('clip'), { key: 'Z', shiftKey: true })

    expect(zoom.step).not.toHaveBeenCalled()
    expect(zoom.fit).not.toHaveBeenCalled()
    remove()
  })

  it('ignores a key another handler already took, and stops listening once removed', () => {
    const { scope, zoom, remove } = studio()
    const taken = (event: Event) => event.preventDefault()
    scope.addEventListener('keydown', taken)

    press(byId('clip'), { key: '=' })
    scope.removeEventListener('keydown', taken)
    remove()
    press(byId('clip'), { key: '=' })

    expect(zoom.step).not.toHaveBeenCalled()
  })
})

// Studio mix shortcut tests — X toggles the desk from the Studio, never from a text field, a dialog or a chord.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installStudioMixShortcut } from './mix-shortcut'

afterEach(() => {
  document.body.replaceChildren()
})

function studio() {
  const scope = document.createElement('div')
  scope.innerHTML = `
    <button type="button" id="fader-button">Mute</button>
    <input type="range" id="fader" />
    <input type="text" id="tempo" />
    <textarea id="notes"></textarea>
    <div role="dialog"><button type="button" id="in-dialog">OK</button></div>
  `
  const outside = document.createElement('button')
  outside.id = 'app-nav'
  document.body.append(scope, outside)
  const toggle = vi.fn()
  const remove = installStudioMixShortcut({ scope: () => scope, toggle })
  return { scope, toggle, remove }
}

function press(target: Element, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 'x',
    code: 'KeyX',
    bubbles: true,
    cancelable: true,
    ...init,
  })
  target.dispatchEvent(event)
  return event
}

describe('Studio mix shortcut', () => {
  it('toggles the desk once per X on a Studio button, a fader or the page, and claims the key', () => {
    const { toggle, remove } = studio()

    const onButton = press(document.getElementById('fader-button')!)
    press(document.getElementById('fader')!, { key: 'X' })
    press(document.body)

    expect(toggle).toHaveBeenCalledTimes(3)
    expect(onButton.defaultPrevented).toBe(true)
    remove()
  })

  it('leaves X to text fields, dialogs, the rest of the app, chords and held keys', () => {
    const { toggle, remove } = studio()

    press(document.getElementById('tempo')!)
    press(document.getElementById('notes')!)
    press(document.getElementById('in-dialog')!)
    press(document.getElementById('app-nav')!)
    for (const chord of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey'])
      press(document.getElementById('fader-button')!, { [chord]: true })
    press(document.getElementById('fader-button')!, { repeat: true })

    expect(toggle).not.toHaveBeenCalled()
    remove()
  })

  it('ignores a key another handler already took, and stops listening once removed', () => {
    const { scope, toggle, remove } = studio()
    const taken = (event: Event) => event.preventDefault()
    scope.addEventListener('keydown', taken)

    press(document.getElementById('fader-button')!)
    scope.removeEventListener('keydown', taken)
    remove()
    press(document.getElementById('fader-button')!)

    expect(toggle).not.toHaveBeenCalled()
  })
})

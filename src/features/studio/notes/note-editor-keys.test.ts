// Studio notes key tests — a bare E opens the focused clip, or the selected one when no clip has the focus; it answers in the Studio or on the page itself, never in a text field, a dialog, the note editor or elsewhere in the app, and never with a modifier or a held key; and the listener takes the key only when a clip opened.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installStudioNotesKey, studioNotesKeyClip } from './note-editor-keys'

afterEach(() => {
  document.body.replaceChildren()
})

/** A Studio with a lane, its clip button, a text field and a note editor. */
function studio() {
  const scope = document.createElement('div')
  scope.innerHTML = `
    <div data-studio-track="lane-1">
      <button data-studio-clip="clip-1">Keys, Take 1</button>
    </div>
    <input aria-label="Project name" />
    <section data-studio-note-editor tabindex="-1"><button>Done</button></section>
    <div role="dialog"><button>Close</button></div>
  `
  const elsewhere = document.createElement('button')
  document.body.append(scope, elsewhere)
  const find = (selector: string) => scope.querySelector<HTMLElement>(selector)!
  return {
    scope,
    clip: find('[data-studio-clip]'),
    field: find('input'),
    editor: find('[data-studio-note-editor] button'),
    dialog: find('[role="dialog"] button'),
    elsewhere,
  }
}

/** A key pressed on `target`. */
function press(target: EventTarget, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    key: 'e',
    bubbles: true,
    cancelable: true,
    ...init,
  })
  Object.defineProperty(event, 'target', { value: target })
  return event
}

describe('studioNotesKeyClip', () => {
  it('opens the clip with the focus, before the selected one', () => {
    const { scope, clip } = studio()

    expect(studioNotesKeyClip(press(clip), scope, 'clip-2')).toBe('clip-1')
  })

  it('opens the selected clip from anywhere else in the Studio, and from the page itself', () => {
    const { scope } = studio()

    expect(studioNotesKeyClip(press(scope), scope, 'clip-2')).toBe('clip-2')
    expect(studioNotesKeyClip(press(document.body), scope, 'clip-2')).toBe(
      'clip-2',
    )
    expect(studioNotesKeyClip(press(scope), scope, null)).toBeNull()
  })

  it('leaves the letter to a text field, a dialog, the note editor and the rest of the app', () => {
    const { scope, field, dialog, editor, elsewhere } = studio()

    for (const target of [field, dialog, editor, elsewhere])
      expect(studioNotesKeyClip(press(target), scope, 'clip-1')).toBeNull()
  })

  it('answers a bare E only: no modifier, no held key, no other letter', () => {
    const { scope, clip } = studio()

    for (const init of [
      { ctrlKey: true },
      { metaKey: true },
      { altKey: true },
      { shiftKey: true },
      { repeat: true },
      { key: 'r' },
    ])
      expect(studioNotesKeyClip(press(clip, init), scope, null)).toBeNull()
    expect(studioNotesKeyClip(press(clip, { key: 'E' }), scope, null)).toBe(
      'clip-1',
    )
  })
})

describe('installStudioNotesKey', () => {
  it('takes the key only when the clip opened, and lets go of it once removed', () => {
    // Arrange
    const { scope, clip } = studio()
    const open = vi.fn((clipId: string) => clipId === 'clip-1')
    const remove = installStudioNotesKey({
      scope: () => scope,
      selectedClipId: () => 'audio-clip',
      open,
    })

    // Act
    const onClip = new KeyboardEvent('keydown', {
      key: 'e',
      bubbles: true,
      cancelable: true,
    })
    clip.dispatchEvent(onClip)
    const onAudio = new KeyboardEvent('keydown', {
      key: 'e',
      bubbles: true,
      cancelable: true,
    })
    scope.dispatchEvent(onAudio)
    remove()
    clip.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'e', bubbles: true }),
    )

    // Assert
    expect(open.mock.calls).toEqual([['clip-1'], ['audio-clip']])
    expect(onClip.defaultPrevented).toBe(true)
    expect(onAudio.defaultPrevented).toBe(false)
  })
})

// Studio keyboard editor — focus-scoped shortcuts and cancellable held nudges share immutable commands.
import { createEditorActions } from './editor-actions'
import { studioEditorFocus } from './key-scope'
import { createKeyboardNudge } from './keyboard-nudge'
import type { StudioEditorFocus, StudioEditorOptions } from './types'
import { finishStudioKey } from './types'

export type { StudioEditorOptions } from './types'

export function createStudioEditor(options: StudioEditorOptions) {
  const actions = createEditorActions(options)
  const nudge = createKeyboardNudge(options)
  let disposed = false

  function sync(): void {
    actions.sync()
    nudge.sync()
  }

  function modifiedKey(
    event: KeyboardEvent,
    focus: StudioEditorFocus,
  ): boolean {
    const key = event.key.toLowerCase()
    if (!['c', 'v', 'd'].includes(key) || event.altKey || event.shiftKey)
      return false
    if (key !== 'v' && focus.clipId === null) return false
    if (!event.repeat) {
      nudge.cancel()
      if (key === 'c' && focus.clipId !== null) actions.copy(focus.clipId)
      else if (options.writable() && key === 'v') actions.paste(focus.trackId)
      else if (options.writable() && focus.clipId !== null)
        actions.duplicate(focus.clipId)
    }
    return finishStudioKey(event)
  }

  function plainKey(event: KeyboardEvent, focus: StudioEditorFocus): boolean {
    const key = event.key.toLowerCase()
    if (event.altKey || event.shiftKey || !options.writable()) return false
    const headerKey = focus.header && (key === 'm' || key === 's')
    const clipKey =
      focus.clipId !== null && ['s', 'delete', 'backspace'].includes(key)
    if (!headerKey && !clipKey) return false
    if (!event.repeat) {
      nudge.cancel()
      if (headerKey) actions.header(focus, key)
      else if (focus.clipId !== null && key === 's') actions.split(focus.clipId)
      else if (focus.clipId !== null) actions.remove(focus.clipId)
    }
    return finishStudioKey(event)
  }

  function keyDown(event: KeyboardEvent): boolean {
    if (disposed || event.defaultPrevented) return false
    sync()
    if (event.key === 'Escape' && nudge.active()) {
      nudge.cancel()
      return finishStudioKey(event)
    }
    if (event.key === 'Tab') nudge.cancel()
    const focus = studioEditorFocus(event.target)
    if (!focus) return false
    if (event.ctrlKey || event.metaKey) return modifiedKey(event, focus)
    if (focus.clipId !== null && nudge.keyDown(event, focus.clipId)) return true
    return plainKey(event, focus)
  }

  const hidden = () => {
    if (document.hidden) nudge.cancel()
  }
  window.addEventListener('blur', nudge.cancel)
  document.addEventListener('visibilitychange', hidden)

  function dispose(): void {
    disposed = true
    nudge.cancel()
    window.removeEventListener('blur', nudge.cancel)
    document.removeEventListener('visibilitychange', hidden)
  }

  return {
    keyDown,
    keyUp: nudge.keyUp,
    cancel: nudge.cancel,
    sync,
    dispose,
    copy: actions.copy,
    paste: actions.paste,
    canPaste: actions.canPaste,
  }
}

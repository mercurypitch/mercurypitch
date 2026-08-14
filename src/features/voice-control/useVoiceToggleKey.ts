// ============================================================
// useVoiceToggleKey — the voice shortcuts for standalone surfaces
// ============================================================
//
// The main app routes V through useKeyboardShortcuts; standalone entries
// (Karaoke Night, Guitar Night) have no keyboard hook, which is why V "did
// nothing" there. This is that binding alone: V toggles voice, Shift+V
// shows the command center (the same pair as the main app), no Ctrl/Meta
// (paste stays paste), ignored while typing. "?" also opens the command
// center HERE — these surfaces have no shortcut-help overlay to collide
// with, unlike the main app where "?" is taken.

import { onCleanup, onMount } from 'solid-js'

export function useVoiceToggleKey(
  toggle: () => void,
  showCommands?: () => void,
): void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) return
    const isTyping =
      e.target instanceof Element &&
      e.target.closest('input,textarea,select,[contenteditable]') !== null
    if (isTyping) return

    if (e.code === 'KeyV') {
      e.preventDefault()
      if (e.shiftKey && showCommands !== undefined) {
        showCommands()
      } else {
        toggle()
      }
      return
    }
    // "?" is Shift+/ on most layouts, but not all — match the character
    // rather than the physical key, so it works on a German or French
    // keyboard too.
    if (e.key === '?' && showCommands !== undefined) {
      e.preventDefault()
      showCommands()
    }
  }

  onMount(() => window.addEventListener('keydown', onKeyDown))
  onCleanup(() => window.removeEventListener('keydown', onKeyDown))
}

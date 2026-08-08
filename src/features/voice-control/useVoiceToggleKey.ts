// ============================================================
// useVoiceToggleKey — the V shortcut for standalone surfaces
// ============================================================
//
// The main app routes V through useKeyboardShortcuts; standalone entries
// (Karaoke Night, Guitar Night) have no keyboard hook, which is why V "did
// nothing" there. This is that one binding alone: KeyV, no Ctrl/Meta (paste
// stays paste), ignored while typing.

import { onCleanup, onMount } from 'solid-js'

export function useVoiceToggleKey(toggle: () => void): void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code !== 'KeyV' || e.ctrlKey || e.metaKey) return
    const isTyping =
      e.target instanceof Element &&
      e.target.closest('input,textarea,select,[contenteditable]') !== null
    if (isTyping) return
    e.preventDefault()
    toggle()
  }

  onMount(() => window.addEventListener('keydown', onKeyDown))
  onCleanup(() => window.removeEventListener('keydown', onKeyDown))
}

// ============================================================
// KeyboardShortcutOverlay — Beautiful `?` shortcut help panel
// ============================================================

import type { Component } from 'solid-js'
import { For, onCleanup, onMount } from 'solid-js'

interface ShortcutGroup {
  title: string
  keys: { keys: string[]; action: string }[]
}

const SHORTCUTS: ShortcutGroup[] = [
  {
    title: 'Playback',
    keys: [
      { keys: ['Space'], action: 'Play / Pause' },
      { keys: ['Esc'], action: 'Stop playback' },
      { keys: ['Home'], action: 'Seek to start' },
      { keys: ['↑', '↓'], action: 'Speed up / slow down' },
    ],
  },
  {
    title: 'Modes & Mic',
    keys: [
      { keys: ['R'], action: 'Toggle Repeat mode' },
      { keys: ['P'], action: 'Toggle Session mode' },
      { keys: ['M'], action: 'Toggle microphone' },
    ],
  },
  {
    title: 'Navigation',
    keys: [
      { keys: ['?'], action: 'Show this help' },
      { keys: ['Esc'], action: 'Close modals & overlays' },
    ],
  },
]

const KeyboardShortcutOverlay: Component<{ onClose: () => void }> = (props) => {
  const handleKey = (e: KeyboardEvent) => {
    if (e.code === 'Escape' || e.code === 'Slash') {
      e.preventDefault()
      props.onClose()
    }
  }

  onMount(() => window.addEventListener('keydown', handleKey))
  onCleanup(() => window.removeEventListener('keydown', handleKey))

  return (
    <div class="ks-overlay" onClick={() => props.onClose()}>
      <div class="ks-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div class="ks-header">
          <h2 class="ks-title">Keyboard Shortcuts</h2>
          <p class="ks-subtitle">
            Press <kbd class="ks-kbd-inline">?</kbd> to toggle
          </p>
          <button
            class="ks-close"
            onClick={() => props.onClose()}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Shortcut groups */}
        <div class="ks-groups">
          <For each={SHORTCUTS}>
            {(group) => (
              <div class="ks-group">
                <h3 class="ks-group-title">{group.title}</h3>
                <div class="ks-rows">
                  <For each={group.keys}>
                    {(shortcut) => (
                      <div class="ks-row">
                        <div class="ks-keys">
                          <For each={shortcut.keys}>
                            {(key, i) => (
                              <>
                                {i() > 0 && <span class="ks-sep">+</span>}
                                <kbd class="ks-kbd">{key}</kbd>
                              </>
                            )}
                          </For>
                        </div>
                        <span class="ks-action">{shortcut.action}</span>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>

        {/* Footer */}
        <div class="ks-footer">
          <span class="ks-footer-icon">⌨</span>
          <span>MercuryPitch</span>
        </div>
      </div>
    </div>
  )
}

export default KeyboardShortcutOverlay

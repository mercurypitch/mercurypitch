// ============================================================
// KeyboardShortcutOverlay — Beautiful `?` shortcut help panel
// ============================================================

import type { Component } from 'solid-js'
import { For, onCleanup, onMount } from 'solid-js'
import styles from './KeyboardShortcutOverlay.module.css'

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
    if (e.code === 'Escape' || (e.code === 'Slash' && e.shiftKey)) {
      e.preventDefault()
      props.onClose()
    }
  }

  onMount(() => window.addEventListener('keydown', handleKey))
  onCleanup(() => window.removeEventListener('keydown', handleKey))

  return (
    <div
      class={styles.ksOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={() => props.onClose()}
    >
      <div class={styles.ksCard} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div class={styles.ksHeader}>
          <h2 class={styles.ksTitle}>Keyboard Shortcuts</h2>
          <p class={styles.ksSubtitle}>
            Press <kbd class={styles.ksKbdInline}>?</kbd> to toggle
          </p>
          <button
            class={styles.ksClose}
            onClick={() => props.onClose()}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Shortcut groups */}
        <div class={styles.ksGroups}>
          <For each={SHORTCUTS}>
            {(group) => (
              <div class={styles.ksGroup}>
                <h3 class={styles.ksGroupTitle}>{group.title}</h3>
                <div class={styles.ksRows}>
                  <For each={group.keys}>
                    {(shortcut) => (
                      <div class={styles.ksRow}>
                        <div class={styles.ksKeys}>
                          <For each={shortcut.keys}>
                            {(key, i) => (
                              <>
                                {i() > 0 && <span class={styles.ksSep}>+</span>}
                                <kbd class={styles.ksKbd}>{key}</kbd>
                              </>
                            )}
                          </For>
                        </div>
                        <span class={styles.ksAction}>{shortcut.action}</span>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>

        {/* Footer */}
        <div class={styles.ksFooter}>
          <span class={styles.ksFooterIcon}>⌨</span>
          <span>MercuryPitch</span>
        </div>
      </div>
    </div>
  )
}

export default KeyboardShortcutOverlay

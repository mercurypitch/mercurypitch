// ============================================================
// VoiceCommandsOverlay — the "what can I say" panel
// ============================================================
//
// Generated from the live registry at open, filtered to commands available
// on the CURRENT view — so it can never drift from what actually works.
// Open it by saying "what can i say" (or "voice help"); close with Escape
// or a click outside, like the keyboard-shortcut overlay.

import { createMemo, For, onCleanup, onMount } from 'solid-js'
import { activeVoiceCommands } from './voice-command-registry'
import styles from './VoiceCommandsOverlay.module.css'

interface VoiceCommandsOverlayProps {
  close: () => void
}

/** Friendly section title per command-id prefix (before the first dot). */
const GROUP_TITLES: Record<string, string> = {
  transport: 'Transport',
  seek: 'Seeking',
  speed: 'Speed',
  tempo: 'Tempo',
  countIn: 'Count-in',
  loop: 'A-B loop',
  mode: 'Play modes',
  karaoke: 'Karaoke',
  nav: 'Navigation and help',
}

const MAX_PHRASES_SHOWN = 3

interface OverlayRow {
  label: string
  phrases: string
}

interface OverlayGroup {
  title: string
  rows: OverlayRow[]
}

export function VoiceCommandsOverlay(props: VoiceCommandsOverlayProps) {
  const groups = createMemo<OverlayGroup[]>(() => {
    const byTitle = new Map<string, OverlayRow[]>()
    for (const command of activeVoiceCommands()) {
      if (command.available !== undefined && !command.available()) continue
      const prefix = command.id.split('.')[0]
      const title = GROUP_TITLES[prefix] ?? 'Other'
      const shown = command.phrases
        .slice(0, MAX_PHRASES_SHOWN)
        .map((phrase) => phrase.replace(/<n>/g, 'N'))
        .join('" / "')
      const more = command.phrases.length > MAX_PHRASES_SHOWN ? ', ...' : ''
      const rows = byTitle.get(title) ?? []
      rows.push({ label: command.label, phrases: `"${shown}"${more}` })
      byTitle.set(title, rows)
    }
    return [...byTitle.entries()].map(([title, rows]) => ({ title, rows }))
  })

  const handleKey = (e: KeyboardEvent) => {
    if (e.code === 'Escape') {
      e.preventDefault()
      props.close()
    }
  }

  onMount(() => window.addEventListener('keydown', handleKey))
  onCleanup(() => window.removeEventListener('keydown', handleKey))

  return (
    <div
      class={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Voice commands"
      data-testid="voice-commands-overlay"
      onClick={() => props.close()}
    >
      <div class={styles.card} onClick={(e) => e.stopPropagation()}>
        <div class={styles.header}>
          <h2 class={styles.title}>Voice commands</h2>
          <p class={styles.subtitle}>
            What the mic answers to on this view. Say "what can I say" any time;
            "hey Mercury" and "please" are always allowed around a command.
          </p>
          <button
            type="button"
            class={styles.closeButton}
            onClick={() => props.close()}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div class={styles.groups}>
          <For each={groups()}>
            {(group) => (
              <div class={styles.group}>
                <h3 class={styles.groupTitle}>{group.title}</h3>
                <For each={group.rows}>
                  {(row) => (
                    <div class={styles.row}>
                      <span class={styles.rowLabel}>{row.label}</span>
                      <span class={styles.rowPhrases}>{row.phrases}</span>
                    </div>
                  )}
                </For>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}

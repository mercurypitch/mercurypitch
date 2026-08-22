// ============================================================
// VoiceCommandsOverlay — the command center
// ============================================================
//
// Generated from the live registry at open, filtered to commands available
// on the CURRENT view — so it can never drift from what actually works.
// One column, one scroll, sticky section headers: the earlier layout gave
// every group its own scrollport, which read as a wall of squished boxes.
// (Sticky headers are safe here BECAUSE there is a single scroller — the
// old overlap bug came from sticky titles escaping per-group scrollports.)
//
// Every row is also a button that runs its command: this panel has to work
// when the mic will not, or when you need to stay quiet. Open by saying
// "what can I say", pressing Shift+V, or from the mic pill's menu ("?"
// too on the standalone Night pages, where no shortcut-help overlay owns
// that key).

import { createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { showNotification } from '@/stores/notifications-store'
import type { VoiceCommand } from './types'
import { activeVoiceCommands } from './voice-command-registry'
import styles from './VoiceCommandsOverlay.module.css'

interface VoiceCommandsOverlayProps {
  close: () => void
  tone?: 'default' | 'velvet'
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
  mic: 'Microphone',
  ui: 'Windows',
  nav: 'Navigation and help',
  guitarNight: 'Guitar Night',
  mercurySing: 'Mercury Sing',
}

// Karaoke alone would dwarf every other group (a command per stem per verb),
// so it splits into digestible sections of its own.
const KARAOKE_SUBGROUPS: Array<[RegExp, string]> = [
  [/^karaoke\.(mute|unmute|solo|unsolo|volume|fullMix)/, 'Karaoke — stems'],
  [/^karaoke\.role/, 'Karaoke — who plays what'],
  [/^karaoke\.(loop|speed)/, 'Karaoke — loop and speed'],
  [
    /^karaoke\.(nextSong|previousSong|randomSong|songsOpen|songsClose)/,
    'Karaoke — songs',
  ],
]

export function groupTitleFor(id: string): string {
  if (id.startsWith('karaoke.')) {
    for (const [pattern, title] of KARAOKE_SUBGROUPS) {
      if (pattern.test(id)) return title
    }
    return 'Karaoke — transport'
  }
  return GROUP_TITLES[id.split('.')[0]] ?? 'Other'
}

/**
 * Fixed reading order for sections, whatever order surfaces registered
 * in: how you move, then what you tweak, then the specials, then help.
 * Unlisted titles sort at the end, just before Other.
 */
const GROUP_ORDER = [
  'Transport',
  'Seeking',
  'Speed',
  'Tempo',
  'Count-in',
  'A-B loop',
  'Play modes',
  'Microphone',
  'Karaoke — transport',
  'Karaoke — songs',
  'Karaoke — stems',
  'Karaoke — who plays what',
  'Karaoke — loop and speed',
  'Guitar Night',
  'Mercury Sing',
  'Windows',
  'Navigation and help',
]

const groupRank = (title: string): number => {
  const index = GROUP_ORDER.indexOf(title)
  if (index >= 0) return index
  return title === 'Other' ? GROUP_ORDER.length + 1 : GROUP_ORDER.length
}

const MAX_PHRASES_SHOWN = 3

const normalizeSearchText = (value: string): string =>
  value
    .toLowerCase()
    .replaceAll('<n>', 'n')
    .replace(/\b\d+(?:\.\d+)?\b/g, 'n')

interface OverlayRow {
  label: string
  phrases: string[]
  hiddenPhrases: number
  command: VoiceCommand
}

interface OverlayGroup {
  title: string
  rows: OverlayRow[]
}

export function VoiceCommandsOverlay(props: VoiceCommandsOverlayProps) {
  let overlay: HTMLDivElement | undefined
  let search: HTMLInputElement | undefined
  const [query, setQuery] = createSignal('')

  useFocusTrap(() => overlay, {
    isOpen: () => true,
    initialFocus: () => search,
  })

  const groups = createMemo<OverlayGroup[]>(() => {
    const needle = normalizeSearchText(query().trim())
    const byTitle = new Map<string, OverlayRow[]>()
    for (const command of activeVoiceCommands()) {
      if (command.available !== undefined && !command.available()) continue
      const haystack = normalizeSearchText(
        `${command.label} ${command.phrases.join(' ')}`,
      )
      if (needle !== '' && !haystack.includes(needle)) continue
      const title = groupTitleFor(command.id)
      const rows = byTitle.get(title) ?? []
      rows.push({
        label: command.label,
        phrases: command.phrases
          .slice(0, MAX_PHRASES_SHOWN)
          .map((phrase) => phrase.replace(/<n>/g, 'N')),
        hiddenPhrases: Math.max(0, command.phrases.length - MAX_PHRASES_SHOWN),
        command,
      })
      byTitle.set(title, rows)
    }
    return [...byTitle.entries()]
      .map(([title, rows]) => ({ title, rows }))
      .sort((a, b) => groupRank(a.title) - groupRank(b.title))
  })

  /**
   * Run a command from the panel. Slot commands ("forward <n> seconds")
   * get no argument and fall back to their own default, which is what
   * saying the phrase without a number already does.
   */
  const runRow = (row: OverlayRow) => {
    let result
    try {
      result = row.command.run({})
    } catch {
      showNotification(`${row.command.label} failed`, 'warning')
      return
    }
    if (typeof result === 'object' && result.failed) {
      showNotification(result.message, 'warning')
      return
    }
    showNotification(
      typeof result === 'string' ? result : row.command.label,
      'success',
    )
  }

  // Capture phase, and the event stops here: App's own keydown listener
  // registered first, does not know this overlay, and its Escape chain
  // falls through to "stop playback" — so a bubble-phase close meant one
  // keypress closed the panel AND stopped the song (or reset the piano
  // game). Capture runs before App's bubble listener on every surface
  // this overlay mounts on.
  const handleKey = (e: KeyboardEvent) => {
    if (e.code === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      props.close()
    }
  }

  onMount(() => window.addEventListener('keydown', handleKey, true))
  onCleanup(() => window.removeEventListener('keydown', handleKey, true))

  return (
    <div
      ref={overlay}
      class={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Voice commands"
      data-testid="voice-commands-overlay"
      data-tone={props.tone ?? 'default'}
      onClick={() => props.close()}
    >
      <div class={styles.card} onClick={(e) => e.stopPropagation()}>
        <div class={styles.header}>
          <div class={styles.headerText}>
            <h2 class={styles.title}>Voice commands</h2>
            <p class={styles.subtitle}>
              Everything the mic answers to on this view. Every row is also a
              button, for when you need to stay quiet.
            </p>
          </div>
          <button
            type="button"
            class={styles.closeButton}
            onClick={() => props.close()}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div class={styles.searchRow}>
          <input
            ref={search}
            class={styles.search}
            type="search"
            placeholder="Filter commands…"
            value={query()}
            aria-label="Filter commands"
            onInput={(e) => setQuery(e.currentTarget.value)}
          />
        </div>

        <div class={styles.list}>
          <Show
            when={groups().length > 0}
            fallback={
              <p class={styles.empty}>
                Nothing matches "{query()}" on this view.
              </p>
            }
          >
            <For each={groups()}>
              {(group) => (
                <section class={styles.group}>
                  <h3 class={styles.groupTitle}>{group.title}</h3>
                  <For each={group.rows}>
                    {(row) => (
                      <button
                        type="button"
                        class={styles.row}
                        title={`Run: ${row.label}`}
                        onClick={() => runRow(row)}
                      >
                        <span class={styles.rowLabel}>{row.label}</span>
                        <span class={styles.rowPhrases}>
                          <For each={row.phrases}>
                            {(phrase) => (
                              <span class={styles.phrase}>{phrase}</span>
                            )}
                          </For>
                          <Show when={row.hiddenPhrases > 0}>
                            <span class={styles.phraseMore}>
                              +{row.hiddenPhrases}
                            </span>
                          </Show>
                        </span>
                      </button>
                    )}
                  </For>
                </section>
              )}
            </For>
          </Show>
        </div>

        <p class={styles.footer}>
          Say "what can I say" or press Shift+V to open this — "hey Mercury" and
          "please" are always allowed around a command.
        </p>
      </div>
    </div>
  )
}

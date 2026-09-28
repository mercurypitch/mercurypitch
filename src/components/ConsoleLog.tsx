// ============================================================
// ConsoleLog — the developer console's log, shown in place
// ============================================================
//
// Two presentations of one buffer. This file is the inline one, and the only
// one every build carries: Settings' danger zone shows it under the toggle
// that turns the console on, and the crash card shows it under its log
// button. The floating one, the same log as a panel over whatever page you
// are on, is FloatingConsole.tsx, built from `ConsoleLogView` below.
//
// Apart on purpose. The crash card imports this file into every build, the
// native store binary included, and that binary carries no floating console
// (`scripts/assert-no-portable-console.mjs --store-binary`). So nothing here
// may import FloatingConsole, or the switch that arms it
// (src/stores/developer-console-store.ts).

import type { Component } from 'solid-js'
import { createEffect, createSignal, For, Show } from 'solid-js'
import { Copy, Trash2, X } from '@/components/icons'
import { developerSections } from '@/lib/developer-sections'
import { clearConsoleLogs, consoleLogs, formatConsoleLogs, } from '@/stores/console-store'
import styles from '@/styles/ConsoleLog.module.css'

const LEVEL_COLOR: Record<string, string> = {
  error: '#ff6b6b',
  warn: '#feca57',
  info: '#48dbfb',
  log: 'var(--text-primary, #c8d6e5)',
}

/** Copy that reports what happened. The clipboard is refused outright on an
 *  insecure origin, and a button that looks like it worked is worse than one
 *  that admits it did not. */
const CopyButton: Component = () => {
  const [state, setState] = createSignal<'idle' | 'done' | 'failed'>('idle')
  const label = () =>
    state() === 'done'
      ? 'Copied'
      : state() === 'failed'
        ? 'No clipboard'
        : 'Copy all'

  return (
    <button
      type="button"
      class={styles.consoleLogBtn}
      data-testid="console-log-copy"
      title="Copy every message to the clipboard"
      onClick={() => {
        void (async () => {
          try {
            await navigator.clipboard.writeText(formatConsoleLogs())
            setState('done')
          } catch {
            setState('failed')
          }
          setTimeout(() => setState('idle'), 2000)
        })()
      }}
    >
      <Copy size={14} />
      {label()}
    </button>
  )
}

const Controls: Component<{ onHide?: () => void }> = (props) => (
  <div class={styles.consoleLogActions}>
    <CopyButton />
    <button
      type="button"
      class={styles.consoleLogBtn}
      data-testid="console-log-clear"
      title="Discard every message"
      onClick={() => clearConsoleLogs()}
    >
      <Trash2 />
      Clear
    </button>
    <Show when={props.onHide !== undefined}>
      <button
        type="button"
        class={styles.consoleLogBtn}
        data-testid="console-log-hide"
        title="Hide the console"
        onClick={() => props.onHide?.()}
      >
        <X />
      </button>
    </Show>
  </div>
)

/**
 * Whatever this build registered above the log.
 *
 * Renders nothing when nothing registered, which is every web page load —
 * sections exist for a signed binary with no devtools behind it. See
 * `src/lib/developer-sections.ts`.
 */
const Sections: Component = () => (
  <Show when={developerSections().length > 0}>
    <div class={styles.consoleLogSections} data-testid="console-log-sections">
      <For each={developerSections()}>
        {(section) => (
          <section class={styles.consoleLogSection}>
            <h5 class={styles.consoleLogSectionTitle}>{section.title}</h5>
            {section.render()}
          </section>
        )}
      </For>
    </div>
  </Show>
)

const Messages: Component = () => {
  let scroller: HTMLDivElement | undefined

  createEffect(() => {
    const logs = consoleLogs()
    if (scroller !== undefined && logs.length > 0) {
      scroller.scrollTop = scroller.scrollHeight
    }
  })

  return (
    <div
      ref={scroller}
      class={styles.consoleLogMessages}
      data-testid="console-log-messages"
    >
      <For each={consoleLogs()}>
        {(entry) => (
          <div
            class={styles.consoleLogEntry}
            style={{ color: LEVEL_COLOR[entry.type] ?? LEVEL_COLOR.log }}
          >
            <span class={styles.consoleLogTime}>
              {new Date(entry.timestamp).toLocaleTimeString()}
            </span>
            <span class={styles.consoleLogLevel}>[{entry.type}]</span>
            <span>{entry.args.join(' ')}</span>
          </div>
        )}
      </For>
      <Show when={consoleLogs().length === 0}>
        <div class={styles.consoleLogEmpty}>
          Nothing logged yet. Errors and warnings will appear here.
        </div>
      </Show>
    </div>
  )
}

interface ConsoleLogViewProps {
  /** How this presentation sizes the box. */
  class: string
  /** A hide button beside Copy and Clear, for a panel that can fold away. */
  onHide?: () => void
}

/**
 * The log in its box: the title and its controls, whatever this build
 * registered, then the messages. Both presentations are this, sized their
 * own way; the floating panel passes `onHide`.
 */
export function ConsoleLogView(props: ConsoleLogViewProps) {
  return (
    <div class={`${styles.consoleLogContainer} ${props.class}`}>
      <div class={styles.consoleLogHeader}>
        <h4 class={styles.consoleLogTitle}>Developer Console</h4>
        <Controls onHide={props.onHide} />
      </div>
      <Sections />
      <Messages />
    </div>
  )
}

/** The log as it appears in Settings, under the toggle that turns it on,
 *  and on the crash card. */
export const ConsoleLog: Component = () => (
  <ConsoleLogView class={styles.consoleLogInline} />
)

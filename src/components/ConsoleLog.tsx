// ============================================================
// ConsoleLog — the developer console, in the app, on every page
// ============================================================
//
// Two presentations of one buffer. `inline` sits in Settings' danger zone
// where the toggle lives, and `floating` is the same log as a panel over
// whatever page you are on — because the bug worth reading is rarely on the
// Settings screen, and walking there to look at it is walking away from it.
//
// The floating one is mounted per DOCUMENT by `setupDeveloperConsole`, the
// same way the portable console does it: Karaoke Night, the Mirror and each
// Night entry are separate documents with their own roots and no shared shell,
// so there is no one component tree to put this in. The visibility flag is
// persisted for the same reason.
//
// Two traps this file is shaped around, both paid for once already:
//
//   • `position: fixed` is captured by any transformed ancestor, which parked
//     an earlier overlay 37px ABOVE the viewport while `getComputedStyle`
//     still read `bottom: 0`. Mounting into a host appended to <body> is what
//     keeps that from happening again.
//   • A debug panel that covers the control under test is worse than no
//     panel. Collapsed it is a small button; open, the backdrop takes no
//     pointer events and only the panel's own controls do.

import type { Component } from 'solid-js'
import { createEffect, createSignal, For, Show } from 'solid-js'
import { render } from 'solid-js/web'
import { Copy, Trash2, X } from '@/components/icons'
import { developerSections } from '@/lib/developer-sections'
import { clearConsoleLogs, consoleLogs, formatConsoleLogs, showConsoleLog, } from '@/stores/console-store'
import styles from '@/styles/ConsoleLog.module.css'

const HOST_ID = 'mp-developer-console-host'

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

/** The log as it appears in Settings, under the toggle that turns it on. */
export const ConsoleLog: Component = () => (
  <div class={`${styles.consoleLogContainer} ${styles.consoleLogInline}`}>
    <div class={styles.consoleLogHeader}>
      <h4 class={styles.consoleLogTitle}>Developer Console</h4>
      <Controls />
    </div>
    <Sections />
    <Messages />
  </div>
)

/**
 * The same log, over whatever page you are on.
 *
 * Collapsed to a button by default: it is turned on to catch something that
 * has not happened yet, and until it does the console has no business taking
 * the screen. The count on the button is the reason to open it.
 */
export const FloatingConsole: Component = () => {
  const [open, setOpen] = createSignal(false)

  return (
    <Show when={showConsoleLog()}>
      <div class={styles.consoleLogFloat} data-testid="floating-console">
        <Show
          when={open()}
          fallback={
            <button
              type="button"
              class={styles.consoleLogFab}
              data-testid="floating-console-open"
              onClick={() => setOpen(true)}
            >
              Console
              <Show when={consoleLogs().length > 0}>
                <span class={styles.consoleLogCount}>
                  {consoleLogs().length}
                </span>
              </Show>
            </button>
          }
        >
          <div
            class={`${styles.consoleLogContainer} ${styles.consoleLogPanel}`}
          >
            <div class={styles.consoleLogHeader}>
              <h4 class={styles.consoleLogTitle}>Developer Console</h4>
              <Controls onHide={() => setOpen(false)} />
            </div>
            <Sections />
            <Messages />
          </div>
        </Show>
      </div>
    </Show>
  )
}

/**
 * Mount the floating console for THIS document.
 *
 * Called from every entry point, because each is its own document with its own
 * root and there is no shared shell to hang this off. Appending the host to
 * <body> also keeps `position: fixed` out of reach of any transformed ancestor
 * in the app's own tree.
 *
 * Unlike the portable console this ships: it is reachable only from Settings'
 * danger zone, behind a toggle that defaults to off, and it wraps nothing —
 * `initGlobalErrorHandlers` already feeds the buffer.
 */
export function setupDeveloperConsole(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(HOST_ID) !== null) return
  const host = document.createElement('div')
  host.id = HOST_ID
  document.body.appendChild(host)
  render(() => <FloatingConsole />, host)
}

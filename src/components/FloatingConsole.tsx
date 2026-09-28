// ============================================================
// FloatingConsole — the developer console, over whatever page you are on
// ============================================================
//
// The same log Settings shows inline (ConsoleLog.tsx), as a panel over the
// page, because the bug worth reading is rarely on the Settings screen, and
// walking there to look at it is walking away from it.
//
// A module of its own so that the inline log can ship without it. The crash
// card imports ConsoleLog.tsx into every build, and a native store binary
// carries no floating console: `scripts/assert-no-portable-console.mjs
// --store-binary` fails one that does. This file is loaded only from its
// arming (src/lib/developer-console.ts), which the native entry reaches only
// behind VITE_PORTABLE_CONSOLE, and from the web Settings switch.
//
// Mounted per DOCUMENT by `setupDeveloperConsole`, the same way the portable
// console does it: Karaoke Night, the Mirror and each Night entry are
// separate documents with their own roots and no shared shell, so there is no
// one component tree to put this in. The visibility flag is persisted for the
// same reason.
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
import { createSignal, Show } from 'solid-js'
import { render } from 'solid-js/web'
import { consoleLogs } from '@/stores/console-store'
import { showConsoleLog } from '@/stores/developer-console-store'
import { ConsoleLogView } from './ConsoleLog'
import styles from './FloatingConsole.module.css'

const HOST_ID = 'mp-developer-console-host'

/**
 * The log, over whatever page you are on.
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
          <ConsoleLogView
            class={styles.consoleLogPanel}
            onHide={() => setOpen(false)}
          />
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
 * Unlike the portable console this ships on the web: it is reachable only
 * from Settings' developer tools, behind a toggle that defaults to off, and it
 * wraps nothing — `initGlobalErrorHandlers` already feeds the buffer. A
 * native store build carries none of it.
 */
export function setupDeveloperConsole(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(HOST_ID) !== null) return
  const host = document.createElement('div')
  host.id = HOST_ID
  document.body.appendChild(host)
  render(() => <FloatingConsole />, host)
}

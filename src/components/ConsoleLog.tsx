import type { Component } from 'solid-js'
import { createEffect, For } from 'solid-js'
import { clearConsoleLogs, consoleLogs } from '@/stores/console-store'

export const ConsoleLog: Component = () => {
  let logContainerRef: HTMLDivElement | undefined

  createEffect(() => {
    // Scroll to bottom when logs update
    const logs = consoleLogs()
    if (logContainerRef && logs.length > 0) {
      logContainerRef.scrollTop = logContainerRef.scrollHeight
    }
  })

  return (
    <div
      class="console-log-container"
      style="background: var(--surface); border: 1px solid var(--border); border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; margin-top: 1rem; max-height: 300px;"
    >
      <div
        class="console-log-header"
        style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 1rem; border-bottom: 1px solid var(--border); background: var(--surface-hover);"
      >
        <h4 style="margin: 0; font-size: 0.9rem; color: var(--text);">
          Developer Console
        </h4>
        <button
          onClick={clearConsoleLogs}
          style="background: transparent; border: 1px solid var(--border); color: var(--text-muted); border-radius: 4px; padding: 0.2rem 0.5rem; font-size: 0.8rem; cursor: pointer;"
        >
          Clear Logs
        </button>
      </div>
      <div
        ref={logContainerRef}
        class="console-log-messages"
        style="overflow-y: auto; padding: 0.5rem; font-family: monospace; font-size: 0.85rem; flex: 1;"
      >
        <For each={consoleLogs()}>
          {(entry) => (
            <div
              class={`console-log-entry console-log-${entry.type}`}
              style={{
                padding: '0.2rem 0.5rem',
                'border-bottom':
                  '1px solid var(--border-light, rgba(255,255,255,0.05))',
                color:
                  entry.type === 'error'
                    ? '#ff6b6b'
                    : entry.type === 'warn'
                      ? '#feca57'
                      : entry.type === 'info'
                        ? '#48dbfb'
                        : 'var(--text, #c8d6e5)',
                'word-break': 'break-word',
                'white-space': 'pre-wrap',
              }}
            >
              <span style="color: var(--text-muted); margin-right: 0.5rem; font-size: 0.75rem;">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              <span style="font-weight: bold; margin-right: 0.5rem; text-transform: uppercase; font-size: 0.75rem;">
                [{entry.type}]
              </span>
              <span>{entry.args.join(' ')}</span>
            </div>
          )}
        </For>
        {consoleLogs().length === 0 && (
          <div style="color: var(--text-muted); text-align: center; padding: 1rem; font-style: italic;">
            No logs available.
          </div>
        )}
      </div>
    </div>
  )
}

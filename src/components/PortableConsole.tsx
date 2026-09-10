// ============================================================
// PortableConsole — the console, on the device, with a Copy button
// ============================================================
//
// Built while chasing VC-1 on an iPhone that cannot be plugged into anything.
// It answered that question in one run, so it is a feature rather than a
// one-off: set `VITE_PORTABLE_CONSOLE=true` and any device can hand back what
// its console saw. The capture and the build gate are in lib/portable-console.
//
// Collapsed it is one line — the newest entry — because the point is to watch
// the app while USING it. Tapping it opens the log, with a filter, Copy, and
// a flip to the other edge.
//
// Two things learned the hard way while placing it (2026-09-10):
//
//   1. Neither screen edge is safe. It first covered the voice pill along the
//      bottom (pill y 669-708 under a bar at 630-720); moved to the top, it
//      covered the header pill instead. So it passes taps through everywhere
//      except its own controls, and it flips edges in one tap.
//   2. `position: fixed` is laid out against the nearest TRANSFORMED
//      ancestor, and the app shell has animated ones — which parked the bar
//      37px above the screen while its computed style still read `bottom: 0`.
//      It mounts on <body> through its own root.

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, Show, } from 'solid-js'
import { render } from 'solid-js/web'
import { Copy, Trash2 } from '@/components/icons'
import { clearPortableConsole, formatPortableConsole, formatPortableConsoleEntry, initPortableConsoleVisibility, installPortableConsole, onPortableConsole, portableConsoleEntries, portableConsoleVisible, setPortableConsoleVisible, } from '@/lib/portable-console'
import styles from '@/styles/PortableConsole.module.css'

const HOST_ID = 'mp-portable-console'

export const PortableConsole: Component = () => {
  // Seeded, not defaulted: the interesting lines land during startup, well
  // before this mounts, and an empty panel over a live capture would read as
  // "nothing happened".
  const [entries, setEntries] = createSignal(portableConsoleEntries().slice())
  const [shown, setShown] = createSignal(portableConsoleVisible())
  const [open, setOpen] = createSignal(false)
  const [filter, setFilter] = createSignal('')
  const [copied, setCopied] = createSignal(false)
  const [edge, setEdge] = createSignal<'top' | 'bottom'>('bottom')
  let listEl: HTMLDivElement | undefined

  const off = onPortableConsole(() => {
    setEntries(portableConsoleEntries().slice())
    setShown(portableConsoleVisible())
  })
  onCleanup(off)

  const matching = createMemo(() => {
    const needle = filter().trim().toLowerCase()
    const all = entries()
    if (needle === '') return all
    return all.filter(
      (entry) =>
        entry.text.toLowerCase().includes(needle) ||
        entry.level.includes(needle),
    )
  })

  // Follow the tail while open, the way a console does.
  createEffect(() => {
    const count = matching().length
    if (!open() || listEl === undefined || count === 0) return
    listEl.scrollTop = listEl.scrollHeight
  })

  const latestLine = () => {
    const last = matching().at(-1)
    return last === undefined ? '' : formatPortableConsoleEntry(last)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatPortableConsole())
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // iOS refuses the clipboard often enough that throwing here would lose
      // the one capture someone spent ten minutes reproducing. Select it
      // instead, which always works.
      if (listEl === undefined) return
      const range = document.createRange()
      range.selectNodeContents(listEl)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  }

  return (
    <Show when={shown()}>
      <section
        class={styles.panel}
        classList={{
          [styles.top]: edge() === 'top',
          [styles.bottom]: edge() === 'bottom',
        }}
        aria-label="Portable console"
        data-testid="portable-console"
      >
        <button
          type="button"
          class={styles.summary}
          onClick={() => setOpen(!open())}
          aria-expanded={open()}
        >
          <span class={styles.count}>{matching().length}</span>
          <span class={styles.latest}>
            {latestLine() === '' ? 'console is quiet' : latestLine()}
          </span>
          <span class={styles.chevron} aria-hidden="true">
            {open() ? '▾' : '▴'}
          </span>
        </button>

        <Show when={open()}>
          <div class={styles.log} ref={listEl} tabindex="0">
            <For each={matching()}>
              {(entry) => (
                <div class={styles.line} data-level={entry.level}>
                  {formatPortableConsoleEntry(entry)}
                </div>
              )}
            </For>
          </div>
          <div class={styles.actions}>
            <input
              class={styles.filter}
              type="search"
              value={filter()}
              placeholder="filter"
              aria-label="Filter console lines"
              onInput={(event) => setFilter(event.currentTarget.value)}
            />
            <button
              type="button"
              class={styles.action}
              onClick={() => void copy()}
            >
              <Copy size={14} />
              {copied() ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              class={styles.action}
              onClick={() => clearPortableConsole()}
            >
              <Trash2 />
              Clear
            </button>
            <button
              type="button"
              class={styles.action}
              onClick={() => setEdge(edge() === 'bottom' ? 'top' : 'bottom')}
            >
              {edge() === 'bottom' ? 'Move up' : 'Move down'}
            </button>
            <button
              type="button"
              class={styles.action}
              onClick={() => {
                setPortableConsoleVisible(false)
                setShown(false)
              }}
            >
              Hide
            </button>
          </div>
        </Show>
      </section>
    </Show>
  )
}

/**
 * Start capturing and mount the panel on its own root.
 *
 * Called from every entry — this app has several documents, and the bug being
 * chased is usually the walk between two of them. Guarded at each call site by
 * `import.meta.env.VITE_PORTABLE_CONSOLE`, so a normal build never imports
 * this module at all.
 */
export function setupPortableConsole(): void {
  if (typeof document === 'undefined') return
  // Capture first: the lines worth having are the ones from startup, before
  // anything renders.
  installPortableConsole()
  initPortableConsoleVisibility()
  if (document.getElementById(HOST_ID) !== null) return
  const host = document.createElement('div')
  host.id = HOST_ID
  document.body.appendChild(host)
  render(() => <PortableConsole />, host)
}

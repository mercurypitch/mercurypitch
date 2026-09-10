// ============================================================
// VoiceDiagnosticsPanel — the voice log, on the device that has the bug
// ============================================================
//
// Safari's web inspector needs a cable and a Mac. `MP_DEV_LOGS=1` covers a
// phone on our own network; this covers the phone that is not — pointed at
// dev, or in someone else's hands — by putting the record on the screen with
// a button that copies it somewhere it can be pasted.
//
// Collapsed it is one line showing the last thing the ear did, because the
// point is to watch voice control while USING the app, not to cover the app
// with a log. Tapping it opens the whole recording.
//
// It can be flipped to the other edge, because the pill it is used to watch
// moves: a phone carries it in the header, a desktop in the bottom HUD (see
// hud-placement.ts). Both edges were measured covering it, so the bar passes
// taps through everywhere except its own controls, and one tap moves it.
//
// Only mounts when `?voicelog=1` asked for it. See voice-diagnostics.ts.

import type { Component } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { ChevronDown, ChevronUp, Copy, Trash2 } from '@/components/icons'
import styles from '@/styles/VoiceDiagnosticsPanel.module.css'
import { clearVoiceDiagnostics, formatEntry, formatVoiceDiagnostics, onVoiceDiagnostic, setVoiceDiagnosticsEnabled, voiceDiagnosticEntries, voiceDiagnosticsEnabled, } from './voice-diagnostics'

export const VoiceDiagnosticsPanel: Component = () => {
  // Seeded from the recorder, not defaulted: entries usually exist before
  // this mounts, and an empty panel over a live recording would read as
  // "nothing happened".
  const [entries, setEntries] = createSignal(voiceDiagnosticEntries().slice())
  const [on, setOn] = createSignal(voiceDiagnosticsEnabled())
  const [open, setOpen] = createSignal(false)
  /** Which edge it clings to. Flipped when it is over what is being tested. */
  const [edge, setEdge] = createSignal<'top' | 'bottom'>('bottom')
  const [copied, setCopied] = createSignal(false)
  let listEl: HTMLDivElement | undefined

  const off = onVoiceDiagnostic(() => {
    setEntries(voiceDiagnosticEntries().slice())
    setOn(voiceDiagnosticsEnabled())
  })
  onCleanup(off)

  // Follow the tail while open, the way a console does.
  createEffect(() => {
    const count = entries().length
    if (!open() || listEl === undefined || count === 0) return
    listEl.scrollTop = listEl.scrollHeight
  })

  /** The last thing the ear did, already formatted. Empty before anything
   *  has happened, which the summary line words for itself. */
  const latestLine = () => {
    const all = entries()
    const last = all.at(-1)
    return last === undefined ? '' : formatEntry(last)
  }

  const copy = async () => {
    const text = formatVoiceDiagnostics()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // iOS refuses the clipboard outside some gestures and in some
      // embeddings. Selecting the text is the fallback that always works.
      const node = listEl
      if (node === undefined) return
      const range = document.createRange()
      range.selectNodeContents(node)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  }

  return (
    <Show when={on()}>
      {/* Straight onto <body>. A `position: fixed` box is laid out against
          the nearest TRANSFORMED ancestor, not the viewport, and the shell
          has animated ones — which parked this bar 37px above the top of the
          screen while its computed style still read `bottom: 0`. */}
      <Portal>
        <section
          class={styles.panel}
          classList={{
            [styles.top]: edge() === 'top',
            [styles.bottom]: edge() === 'bottom',
          }}
          aria-label="Voice diagnostics"
          data-testid="voice-diagnostics-panel"
        >
          <button
            type="button"
            class={styles.summary}
            onClick={() => setOpen(!open())}
            aria-expanded={open()}
          >
            <span class={styles.count}>{entries().length}</span>
            <span class={styles.latest}>
              {latestLine() === '' ? 'waiting for the ear' : latestLine()}
            </span>
            <span class={styles.chevron} aria-hidden="true">
              <Show when={open()} fallback={<ChevronUp />}>
                <ChevronDown size={16} />
              </Show>
            </span>
          </button>

          <Show when={open()}>
            <div class={styles.log} ref={listEl} tabindex="0">
              <For each={entries()}>
                {(entry) => (
                  <div class={styles.line} data-event={entry.event}>
                    {formatEntry(entry)}
                  </div>
                )}
              </For>
            </div>
            <div class={styles.actions}>
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
                onClick={() => clearVoiceDiagnostics()}
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
                  setVoiceDiagnosticsEnabled(false)
                  setOn(false)
                }}
              >
                Stop
              </button>
            </div>
          </Show>
        </section>
      </Portal>
    </Show>
  )
}

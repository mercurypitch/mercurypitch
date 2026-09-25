// ============================================================
// Audio — what the app's sound is doing, read on the phone
// ============================================================
//
// The alley's ambient was silent on an iPhone for two device rounds and the
// build had no way to say why: no devtools behind TestFlight, and the
// loader's catch was empty. This section of the Developer screen is where a
// tester reads it now. src/lib/audio-diagnostics.ts records every step the
// ambient takes; this draws the live state beside the last fetch, decode and
// failure, and hands the whole record to the clipboard.
//
// SAMPLED, NOT SUBSCRIBED. The ambient keeps plain state and its clock moves
// without an event, so the rows are read every 250 ms while the screen is
// open ("moving or stalled" needs two readings anyway), and a new entry
// redraws them at once.
//
// The buttons: a test tone on a context of its own (test-tone.ts), the Sing
// ambient through the alley's own loader, and the report to the clipboard.
//
// Registered by the native entry alone, behind VITE_PORTABLE_CONSOLE and
// through a dynamic import (main.tsx), so a store build carries none of it.

import type { Component } from 'solid-js'
import { createSignal, Index, onCleanup, Show } from 'solid-js'
import type { AudioDiagnosticEntry } from '@/lib/audio-diagnostics'
import { describeAudioError, formatAudioDiagnostics, lastAudioDiagnostic, onAudioDiagnostic, } from '@/lib/audio-diagnostics'
import { ambient } from '../alley/RoomsAlley'
import { playTestTone } from './test-tone'

/** How often the rows are read while the screen is open. */
export const POLL_MS = 250
/** The alley's own fade in (RoomsAlley FADE_IN_MS). */
const FADE_MS = 600

interface Row {
  label: string
  value: string
}

/** The newest of a step's two outcomes: `fetched` or `fetch-failed`. */
const lastStep = (done: string, failed: string): AudioDiagnosticEntry | null =>
  lastAudioDiagnostic((e) => e.event === done || e.event === failed)

function fetchRow(): string {
  const entry = lastStep('fetched', 'fetch-failed')
  if (entry === null) return 'none yet'
  const d = entry.detail
  if (entry.failed) return `failed · ${describeAudioError(d.error)}`
  return `status ${String(d.status)} · ok ${String(d.ok)} · ${String(d.bytes)} B · ${String(d.ms)} ms`
}

function decodeRow(): string {
  const entry = lastStep('decoded', 'decode-failed')
  if (entry === null) return 'none yet'
  const d = entry.detail
  if (entry.failed) return `failed · ${describeAudioError(d.error)}`
  const seconds = Number(d.duration).toFixed(2)
  return `${seconds} s · ${String(d.channels)} ch · ${String(d.sampleRate)} Hz · ${String(d.ms)} ms`
}

/** The newest failure of any source, with the step it failed at. */
function errorRow(): string {
  const entry = lastAudioDiagnostic((e) => e.failed)
  if (entry === null) return 'none'
  const stage = entry.event.replace(/-failed$/u, '')
  const d = entry.detail
  const why = describeAudioError(d.error ?? d.reason ?? d.state)
  const age = Math.max(
    0,
    Math.round((Date.now() - Date.parse(entry.wall)) / 1000),
  )
  return `${stage} · ${entry.source} · ${why} · ${String(age)} s ago`
}

function audioSessionType(): string {
  const session = (
    navigator as Navigator & { audioSession?: { type?: string } }
  ).audioSession
  return session?.type ?? 'not available'
}

export const AudioDiagnosticsPanel: Component = () => {
  const [tick, setTick] = createSignal(0)
  const [toning, setToning] = createSignal(false)
  const [copied, setCopied] = createSignal(false)
  const [report, setReport] = createSignal('')
  let reportEl: HTMLPreElement | undefined
  let lastClock: number | null = null
  let moving = false
  let startedHere = false
  let copiedTimer: number | undefined

  const redraw = (): void => void setTick((n) => n + 1)
  const poll = window.setInterval(() => {
    const now = ambient().context()?.currentTime ?? null
    moving = now !== null && lastClock !== null && now > lastClock
    lastClock = now
    redraw()
  }, POLL_MS)
  const unsubscribe = onAudioDiagnostic(redraw)
  onCleanup(() => {
    window.clearInterval(poll)
    window.clearTimeout(copiedTimer)
    unsubscribe()
    // Started from here, so it ends here: not a loop under the next screen.
    if (startedHere && ambient().sounding() !== null)
      void ambient().stop(FADE_MS)
  })

  const sounding = (): boolean => {
    tick()
    return ambient().sounding() !== null
  }

  const rows = (): Row[] => {
    tick()
    const alley = ambient()
    const view = alley.context()
    const clock =
      view === null
        ? 'none yet'
        : `${view.currentTime.toFixed(3)} s · ${moving ? 'moving' : 'stalled'}`
    return [
      {
        label: 'Context',
        value:
          view === null
            ? 'none yet: tap a door, or Play below'
            : `${view.state} · ${String(view.sampleRate)} Hz`,
      },
      { label: 'Clock', value: clock },
      {
        label: 'Ambient',
        value: `${alley.sounding() ?? 'silent'} · level ${alley.level().toFixed(2)} · ${String(alley.sourcesStarted())} started`,
      },
      { label: 'Last fetch', value: fetchRow() },
      { label: 'Last decode', value: decodeRow() },
      { label: 'Last error', value: errorRow() },
      { label: 'Audio session', value: audioSessionType() },
      { label: 'Page', value: document.visibilityState },
    ]
  }

  const tone = (): void => {
    if (toning()) return
    setToning(true)
    playTestTone(() => setToning(false))
  }

  const toggleAmbient = (): void => {
    const alley = ambient()
    if (alley.sounding() !== null) {
      void alley.stop(FADE_MS)
    } else {
      startedHere = true
      alley.start('sing', FADE_MS)
    }
    redraw()
  }

  const copy = async (): Promise<void> => {
    const text = formatAudioDiagnostics(
      rows().map((r) => `${r.label}: ${r.value}`),
    )
    setReport(text)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.clearTimeout(copiedTimer)
      copiedTimer = window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // The portable console's fallback: iOS refuses the clipboard often
      // enough, so select the report instead, which always works.
      if (reportEl === undefined) return
      const range = document.createRange()
      range.selectNodeContents(reportEl)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  }

  return (
    <div class="mp-dev__audio" data-testid="dev-audio">
      <dl class="mp-dev__readout">
        <Index each={rows()}>
          {(row) => (
            <div class="mp-dev__readout-row" data-audio-row={row().label}>
              <dt>{row().label}</dt>
              <dd>{row().value}</dd>
            </div>
          )}
        </Index>
      </dl>
      <button
        type="button"
        class="mp-dev__row"
        data-testid="dev-audio-tone"
        disabled={toning()}
        onClick={tone}
      >
        <span class="mp-dev__row-title">Test tone</span>
        <span class="mp-dev__row-sub">
          One second of A4 (440 Hz) on a context of its own.
        </span>
      </button>
      <button
        type="button"
        class="mp-dev__row"
        data-testid="dev-audio-ambient"
        onClick={toggleAmbient}
      >
        <span class="mp-dev__row-title">
          {sounding() ? 'Stop' : 'Play Sing ambient'}
        </span>
        <span class="mp-dev__row-sub">
          The alley's own ambient, through its own loader.
        </span>
      </button>
      <button
        type="button"
        class="mp-dev__row"
        data-testid="dev-audio-copy"
        onClick={() => void copy()}
      >
        <span class="mp-dev__row-title">
          {copied() ? 'Copied' : 'Copy report'}
        </span>
        <span class="mp-dev__row-sub">
          Every step recorded since launch, with these rows on top.
        </span>
      </button>
      <Show when={report() !== ''}>
        <pre
          ref={reportEl}
          class="mp-dev__report"
          data-testid="dev-audio-report"
        >
          {report()}
        </pre>
      </Show>
    </div>
  )
}

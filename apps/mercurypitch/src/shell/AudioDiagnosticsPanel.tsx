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
// ambient through the alley's own loader, the report to the clipboard or
// the share sheet, and Clear log, so a scenario starts with an empty record
// (the copy kept across a restart goes too, audio-log-store.ts). The report
// opens with the app's version and build, the phone and its system, the
// app's session, the outputs, the page's session type and who holds it, and
// "One volume in rooms"; then the rows, then every entry, oldest first.
//
// Two rows are not about sound: which way the screen is turned and the
// safe-area insets (viewport-diagnostics.ts). They are here because this
// report is what comes back from a device round, and its record already
// carries a line for every turn the web view was told about.
//
// The rows under them are for a room that went quiet (TestFlight build
// 842: Lip roll faint at full volume until a relaunch): where the phone
// sends the sound and how loud (AudioOutput, live on every change), the
// session it plays through, the mic tracks and contexts the page holds
// open (audio-census.ts), who holds the shared clock, and the rooms' one
// output (room-output.ts). audio-readout.ts words each of them.
//
// On top, "One volume in rooms" (room-volume-switch.ts): a premium room
// keeps one iOS session, and so one volume, for its whole visit
// (room-visit.ts). On by default; off to compare.
//
// Registered by the native entry alone, behind VITE_PORTABLE_CONSOLE and
// through a dynamic import (main.tsx), so a store build carries none of it.

import { sharedAudioContextOwners } from '@irchiinnuss/audio-io'
import { pageAudioSessionHolders, pageAudioSessionType, } from '@irchiinnuss/mobile-runtime/page-audio-session'
import { sharePayload } from '@irchiinnuss/mobile-runtime/platform'
import type { Component } from 'solid-js'
import { createSignal, Index, onCleanup, Show } from 'solid-js'
import { roomOutputIfMade, roomOutputReadings, } from '@/components/room-kit/room-output'
import type { AudioDiagnosticEntry } from '@/lib/audio-diagnostics'
import { clearAudioDiagnostics, describeAudioError, formatAudioDiagnostics, lastAudioDiagnostic, onAudioDiagnostic, recordAudioDiagnostic, } from '@/lib/audio-diagnostics'
import { micManager } from '@/lib/mic-manager'
import type { NativeAudioOutputReading } from '@/stores/native-shell-store'
import { nativeDeviceApi } from '@/stores/native-shell-store'
import { ambient } from '../alley/RoomsAlley'
import { censusContexts, censusCounts, censusTracks } from './audio-census'
import { contextsLine, hardwareLine, leasesLine, outputLine, roomOutputLine, sessionLine, tracksLine, volumeLine, } from './audio-readout'
import { oneVolumeInRooms, setOneVolumeInRooms } from './room-volume-switch'
import type { DeviceFacts } from './settings/device-facts'
import { loadDeviceFacts } from './settings/device-facts'
import { SettingsGroup, SettingsRow } from './settings/SettingsList'
import { SettingsSwitch } from './settings/SettingsSwitch'
import { playTestTone } from './test-tone'
import { orientationRow, safeInsetsRow } from './viewport-diagnostics'

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

/** Whose a context is, where the panel can tell: the alley's or the rooms'. */
function whose(context: BaseAudioContext): string | null {
  if (context === ambient().context()) return 'alley'
  if (roomOutputIfMade(context) !== null) return 'rooms'
  return null
}

/** The page's session type, and who asked for it (page-audio-session.ts). */
function audioSessionType(): string {
  const type = pageAudioSessionType()
  if (type === null) return 'not available'
  const holders = pageAudioSessionHolders()
  return holders.length === 0 ? type : `${type}, held by ${holders.join(', ')}`
}

/** The app's version and build, the phone and its system, as far as read. */
function appLine(facts: DeviceFacts | null): string {
  return [
    facts?.version ?? 'version not read',
    facts?.model ?? 'model not read',
    facts?.system ?? 'system not read',
  ].join(' · ')
}

export const AudioDiagnosticsPanel: Component = () => {
  const [tick, setTick] = createSignal(0)
  const [toning, setToning] = createSignal(false)
  const [copied, setCopied] = createSignal(false)
  const [report, setReport] = createSignal('')
  const [shareNote, setShareNote] = createSignal('')
  const [facts, setFacts] = createSignal<DeviceFacts | null>(null)
  void loadDeviceFacts().then(setFacts)
  let reportEl: HTMLPreElement | undefined
  let lastClock: number | null = null
  let moving = false
  let startedHere = false
  let copiedTimer: number | undefined

  const [output, setOutput] = createSignal<NativeAudioOutputReading | null>(
    null,
  )
  const phone = nativeDeviceApi()
  const audioOutput = phone?.audioOutput
  if (audioOutput !== undefined) {
    void audioOutput.read().then((reading) => {
      if (reading !== null) setOutput(reading)
    })
    onCleanup(audioOutput.watch(setOutput))
  }

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
      { label: 'Orientation', value: orientationRow() },
      { label: 'Safe insets', value: safeInsetsRow() },
      { label: 'Output', value: outputLine(output(), phone !== null) },
      { label: 'Volume', value: volumeLine(output()) },
      { label: 'Phone session', value: sessionLine(output()) },
      { label: 'Phone audio', value: hardwareLine(output()) },
      {
        label: 'Mic tracks',
        value: tracksLine(censusTracks(), censusCounts(), {
          stream: micManager.getStream() !== null,
          consumers: micManager.getConsumers(),
        }),
      },
      {
        label: 'Contexts',
        value: contextsLine(censusContexts(), censusCounts(), whose),
      },
      { label: 'Shared clock', value: leasesLine(sharedAudioContextOwners()) },
      { label: 'Room output', value: roomOutputLine(roomOutputReadings()) },
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

  /** The report's head: what a reader needs before the first entry. */
  const head = (): string[] => {
    const reading = output()
    const types = reading?.outputs.map((port) => port.type).join(', ') ?? ''
    return [
      `App: ${appLine(facts())}`,
      `App session: ${sessionLine(reading)}`,
      `Outputs: ${outputLine(reading, phone !== null)}${types === '' ? '' : ` (${types})`}`,
      `Page session type: ${audioSessionType()}`,
      `One volume in rooms: ${oneVolumeInRooms() ? 'on' : 'off'}`,
    ]
  }

  const reportText = (): string =>
    formatAudioDiagnostics(
      head(),
      rows().map((r) => `${r.label}: ${r.value}`),
    )

  const share = async (): Promise<void> => {
    const text = reportText()
    setReport(text)
    const shown = await sharePayload({
      title: 'MercuryPitch audio report',
      text,
    })
    setShareNote(shown ? '' : 'No share sheet here. Copy the report instead.')
  }

  const clear = (): void => {
    clearAudioDiagnostics()
    recordAudioDiagnostic('log', 'cleared')
    setReport('')
    setShareNote('')
    redraw()
  }

  const copy = async (): Promise<void> => {
    const text = reportText()
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
      <SettingsGroup>
        <SettingsRow
          id="dev-one-volume-in-rooms"
          label="One volume in rooms"
          sub="A premium room uses iOS's call volume from the door to the way out, so the level no longer changes as the mic opens and closes. Turn it off to compare. Takes effect in the next room you open."
          accessory={
            <SettingsSwitch
              checked={oneVolumeInRooms()}
              label="One volume in rooms"
              testId="dev-one-volume-in-rooms"
              onChange={setOneVolumeInRooms}
            />
          }
        />
      </SettingsGroup>
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
          Every step recorded, the last launch's included, with these rows on
          top.
        </span>
      </button>
      <button
        type="button"
        class="mp-dev__row"
        data-testid="dev-audio-share"
        onClick={() => void share()}
      >
        <span class="mp-dev__row-title">Share report</span>
        <span class="mp-dev__row-sub">
          {shareNote() === ''
            ? 'The same report through the share sheet: Mail, Messages or AirDrop.'
            : shareNote()}
        </span>
      </button>
      <button
        type="button"
        class="mp-dev__row"
        data-testid="dev-audio-clear"
        onClick={clear}
      >
        <span class="mp-dev__row-title">Clear log</span>
        <span class="mp-dev__row-sub">
          Start a scenario with an empty record. The copy kept for the next
          launch goes too.
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

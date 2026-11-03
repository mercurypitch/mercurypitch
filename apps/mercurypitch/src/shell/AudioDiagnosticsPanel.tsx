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
// output (room-output.ts). audio-readout.ts words each of them, and
// audio-report.ts builds the rows and the report, which a test build also
// writes into the console as a Karaoke song starts on AirPlay.
//
// On top, "One volume in rooms" (room-volume-switch.ts): a premium room
// keeps one iOS session, and so one volume, for its whole visit
// (room-visit.ts). Off by default; on to compare.
//
// Registered by the native entry alone, behind VITE_PORTABLE_CONSOLE and
// through a dynamic import (main.tsx), so a store build carries none of it.

import { sharePayload } from '@irchiinnuss/mobile-runtime/platform'
import type { Component } from 'solid-js'
import { createSignal, Index, onCleanup, Show } from 'solid-js'
import { clearAudioDiagnostics, onAudioDiagnostic, recordAudioDiagnostic, } from '@/lib/audio-diagnostics'
import type { NativeAudioOutputReading } from '@/stores/native-shell-store'
import { nativeDeviceApi } from '@/stores/native-shell-store'
import { ambient } from '../alley/RoomsAlley'
import type { ReportFacts, ReportRow } from './audio-report'
import { reportRows, reportText as textOf } from './audio-report'
import { oneVolumeInRooms, setOneVolumeInRooms } from './room-volume-switch'
import type { DeviceFacts } from './settings/device-facts'
import { loadDeviceFacts } from './settings/device-facts'
import { SettingsGroup, SettingsRow } from './settings/SettingsList'
import { SettingsSwitch } from './settings/SettingsSwitch'
import { playTestTone } from './test-tone'

/** How often the rows are read while the screen is open. */
export const POLL_MS = 250
/** The alley's own fade in (RoomsAlley FADE_IN_MS). */
const FADE_MS = 600

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

  /** What the report and the rows are read from, as the screen has it. */
  const at = (): ReportFacts => ({
    facts: facts(),
    output: output(),
    native: phone !== null,
    clockMoving: moving,
  })

  const rows = (): ReportRow[] => {
    tick()
    return reportRows(at())
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

  const reportText = (): string => {
    tick()
    return textOf(at())
  }

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
          sub="On, a premium room uses iOS's call volume from the door to the way out: the level holds as the mic opens and closes, but the room plays quieter. Off, only a take with the mic open uses it. Takes effect in the next room you open."
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

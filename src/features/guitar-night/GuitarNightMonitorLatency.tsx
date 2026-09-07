// ============================================================
// Guitar Night monitor latency — honest, passive route diagnostics
// ============================================================
// Extend the existing room faceplate: monitoring remains the primary action,
// with a compact summary and technical readings behind one disclosure. No
// metric is a physical round trip, and opening this view never activates audio.

import { createSignal, onCleanup, Show } from 'solid-js'
import type { AudioRouteDiagnosticsSnapshot } from '@/lib/audio-route-diagnostics'
import styles from './GuitarNightMonitorLatency.module.css'

interface GuitarNightMonitorLatencyProps {
  snapshot: AudioRouteDiagnosticsSnapshot | null
  monitoring: boolean
}

function milliseconds(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value)
    ? 'Unavailable'
    : `${Math.round(value * 10000) / 10} ms`
}

function setting(value: boolean | null | undefined): string {
  return value == null ? 'Unknown' : value ? 'On' : 'Off'
}

function rate(value: number | null | undefined): string {
  return value == null ? 'Unavailable' : `${value.toLocaleString()} Hz`
}

/** Reads supplied snapshots only; owns no microphone or audio context. */
export function GuitarNightMonitorLatency(
  props: GuitarNightMonitorLatencyProps,
) {
  const [downloadError, setDownloadError] = createSignal(false)
  let reportUrl: string | undefined
  let lastExportTime = 0
  const releaseReport = (): void => {
    if (reportUrl !== undefined) URL.revokeObjectURL(reportUrl)
    reportUrl = undefined
  }
  onCleanup(releaseReport)

  const summary = (): string => {
    if (!props.monitoring) return 'Monitoring off'
    const snapshot = props.snapshot
    if (snapshot === null) return 'Awaiting readings'
    switch (snapshot.context.state) {
      case 'suspended':
        return 'Audio paused'
      case 'interrupted':
        return 'Audio interrupted'
      case 'closed':
        return 'Audio closed'
      case 'unavailable':
        return 'Audio state unavailable'
    }
    if (snapshot.capture.trackState === 'ended') return 'Input ended'
    if (snapshot.capture.trackState === 'unavailable')
      return 'Input unavailable'
    if (snapshot.capture.muted === true) return 'Input muted'
    if (snapshot.context.outputSelection === 'silent') return 'Output is silent'
    const latency = snapshot.context.outputLatencySeconds
    return latency === null
      ? 'Output estimate unavailable'
      : `Output estimate ${milliseconds(latency)}`
  }
  const dropoutSummary = (): string => {
    const playback = props.snapshot?.playback
    if (playback?.underrunCount == null) return 'Unavailable'
    const duration = playback.totalDurationSeconds
    return duration === null
      ? `${playback.underrunCount} total · duration unavailable`
      : `${playback.underrunCount} over ${Math.round(duration)} s`
  }
  const downloadReport = (): void => {
    const snapshot = props.snapshot
    if (snapshot === null) return
    setDownloadError(false)
    try {
      releaseReport()
      // Milliseconds keep ordinary exports distinct; the monotonic fallback
      // also separates two activations within one clock tick.
      lastExportTime = Math.max(Date.now(), lastExportTime + 1)
      const exportedAt = new Date(lastExportTime).toISOString()
      reportUrl = URL.createObjectURL(
        new Blob(
          [
            JSON.stringify(
              {
                schemaVersion: 1,
                kind: 'guitar-monitor-browser-diagnostics',
                exportedAt,
                monitoring: props.monitoring,
                physicalRoundTripMeasured: false,
                snapshot,
              },
              null,
              2,
            ),
          ],
          { type: 'application/json' },
        ),
      )
      const link = document.createElement('a')
      link.href = reportUrl
      link.download = `guitar-monitor-diagnostics_${exportedAt.replace(/[:.]/g, '-')}.json`
      document.body.append(link)
      try {
        link.click()
      } finally {
        link.remove()
      }
    } catch {
      releaseReport()
      setDownloadError(true)
    }
  }

  return (
    <details class={styles.details}>
      <summary>
        <span>Monitoring latency</span>
        <small>{summary()}</small>
      </summary>
      <div class={styles.body}>
        <p class={styles.claim}>Round trip not measured</p>
        <p class={styles.note}>
          These browser estimates do not measure the full delay from playing a
          note to hearing it. Scoring calibration does not make monitoring
          faster.
        </p>
        <Show
          when={props.snapshot}
          fallback={
            <p class={styles.note}>
              Choose Room mic or Direct input, then turn on Listening to inspect
              the audio route. MIDI has no captured audio. Opening this panel
              does not start audio.
            </p>
          }
        >
          {(snapshot) => (
            <>
              <dl class={styles.readings}>
                <div>
                  <dt>Input estimate</dt>
                  <dd>
                    {milliseconds(snapshot().capture.actual.latencySeconds)}
                  </dd>
                </div>
                <div>
                  <dt>Output processing</dt>
                  <dd>{milliseconds(snapshot().context.baseLatencySeconds)}</dd>
                </div>
                <div>
                  <dt>Output device estimate</dt>
                  <dd>
                    {milliseconds(snapshot().context.outputLatencySeconds)}
                  </dd>
                </div>
                <div>
                  <dt>Playback underruns</dt>
                  <dd>{dropoutSummary()}</dd>
                </div>
                <div>
                  <dt>Input / playback rate</dt>
                  <dd>
                    {rate(snapshot().capture.actual.sampleRate)} /{' '}
                    {rate(snapshot().context.sampleRate)}
                  </dd>
                </div>
                <div>
                  <dt>Input channels</dt>
                  <dd>
                    {snapshot().capture.actual.channelCount ?? 'Unavailable'}
                  </dd>
                </div>
                <div>
                  <dt>Output route</dt>
                  <dd>
                    {snapshot().context.outputSelection === 'default'
                      ? 'System default'
                      : snapshot().context.outputSelection === 'explicit'
                        ? 'Selected output'
                        : snapshot().context.outputSelection === 'silent'
                          ? 'Silent output'
                          : 'Unavailable'}
                  </dd>
                </div>
                <div>
                  <dt>Audio state</dt>
                  <dd>{snapshot().context.state}</dd>
                </div>
              </dl>
              <Show
                when={snapshot().capture.monitorChannelMode === 'selected-mono'}
              >
                <p class={styles.note}>
                  Monitoring uses Input{' '}
                  {(snapshot().capture.monitorInputChannel ?? 0) + 1}, mono and
                  centered in both speakers. Pitch detection still checks the
                  original input channels; saved takes stay dry.
                </p>
              </Show>
              <Show
                when={
                  snapshot().capture.monitorChannelMode ===
                    'browser-multichannel' &&
                  (snapshot().capture.actual.channelCount ?? 0) > 1
                }
              >
                <p class={styles.note}>
                  Monitoring uses the browser's channel mix. The strongest
                  channel used for pitch detection may be different.
                </p>
              </Show>
              <Show when={snapshot().capture.deviceMatch === false}>
                <p class={styles.warning}>
                  The active input differs from the requested device. Check your
                  input selection.
                </p>
              </Show>
              <p class={styles.note}>
                Capture processing: echo cancellation{' '}
                {setting(snapshot().capture.actual.echoCancellation)}, noise
                suppression{' '}
                {setting(snapshot().capture.actual.noiseSuppression)}, automatic
                gain {setting(snapshot().capture.actual.autoGainControl)}.
              </p>
              <Show when={snapshot().playback.supported}>
                <p class={styles.note}>
                  Playback estimate: average{' '}
                  {milliseconds(snapshot().playback.averageLatencySeconds)},
                  minimum{' '}
                  {milliseconds(snapshot().playback.minimumLatencySeconds)},
                  maximum{' '}
                  {milliseconds(snapshot().playback.maximumLatencySeconds)}.
                  These latency statistics cover the browser's last-reset period
                  and overlap the output readings above. Underruns cover this
                  audio context's playback history, not just the current route
                  observation.
                </p>
              </Show>
              <Show when={snapshot().issues.length > 0}>
                <p class={styles.note}>
                  Some readings are unavailable. The report includes diagnostic
                  details.
                </p>
              </Show>
              <p class={styles.note}>
                Route observed for {Math.round(snapshot().observationSeconds)}{' '}
                s. Live readings refresh about once a second.
              </p>
            </>
          )}
        </Show>
        <p class={styles.note}>
          For lower latency, use a wired audio interface and check your browser
          and system audio buffer settings. Smaller buffers can feel more
          immediate, but may cause clicks or dropouts. This app requests
          low-latency playback; your browser and audio system choose the actual
          buffers.
        </p>
        <button
          type="button"
          class={styles.download}
          disabled={props.snapshot === null}
          onClick={downloadReport}
        >
          Download report
        </button>
        <p class={styles.note}>
          No audio, device identifiers or uploads. The report contains browser
          estimates, not a latency calibration.
        </p>
        <Show when={downloadError()}>
          <p class={styles.warning} role="status">
            The report could not be downloaded. Try again in a browser that
            supports file downloads.
          </p>
        </Show>
      </div>
    </details>
  )
}

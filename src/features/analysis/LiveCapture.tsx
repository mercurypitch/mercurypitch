// ============================================================
// Live capture view — sing now, see it immediately
//
// The only take that produces metrics in real time. Timbre readouts come from
// the shared TimbreCard so live and offline takes report the same numbers;
// the live-only tiles (intensity, vibrato, stability) are appended to it.
// ============================================================

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { SpectrogramCanvas } from '@/components/SpectrogramCanvas'
import styles from './AnalysisDashboard.module.css'
import { CollapsibleCard } from './CollapsibleCard'
import { StatTile, TimbreCard } from './sections'
import { TakeTrace } from './TakeTrace'
import type { LiveCaptureController } from './use-live-capture'

export const LiveCapture: Component<{ capture: LiveCaptureController }> = (
  props,
) => {
  const snapshot = () => props.capture.snapshot()

  return (
    <>
      <section class={styles.card} data-tour="analysis.live">
        <div class={styles.liveHeader}>
          <Show when={props.capture.isActive()}>
            <span class={styles.liveDot} />
          </Show>
          <h3 class={styles.cardTitle} style={{ margin: 0 }}>
            {props.capture.isActive() ? 'Listening' : 'Live microphone'}
          </h3>
          <Show when={props.capture.isActive()}>
            <span class={styles.badge}>
              {props.capture.samples().length} frames
            </span>
            <span class={styles.badge}>
              {props.capture.elapsed().toFixed(0)}s
            </span>
          </Show>
        </div>

        <Show when={props.capture.error()}>
          <p class={styles.error}>{props.capture.error()}</p>
        </Show>

        <Show when={props.capture.isActive()}>
          <div class={styles.noteReadout}>
            <span class={styles.noteName}>
              {props.capture.currentNote() ?? '—'}
            </span>
            <span class={styles.noteCents}>
              {props.capture.centsOffset() === null
                ? 'listening…'
                : `${props.capture.centsOffset()! > 0 ? '+' : ''}${props.capture
                    .centsOffset()!
                    .toFixed(0)}¢`}
            </span>
          </div>

          <div class={styles.canvasWrap}>
            <SpectrogramCanvas
              magnitudeSpectrum={props.capture.spectrum()}
              isActive={props.capture.isActive()}
            />
          </div>
        </Show>

        <div class={styles.actions} style={{ 'margin-top': '1rem' }}>
          <Show
            when={props.capture.isActive()}
            fallback={
              <button
                type="button"
                data-testid="live-start"
                class={styles.primaryBtn}
                onClick={() => void props.capture.start()}
              >
                Start listening
              </button>
            }
          >
            <button
              type="button"
              data-testid="live-stop"
              class={`${styles.primaryBtn} ${styles.stopBtn}`}
              onClick={() => props.capture.stop()}
            >
              Stop
            </button>
          </Show>
        </div>
      </section>

      {/* Always rendered, even before anything is captured: TakeTrace has its
          own empty state, and a section that only materialises mid-song is
          one the user never learns exists. */}
      <CollapsibleCard
        title="Pitch"
        note="what you just sang"
        storageKey="analysis_open_trace"
        tour="analysis.trace"
      >
        <TakeTrace samples={props.capture.samples()} />
      </CollapsibleCard>

      <Show when={snapshot()}>
        {(snap) => (
          <TimbreCard
            breathiness={snap().breathiness}
            richness={snap().richness}
            resonance={snap().resonance}
            note={
              snap().spectral
                ? 'measured from the spectrum'
                : 'estimated — waiting for spectral frames'
            }
          >
            <StatTile
              label="Intensity"
              value={`${snap().intensity.avgDb} dB`}
              detail={`peak ${snap().intensity.peakDb} dB · range ${
                snap().intensity.dynamicRange
              } dB`}
              tone={snap().intensity.isConsistent ? 'good' : undefined}
            />
            <StatTile
              label="Vibrato"
              value={
                snap().vibrato.detected
                  ? `${snap().vibrato.rateHz.toFixed(1)} Hz`
                  : 'None'
              }
              detail={
                snap().vibrato.detected
                  ? `${snap().vibrato.classification} · ${
                      snap().vibrato.depthCents
                    }¢ deep`
                  : 'hold a note to measure'
              }
              tone={
                snap().vibrato.classification === 'natural' ? 'good' : undefined
              }
            />
            <StatTile
              label="Stability"
              value={
                props.capture.stability() === null
                  ? '—'
                  : `${Math.round(props.capture.stability()!)}%`
              }
              detail="pitch steadiness"
            />
          </TimbreCard>
        )}
      </Show>
    </>
  )
}

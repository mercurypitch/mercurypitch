// ============================================================
// Live capture view — sing now, see it immediately
//
// The only take that produces metrics in real time. Timbre readouts appear
// once the spectral worker has delivered a real frame; until then the
// snapshot is flagged as approximate and the card says so.
// ============================================================

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { SpectrogramCanvas } from '@/components/SpectrogramCanvas'
import styles from './AnalysisDashboard.module.css'
import { StatTile } from './sections'
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

      <Show when={snapshot()}>
        {(snap) => (
          <section class={styles.card} data-tour="analysis.timbre">
            <h3 class={styles.cardTitle}>
              Voice
              <span class={styles.cardNote}>
                {snap().spectral
                  ? 'measured from the spectrum'
                  : 'estimated — waiting for spectral frames'}
              </span>
            </h3>
            <div class={styles.statGrid}>
              <StatTile
                label="Intensity"
                value={`${snap().intensity.avgDb} dB`}
                detail={`peak ${snap().intensity.peakDb} dB · range ${
                  snap().intensity.dynamicRange
                } dB`}
                tone={snap().intensity.isConsistent ? 'good' : undefined}
              />
              <StatTile
                label="Breathiness"
                value={snap().breathiness.quality}
                detail={`HNR ${snap().breathiness.hnrDb} dB`}
                tone={
                  snap().breathiness.quality === 'resonant' ? 'good' : undefined
                }
              />
              <StatTile
                label="Resonance"
                value={snap().resonance.dominantZone}
                detail={`centroid ${Math.round(
                  snap().resonance.spectralCentroid,
                )} Hz`}
              />
              <StatTile
                label="Harmonics"
                value={snap().richness.quality}
                detail={`${snap().richness.richnessScore}/100`}
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
                  snap().vibrato.classification === 'natural'
                    ? 'good'
                    : undefined
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
            </div>
          </section>
        )}
      </Show>
    </>
  )
}

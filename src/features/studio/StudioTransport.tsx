// Studio transport — explicit playback and real sample-peak activity in dBFS.
import { Show } from 'solid-js'
import { Pause, Play, SkipBack } from '@/components/icons'
import styles from './StudioPage.module.css'
import { formatStudioTime } from './timeline/timeline-geometry'

interface StudioTransportProps {
  playing: boolean
  pending: boolean
  playheadFrame: number
  peakL: number
  peakR: number
  hasAudio: boolean
  onToggle(): void
  onStart(): void
}

export function StudioTransport(props: StudioTransportProps) {
  const level = (amplitude: number) =>
    Math.max(
      0,
      Math.min(
        100,
        ((20 * Math.log10(Math.max(1e-6, amplitude)) + 60) / 60) * 100,
      ),
    )
  const peak = () => Math.max(props.peakL, props.peakR)
  return (
    <div class={styles.transport} role="group" aria-label="Song playback">
      <button
        type="button"
        class={styles.iconButton}
        aria-label="Go to start"
        title="Go to start"
        onClick={() => props.onStart()}
      >
        <SkipBack />
      </button>
      <button
        type="button"
        class={styles.playButton}
        disabled={props.pending || !props.hasAudio}
        aria-label={props.playing ? 'Pause song' : 'Play song'}
        title={props.playing ? 'Pause' : 'Play'}
        onClick={() => props.onToggle()}
      >
        <Show when={props.playing} fallback={<Play />}>
          <Pause />
        </Show>
      </button>
      <output class={styles.time} aria-label="Song position">
        {formatStudioTime(props.playheadFrame)}
      </output>
      <div
        class={styles.peak}
        role="meter"
        aria-label="Output sample peak"
        aria-valuemin={-60}
        aria-valuemax={6}
        aria-valuenow={Math.max(
          -60,
          Math.min(6, 20 * Math.log10(Math.max(1e-6, peak()))),
        )}
        aria-valuetext={
          peak() > 0 ? `${(20 * Math.log10(peak())).toFixed(1)} dBFS` : 'Silent'
        }
      >
        <div class={styles.peakBars} aria-hidden="true">
          <i style={{ width: `${level(props.peakL)}%` }} />
          <i style={{ width: `${level(props.peakR)}%` }} />
        </div>
        <span>Peak</span>
      </div>
    </div>
  )
}

// Studio transport — explicit playback, repeat and actual stereo output metering.
import { Show } from 'solid-js'
import { Pause, Play, Repeat, SkipBack } from '@/components/icons'
import type { StudioMeterSnapshot } from '@/lib/studio/metering/stream-meter'
import { StudioOutputMeter } from './audio/StudioOutputMeter'
import styles from './StudioPage.module.css'
import { formatStudioTime } from './timeline/timeline-geometry'

interface StudioTransportProps {
  playing: boolean
  pending: boolean
  playheadFrame: number
  peakL: number
  peakR: number
  meter: StudioMeterSnapshot | null
  meterReady: boolean
  onResetPeakHold(): void
  hasAudio: boolean
  repeating: boolean
  onRepeat(): void
  onToggle(): void
  onStart(): void
}

export function StudioTransport(props: StudioTransportProps) {
  return (
    <div
      class={styles.transport}
      role="group"
      aria-label="Song playback"
      data-tour="studio.transport"
    >
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
      <button
        type="button"
        class={styles.iconButton}
        aria-label="Repeat song"
        title="Repeat song"
        aria-pressed={props.repeating}
        disabled={!props.hasAudio || props.pending}
        onClick={() => props.onRepeat()}
      >
        <Repeat size={18} />
      </button>
      <output class={styles.time} aria-label="Song position">
        {formatStudioTime(props.playheadFrame)}
      </output>
      <StudioOutputMeter
        compact
        snapshot={props.meter}
        ready={props.meterReady}
        peakL={props.peakL}
        peakR={props.peakR}
        onReset={props.onResetPeakHold}
      />
    </div>
  )
}

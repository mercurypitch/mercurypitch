// ============================================================
// Voice Playback Transport — one stable play and scrub rail across voice history
// ============================================================

import type { JSX } from 'solid-js'
import { Pause, Play } from '@/components/icons'
import type { VoiceTakeRecord } from '@/db/entities'
import styles from './VoicePlaybackTransport.module.css'

export interface VoicePlaybackTransportProps {
  take: VoiceTakeRecord | null
  activeId: string | null
  progress: number
  playing: boolean
  eyebrow: string
  tone?: 'earlier' | 'later' | 'neutral'
  compact?: boolean
  actions?: JSX.Element
  onPlay: (takeId: string) => void
  onSeek: (takeId: string, progress: number) => void
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function formatClock(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds))
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`
}

export function VoicePlaybackTransport(
  props: VoicePlaybackTransportProps,
): JSX.Element {
  const active = (): boolean => props.take?.id === props.activeId
  const currentProgress = (): number => (active() ? clamp01(props.progress) : 0)
  const durationSeconds = (): number => (props.take?.durationMs ?? 0) / 1000
  const currentSeconds = (): number => currentProgress() * durationSeconds()

  return (
    <div
      class={styles.transport}
      classList={{
        [styles.compact]: props.compact === true,
        [styles.earlier]: props.tone === 'earlier',
        [styles.later]: props.tone === 'later',
      }}
      aria-label="Voice playback controls"
    >
      <button
        type="button"
        class={styles.playButton}
        disabled={props.take === null}
        aria-label={`${active() && props.playing ? 'Pause' : 'Play'} ${props.take?.title ?? 'selected take'}`}
        aria-pressed={active() && props.playing}
        aria-keyshortcuts={active() && props.playing ? 'Space' : undefined}
        onClick={() => {
          const id = props.take?.id
          if (id !== undefined) props.onPlay(id)
        }}
      >
        {active() && props.playing ? <Pause /> : <Play />}
      </button>

      <div class={styles.identity}>
        <span>{props.eyebrow}</span>
        <strong>{props.take?.title ?? 'Choose a take'}</strong>
      </div>

      <time class={styles.elapsed}>{formatClock(currentSeconds())}</time>
      <input
        class={styles.scrubber}
        type="range"
        min="0"
        max="1000"
        step="1"
        value={Math.round(currentProgress() * 1000)}
        disabled={props.take === null}
        aria-label={`Seek ${props.take?.title ?? 'selected take'}`}
        aria-valuetext={`${formatClock(currentSeconds())} of ${formatClock(durationSeconds())}`}
        style={{ '--transport-progress': `${currentProgress() * 100}%` }}
        onInput={(event) => {
          const id = props.take?.id
          if (id !== undefined) {
            props.onSeek(id, Number(event.currentTarget.value) / 1000)
          }
        }}
      />
      <time class={styles.duration}>{formatClock(durationSeconds())}</time>

      {props.actions === undefined ? null : (
        <div class={styles.actions}>{props.actions}</div>
      )}
    </div>
  )
}

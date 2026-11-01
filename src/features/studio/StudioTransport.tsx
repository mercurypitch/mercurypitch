// Studio transport — explicit playback, repeat, a typed clock and actual stereo output metering.
import type { JSX } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { Repeat } from '@/components/icons'
import { publishFootSpace } from '@/lib/foot-space'
import type { StudioMeterSnapshot } from '@/lib/studio/metering/stream-meter'
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'
import { StudioOutputMeter } from './audio/StudioOutputMeter'
import { PauseFilled, PlayFilled, SkipBackFilled } from './studio-icons'
import styles from './StudioPage.module.css'
import { formatStudioTime, parseStudioTime } from './timeline/timeline-geometry'

interface StudioTransportProps {
  /** Publish this bar's height under that name, when it is docked at the foot. */
  footSpace?: string
  playing: boolean
  pending: boolean
  playheadFrame: number
  /** The last frame the clock may seek to. */
  endFrame: number
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
  onSeek(frame: number): void
  /** The record button, beside Play. */
  record?: JSX.Element
}

export function StudioTransport(props: StudioTransportProps) {
  // While typing, the clock holds the draft; otherwise it follows the playhead.
  // Focus freezes the time it showed, so a playing song cannot rewrite the
  // selected text under the first keystroke.
  const [draft, setDraft] = createSignal<string | null>(null)
  let focusedText: string | null = null
  const seek = (seconds: number) =>
    props.onSeek(
      Math.round(
        Math.max(0, Math.min(props.endFrame / STUDIO_SAMPLE_RATE, seconds)) *
          STUDIO_SAMPLE_RATE,
      ),
    )

  function commit(input: HTMLInputElement): void {
    const text = draft()
    setDraft(null)
    if (text === null || text === focusedText) return
    const seconds = parseStudioTime(text)
    if (seconds !== null) seek(seconds)
    input.value = formatStudioTime(props.playheadFrame)
  }

  return (
    <div
      ref={(el) => {
        if (props.footSpace !== undefined) publishFootSpace(el, props.footSpace)
      }}
      class={styles.transport}
      role="group"
      aria-label="Song playback"
      data-tour="studio.transport"
    >
      <button
        type="button"
        class={styles.iconButton}
        aria-label="Go to start"
        title="Go to start (Home)"
        onClick={() => props.onStart()}
      >
        <SkipBackFilled size={18} />
      </button>
      <button
        type="button"
        class={styles.playButton}
        disabled={props.pending || !props.hasAudio}
        aria-label={props.playing ? 'Pause song' : 'Play song'}
        title={props.playing ? 'Pause (Space)' : 'Play (Space)'}
        onClick={() => props.onToggle()}
      >
        <Show when={props.playing} fallback={<PlayFilled />}>
          <PauseFilled />
        </Show>
      </button>
      {props.record}
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
      {/* The clock changes on every tick. Its box is not the bar's flex
          item, so a new time lays out only the clock. */}
      <span class={styles.clockBox}>
        <input
          class={styles.clock}
          type="text"
          role="spinbutton"
          inputMode="decimal"
          autocomplete="off"
          spellcheck={false}
          aria-label="Playhead in seconds"
          aria-valuemin={0}
          aria-valuemax={props.endFrame / STUDIO_SAMPLE_RATE}
          aria-valuenow={props.playheadFrame / STUDIO_SAMPLE_RATE}
          aria-valuetext={formatStudioTime(props.playheadFrame)}
          title="Type a time, such as 1:05.5 or 65.5"
          value={draft() ?? formatStudioTime(props.playheadFrame)}
          onFocus={(event) => {
            focusedText = formatStudioTime(props.playheadFrame)
            setDraft(focusedText)
            event.currentTarget.value = focusedText
            event.currentTarget.select()
          }}
          onBlur={() => {
            focusedText = null
            setDraft(null)
          }}
          onInput={(event) => setDraft(event.currentTarget.value)}
          onChange={(event) => commit(event.currentTarget)}
          onKeyDown={(event) => {
            const input = event.currentTarget
            if (event.key === 'Enter') {
              event.preventDefault()
              commit(input)
            } else if (event.key === 'Escape' && draft() !== focusedText) {
              event.preventDefault()
              event.stopPropagation()
              focusedText = formatStudioTime(props.playheadFrame)
              setDraft(focusedText)
              input.value = focusedText
              input.select()
            } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault()
              focusedText = null
              setDraft(null)
              const step = event.shiftKey ? 0.1 : 1
              seek(
                props.playheadFrame / STUDIO_SAMPLE_RATE +
                  (event.key === 'ArrowUp' ? step : -step),
              )
            }
          }}
        />
      </span>
      <output
        class={`${styles.srOnly} ${styles.livePosition}`}
        aria-label="Song position"
        aria-live="off"
      >
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

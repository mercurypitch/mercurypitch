// A native, keyboard-accessible take timeline seeks the shared audition clock in seconds.
import { batch, createEffect, createSignal } from 'solid-js'
import { recordingTime } from './GuitarRecordingControls'
import styles from './GuitarRecordingTimeline.module.css'
import type { GuitarRecordingPlayback } from './useGuitarRecordingPlayback'

export function GuitarRecordingTimeline(props: {
  playback: Pick<GuitarRecordingPlayback, 'position' | 'duration' | 'seek'>
  disabled?: boolean
}) {
  const [preview, setPreview] = createSignal<number | null>(null)
  let pointerChanged = false
  const position = () => preview() ?? props.playback.position()
  const disabled = () =>
    props.disabled === true || props.playback.duration() <= 0
  createEffect(() => {
    if (disabled()) setPreview(null)
  })
  const commit = (input: HTMLInputElement) => {
    // Canceled edits and duplicate native changes cannot restart the audio.
    if (preview() === null || disabled()) return
    const seconds = Number(input.value)
    batch(() => {
      props.playback.seek(seconds)
      setPreview(null)
    })
  }
  return (
    <div class={styles.timeline}>
      <output aria-label="Playback position">
        {recordingTime(position())}
      </output>
      <input
        type="range"
        min="0"
        max={props.playback.duration()}
        step="0.01"
        value={position()}
        aria-label="Take position"
        aria-valuetext={`${position().toFixed(1)} of ${props.playback.duration().toFixed(1)} seconds`}
        data-testid="guitar-recording-timeline"
        disabled={disabled()}
        style={{
          '--take-progress': `${props.playback.duration() > 0 ? (position() / props.playback.duration()) * 100 : 0}%`,
        }}
        onPointerDown={(event) => {
          if (disabled()) return
          pointerChanged = false
          setPreview(Number(event.currentTarget.value))
        }}
        onInput={(event) => {
          if (disabled()) return
          pointerChanged = true
          setPreview(Number(event.currentTarget.value))
        }}
        onChange={(event) => commit(event.currentTarget)}
        onPointerUp={() => {
          // Native change commits pointer and keyboard edits once. Keep a
          // changed range value stable if pointerup arrives before change.
          if (!pointerChanged) setPreview(null)
        }}
        onPointerCancel={() => setPreview(null)}
        onBlur={() => setPreview(null)}
      />
      <span>{recordingTime(props.playback.duration())}</span>
    </div>
  )
}

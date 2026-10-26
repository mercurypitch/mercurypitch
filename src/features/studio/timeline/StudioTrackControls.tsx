// Studio track controls — native accessible sliders commit only completed changes.
import { createEffect, createSignal, Show } from 'solid-js'
import { Volume2, VolumeX } from '@/components/icons'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioTrack } from '@/lib/studio/model/types'
import styles from './StudioTimeline.module.css'

export interface StudioTrackControlsProps {
  track: StudioTrack
  writable: boolean
  compact?: boolean
  tablet?: boolean
  onCommand(command: StudioCommand): boolean
}

export function studioPanLabel(pan: number): string {
  return Math.abs(pan) < 0.005
    ? 'C'
    : `${pan < 0 ? 'L' : 'R'}${Math.round(Math.abs(pan) * 100)}`
}

export function StudioTrackControls(props: StudioTrackControlsProps) {
  const [gain, setGain] = createSignal(0)
  const [pan, setPan] = createSignal(0)
  const [editing, setEditing] = createSignal<'gainDb' | 'pan' | null>(null)
  createEffect(() => {
    if (editing() !== 'gainDb') setGain(props.track.gainDb)
  })
  createEffect(() => {
    if (editing() !== 'pan') setPan(props.track.pan)
  })

  function update(
    changes: Partial<Pick<StudioTrack, 'gainDb' | 'pan' | 'mute' | 'solo'>>,
  ): void {
    if (props.writable)
      props.onCommand({
        type: 'update-track',
        trackId: props.track.id,
        changes,
      })
  }

  function cancel(): void {
    setEditing(null)
    setGain(props.track.gainDb)
    setPan(props.track.pan)
  }
  createEffect(() => {
    if (!props.writable) cancel()
  })

  function commit(kind: 'gainDb' | 'pan', value: number): void {
    if (!Number.isFinite(value)) {
      cancel()
      return
    }
    update({ [kind]: value })
    setEditing(null)
    setGain(props.track.gainDb)
    setPan(props.track.pan)
  }

  function PanSlider() {
    return (
      <label class={styles.pan}>
        <span>Pan {studioPanLabel(pan())}</span>
        <input
          aria-label={`${props.track.name} pan`}
          type="range"
          min="-1"
          max="1"
          step="0.01"
          value={pan()}
          disabled={!props.writable}
          aria-valuetext={
            pan() === 0
              ? 'Centre'
              : `${Math.round(Math.abs(pan()) * 100)} percent ${pan() < 0 ? 'left' : 'right'}`
          }
          onInput={(event) => {
            setEditing('pan')
            setPan(event.currentTarget.valueAsNumber)
          }}
          onChange={(event) => commit('pan', event.currentTarget.valueAsNumber)}
          onPointerCancel={cancel}
        />
      </label>
    )
  }

  return (
    <div
      class={styles.controls}
      classList={{ [styles.compactControls]: props.compact === true }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && editing() !== null) {
          event.preventDefault()
          event.stopPropagation()
          cancel()
        }
      }}
    >
      <button
        type="button"
        class={styles.mixButton}
        disabled={!props.writable}
        title={`${props.track.mute ? 'Unmute' : 'Mute'} ${props.track.name}`}
        aria-label={`${props.track.mute ? 'Unmute' : 'Mute'} ${props.track.name}`}
        aria-pressed={props.track.mute}
        onClick={() => update({ mute: !props.track.mute })}
      >
        <Show when={props.track.mute} fallback={<Volume2 />}>
          <VolumeX />
        </Show>
      </button>
      <button
        type="button"
        class={styles.mixButton}
        disabled={!props.writable}
        title={`Solo ${props.track.name}`}
        aria-label={`Solo ${props.track.name}`}
        aria-pressed={props.track.solo}
        onClick={() => update({ solo: !props.track.solo })}
      >
        S
      </button>
      <label class={styles.volume}>
        <span class={styles.srOnly}>{props.track.name} volume</span>
        <input
          aria-label={`${props.track.name} volume`}
          type="range"
          min="-60"
          max="24"
          step="0.5"
          value={gain()}
          disabled={!props.writable}
          aria-valuetext={`${gain().toFixed(1)} dB`}
          onInput={(event) => {
            setEditing('gainDb')
            setGain(event.currentTarget.valueAsNumber)
          }}
          onChange={(event) =>
            commit('gainDb', event.currentTarget.valueAsNumber)
          }
          onPointerCancel={cancel}
        />
        <output>{gain().toFixed(1)} dB</output>
      </label>
      <Show when={props.tablet === true} fallback={<PanSlider />}>
        <details class={styles.panDisclosure}>
          <summary aria-label={`${props.track.name} pan controls`}>
            Pan {studioPanLabel(pan())}
          </summary>
          <PanSlider />
        </details>
      </Show>
    </div>
  )
}

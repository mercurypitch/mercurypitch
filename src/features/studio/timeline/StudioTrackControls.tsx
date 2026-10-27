// Studio track controls — the lane's name beside mute and solo, then a fader and a pan knob; only completed changes commit.
import type { JSX } from 'solid-js'
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
  /** The lane's name and source, laid out in the same grid as the controls. */
  identity?: JSX.Element
  onCommand(command: StudioCommand): boolean
}

const GAIN_MIN = -60
const GAIN_MAX = 24
// The pan ring: radius 13, with 270 of its 360 degrees drawn.
const KNOB_RING = 2 * Math.PI * 13
const KNOB_TRAVEL = (270 / 360) * KNOB_RING

export function studioPanLabel(pan: number): string {
  return Math.abs(pan) < 0.005
    ? 'C'
    : `${pan < 0 ? 'L' : 'R'}${Math.round(Math.abs(pan) * 100)}`
}

const gainPercent = (db: number) =>
  ((Math.max(GAIN_MIN, Math.min(GAIN_MAX, db)) - GAIN_MIN) /
    (GAIN_MAX - GAIN_MIN)) *
  100

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
    if (value !== props.track[kind]) update({ [kind]: value })
    setEditing(null)
    setGain(props.track.gainDb)
    setPan(props.track.pan)
  }

  // The knob is a drawing over a native range: keys and assistive tech use
  // the input, a pointer drags vertically like a hardware knob.
  let panInput: HTMLInputElement | undefined
  let drag: { pointer: number; y: number; from: number } | null = null
  const [turning, setTurning] = createSignal(false)
  const angle = () => pan() * 135

  function knobDown(event: PointerEvent): void {
    if (!props.writable || event.button !== 0) return
    event.preventDefault()
    panInput?.focus({ preventScroll: true })
    drag = { pointer: event.pointerId, y: event.clientY, from: pan() }
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    setEditing('pan')
    setTurning(true)
  }

  function knobMove(event: PointerEvent): void {
    if (drag?.pointer !== event.pointerId) return
    const travel = event.shiftKey ? 600 : 150
    const next = drag.from + (drag.y - event.clientY) / travel
    setPan(Math.round(Math.max(-1, Math.min(1, next)) * 100) / 100)
  }

  function knobUp(event: PointerEvent): void {
    if (drag?.pointer !== event.pointerId) return
    drag = null
    setTurning(false)
    commit('pan', pan())
  }

  return (
    <div
      class={styles.controls}
      data-tour="studio.track-controls"
      classList={{
        [styles.compactControls]: props.compact === true,
        [styles.touchControls]: props.compact === true || props.tablet === true,
        [styles.withIdentity]: props.identity !== undefined,
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && editing() !== null) {
          event.preventDefault()
          event.stopPropagation()
          cancel()
        }
      }}
    >
      <Show when={props.identity}>
        <div class={styles.identityCell}>{props.identity}</div>
      </Show>
      <button
        type="button"
        class={`${styles.mixButton} ${styles.muteButton}`}
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
        class={`${styles.mixButton} ${styles.soloButton}`}
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
          class={styles.fader}
          aria-label={`${props.track.name} volume`}
          type="range"
          min={GAIN_MIN}
          max={GAIN_MAX}
          step="0.5"
          value={gain()}
          disabled={!props.writable}
          title="Double-click for 0 dB"
          style={{
            '--fill': `${gainPercent(gain())}%`,
            '--unity': `${gainPercent(0)}%`,
          }}
          aria-valuetext={`${gain().toFixed(1)} dB`}
          onInput={(event) => {
            setEditing('gainDb')
            setGain(event.currentTarget.valueAsNumber)
          }}
          onChange={(event) =>
            commit('gainDb', event.currentTarget.valueAsNumber)
          }
          onDblClick={() => {
            if (props.writable) commit('gainDb', 0)
          }}
          onPointerCancel={cancel}
        />
        <output class={styles.gainValue}>{gain().toFixed(1)} dB</output>
      </label>
      <span
        class={styles.knob}
        classList={{ [styles.knobTurning]: turning() }}
        title={`Pan ${studioPanLabel(pan())}. Drag up or down; double-click to centre.`}
        onPointerDown={knobDown}
        onPointerMove={knobMove}
        onPointerUp={knobUp}
        onPointerCancel={() => {
          drag = null
          setTurning(false)
          cancel()
        }}
        onDblClick={() => {
          if (props.writable) commit('pan', 0)
        }}
      >
        <input
          ref={panInput}
          class={styles.knobInput}
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
        />
        <svg class={styles.knobDial} viewBox="0 0 32 32" aria-hidden="true">
          <circle class={styles.knobFace} cx="16" cy="16" r="9" />
          <circle
            class={styles.knobArc}
            cx="16"
            cy="16"
            r="13"
            style={{ 'stroke-dasharray': `${KNOB_TRAVEL} ${KNOB_RING}` }}
          />
          <circle
            class={styles.knobValueArc}
            cx="16"
            cy="16"
            r="13"
            style={{
              transform: `rotate(${-90 + Math.min(0, angle())}deg)`,
              'stroke-dasharray': `${(Math.abs(angle()) / 360) * KNOB_RING} ${KNOB_RING}`,
            }}
          />
          <line
            class={styles.knobPointer}
            x1="16"
            y1="16"
            x2="16"
            y2="9"
            style={{ transform: `rotate(${angle()}deg)` }}
          />
        </svg>
        <span class={styles.panValue} aria-hidden="true">
          {studioPanLabel(pan())}
        </span>
      </span>
    </div>
  )
}

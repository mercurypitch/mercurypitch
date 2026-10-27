// Studio track controls — the lane's name beside mute and solo, then a fader and a pan knob; a moving control is heard at once and saves as one edit when it stops.
import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, Show, untrack, } from 'solid-js'
import { Volume2, VolumeX } from '@/components/icons'
import { createStudioKeyBurst } from '@/features/studio/mix/key-burst'
import { useStudioLiveMix } from '@/features/studio/mix/live-mix'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioTrack } from '@/lib/studio/model/types'
import styles from './StudioTimeline.module.css'

export interface StudioTrackControlsProps {
  track: StudioTrack
  writable: boolean
  compact?: boolean
  tablet?: boolean
  /** A mixing desk channel strip: a vertical fader between the knob and the buttons. */
  strip?: boolean
  /** The lane's name and source, laid out in the same grid as the controls. */
  identity?: JSX.Element
  /** Silent because another lane is soloed: Mute shows it, unpressed. */
  soloedOut?: boolean
  onCommand(command: StudioCommand): boolean
}

/**
 * The fader's travel. A song may store up to +24 dB, from before the fader
 * stopped at +12: such a lane shows its cap at the top and its true value.
 */
export const STUDIO_FADER_MIN_DB = -60
export const STUDIO_FADER_MAX_DB = 12
const FADER_STEP_DB = 0.5
// A press that moves less than this is a click, not a drag.
const DEAD_ZONE = 3
// Shift moves a fader or the knob a quarter as far, for fine work.
const FINE = 0.25
// Pixels of vertical drag per unit of pan, so 300 for left to right.
const PAN_PIXELS = 150
// The pan ring: radius 13, with 270 of its 360 degrees drawn.
const KNOB_RING = 2 * Math.PI * 13
// A strip's fader is labelled at 0 dB and every 12 dB, like its ladder marks.
const FADER_MARKS = [12, 0, -12, -24, -36, -48, -60]
const KNOB_TRAVEL = (270 / 360) * KNOB_RING

type MixKind = 'gainDb' | 'pan'

export function studioPanLabel(pan: number): string {
  return Math.abs(pan) < 0.005
    ? 'C'
    : `${pan < 0 ? 'L' : 'R'}${Math.round(Math.abs(pan) * 100)}`
}

const clampGain = (db: number) =>
  Math.max(STUDIO_FADER_MIN_DB, Math.min(STUDIO_FADER_MAX_DB, db))
const clampPan = (pan: number) => Math.max(-1, Math.min(1, pan))
const gainPercent = (db: number) =>
  ((clampGain(db) - STUDIO_FADER_MIN_DB) /
    (STUDIO_FADER_MAX_DB - STUDIO_FADER_MIN_DB)) *
  100

/** A drag in progress: values move by how far the pointer travels, never to where it is. */
interface MixDrag {
  readonly pointer: number
  readonly start: number
  last: number
  value: number
  moved: boolean
}

export function StudioTrackControls(props: StudioTrackControlsProps) {
  const live = useStudioLiveMix()
  const draft = createMemo(() => live.lane(props.track.id))
  const gain = () => draft()?.gainDb ?? props.track.gainDb
  const pan = () => draft()?.pan ?? props.track.pan
  const [moving, setMoving] = createSignal<MixKind | null>(null)
  const bursts = {
    gainDb: createStudioKeyBurst(() => commitDraft('gainDb')),
    pan: createStudioKeyBurst(() => commitDraft('pan')),
  }
  let faderInput: HTMLInputElement | undefined
  let panInput: HTMLInputElement | undefined
  let faderDrag: (MixDrag & { readonly perPixel: number }) | null = null
  let knobDrag: MixDrag | null = null

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

  /** Heard at once through the live mix; saved only by commit. */
  function preview(kind: MixKind, value: number): void {
    live.setLane(props.track.id, {
      ...live.lane(props.track.id),
      [kind]: value,
    })
  }

  function release(kind: MixKind): void {
    const current = live.lane(props.track.id)
    if (current?.[kind] === undefined) return
    const rest = { ...current }
    delete rest[kind]
    live.setLane(
      props.track.id,
      rest.gainDb === undefined && rest.pan === undefined ? null : rest,
    )
  }

  // The command first, then the preview ends: the song never hears the old value.
  function commit(kind: MixKind, value: number): void {
    bursts[kind].cancel()
    if (Number.isFinite(value) && value !== props.track[kind])
      update({ [kind]: value })
    release(kind)
  }

  function commitDraft(kind: MixKind): void {
    const value = live.lane(props.track.id)?.[kind]
    if (value !== undefined) commit(kind, value)
  }

  function cancel(): void {
    faderDrag = null
    knobDrag = null
    setMoving(null)
    bursts.gainDb.cancel()
    bursts.pan.cancel()
    release('gainDb')
    release('pan')
  }
  createEffect(() => {
    if (!props.writable) untrack(cancel)
  })

  function capture(event: PointerEvent): void {
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  // The fader's native range takes the keys and the screen reader; a pointer
  // anywhere on the fader drags it from where it is, so a click moves nothing.
  const along = (event: PointerEvent) =>
    props.strip === true ? -event.clientY : event.clientX

  function faderDown(event: PointerEvent): void {
    if (!props.writable || event.button !== 0 || !faderInput) return
    event.preventDefault()
    faderInput.focus({ preventScroll: true })
    bursts.gainDb.flush()
    const box = faderInput.getBoundingClientRect()
    const cap =
      Number.parseFloat(
        window.getComputedStyle(faderInput).getPropertyValue('--cap'),
      ) || 12
    const travel = (props.strip === true ? box.height : box.width) - cap
    faderDrag = {
      pointer: event.pointerId,
      start: along(event),
      last: along(event),
      value: clampGain(gain()),
      perPixel:
        (STUDIO_FADER_MAX_DB - STUDIO_FADER_MIN_DB) / Math.max(travel, 40),
      moved: false,
    }
    capture(event)
  }

  function faderMove(event: PointerEvent): void {
    const drag = faderDrag
    if (drag?.pointer !== event.pointerId) return
    const at = along(event)
    if (!drag.moved && Math.abs(at - drag.start) < DEAD_ZONE) return
    drag.moved = true
    setMoving('gainDb')
    const scale = event.shiftKey ? FINE : 1
    drag.value = clampGain(
      drag.value + (at - drag.last) * drag.perPixel * scale,
    )
    drag.last = at
    const next = Math.round(drag.value / FADER_STEP_DB) * FADER_STEP_DB
    if (next !== gain()) preview('gainDb', next)
  }

  function faderUp(event: PointerEvent): void {
    const drag = faderDrag
    if (drag?.pointer !== event.pointerId) return
    faderDrag = null
    setMoving(null)
    if (drag.moved) commitDraft('gainDb')
  }

  function faderCancel(event: PointerEvent): void {
    if (faderDrag?.pointer !== event.pointerId) return
    faderDrag = null
    setMoving(null)
    release('gainDb')
  }

  // The knob is a drawing over a native range: keys and assistive tech use
  // the input, a pointer drags vertically like a hardware knob.
  const angle = () => pan() * 135

  function knobDown(event: PointerEvent): void {
    if (!props.writable || event.button !== 0) return
    event.preventDefault()
    panInput?.focus({ preventScroll: true })
    bursts.pan.flush()
    knobDrag = {
      pointer: event.pointerId,
      start: event.clientY,
      last: event.clientY,
      value: pan(),
      moved: false,
    }
    capture(event)
    setMoving('pan')
  }

  function knobMove(event: PointerEvent): void {
    const drag = knobDrag
    if (drag?.pointer !== event.pointerId) return
    const scale = event.shiftKey ? FINE : 1
    drag.value = clampPan(
      drag.value + ((drag.last - event.clientY) / PAN_PIXELS) * scale,
    )
    drag.last = event.clientY
    const next = Math.round(drag.value * 100) / 100
    if (next !== pan()) preview('pan', next)
  }

  function knobUp(event: PointerEvent): void {
    if (knobDrag?.pointer !== event.pointerId) return
    knobDrag = null
    setMoving(null)
    commitDraft('pan')
  }

  function knobCancel(event: PointerEvent): void {
    if (knobDrag?.pointer !== event.pointerId) return
    knobDrag = null
    setMoving(null)
    release('pan')
  }

  /** A native range moved by a key or assistive tech. */
  function rangeInput(kind: MixKind, value: number): void {
    if (Number.isFinite(value)) preview(kind, value)
  }

  // A key press joins its burst and saves with it; any other change, such as
  // a screen reader's step, saves at once.
  function rangeChange(kind: MixKind): void {
    if (bursts[kind].active()) bursts[kind].moved()
    else commitDraft(kind)
  }

  const muteButton = () => (
    <button
      type="button"
      class={`${styles.mixButton} ${styles.muteButton}`}
      disabled={!props.writable}
      title={`${props.track.mute ? 'Unmute' : 'Mute'} ${props.track.name}${
        props.soloedOut === true && !props.track.mute
          ? '. Silent while another lane is soloed.'
          : ''
      }`}
      aria-label={`${props.track.mute ? 'Unmute' : 'Mute'} ${props.track.name}`}
      aria-pressed={props.track.mute}
      data-soloed-out={
        props.soloedOut === true && !props.track.mute ? '' : undefined
      }
      onClick={() => update({ mute: !props.track.mute })}
    >
      <Show when={props.track.mute} fallback={<Volume2 />}>
        <VolumeX />
      </Show>
    </button>
  )
  const soloButton = () => (
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
  )
  const volume = () => (
    <div
      class={styles.volume}
      classList={{ [styles.faderMoving]: moving() === 'gainDb' }}
      title="Drag to set the volume. Double-click for 0 dB."
      onPointerDown={faderDown}
      onPointerMove={faderMove}
      onPointerUp={faderUp}
      onLostPointerCapture={faderUp}
      onPointerCancel={faderCancel}
      onDblClick={() => {
        if (props.writable) commit('gainDb', 0)
      }}
    >
      <input
        ref={faderInput}
        class={styles.fader}
        data-studio-fader
        aria-label={`${props.track.name} volume`}
        type="range"
        min={STUDIO_FADER_MIN_DB}
        max={STUDIO_FADER_MAX_DB}
        step={FADER_STEP_DB}
        value={clampGain(gain())}
        disabled={!props.writable}
        style={{
          '--fill': `${gainPercent(gain())}%`,
          '--unity': `${gainPercent(0)}%`,
        }}
        aria-valuetext={`${gain().toFixed(1)} dB`}
        onKeyDown={(event) => bursts.gainDb.keyDown(event)}
        onInput={(event) =>
          rangeInput('gainDb', event.currentTarget.valueAsNumber)
        }
        onChange={() => rangeChange('gainDb')}
        onBlur={() => bursts.gainDb.flush()}
      />
      <Show when={props.strip === true}>
        <span class={styles.faderScale} aria-hidden="true">
          <For each={FADER_MARKS}>
            {(db) => (
              <span style={{ '--at': String(gainPercent(db) / 100) }}>
                {db > 0 ? `+${db}` : db < 0 ? `\u2212${-db}` : '0'}
              </span>
            )}
          </For>
        </span>
      </Show>
      <output class={styles.gainValue}>{gain().toFixed(1)} dB</output>
    </div>
  )
  const knob = () => (
    <span
      class={styles.knob}
      classList={{ [styles.knobTurning]: moving() === 'pan' }}
      title={`Pan ${studioPanLabel(pan())}. Drag up or down; double-click to centre.`}
      onPointerDown={knobDown}
      onPointerMove={knobMove}
      onPointerUp={knobUp}
      onLostPointerCapture={knobUp}
      onPointerCancel={knobCancel}
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
        onKeyDown={(event) => bursts.pan.keyDown(event)}
        onInput={(event) =>
          rangeInput('pan', event.currentTarget.valueAsNumber)
        }
        onChange={() => rangeChange('pan')}
        onBlur={() => bursts.pan.flush()}
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
  )

  return (
    <div
      class={styles.controls}
      data-tour={props.strip === true ? undefined : 'studio.track-controls'}
      data-silent={
        props.track.mute || props.soloedOut === true ? '' : undefined
      }
      classList={{
        [styles.compactControls]: props.compact === true,
        [styles.touchControls]: props.compact === true || props.tablet === true,
        [styles.withIdentity]: props.identity !== undefined,
        [styles.stripControls]: props.strip === true,
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && draft() !== undefined) {
          event.preventDefault()
          event.stopPropagation()
          cancel()
        }
      }}
    >
      <Show when={props.identity}>
        <div class={styles.identityCell}>{props.identity}</div>
      </Show>
      {/* A desk strip reads top to bottom: pan, the fader, then mute and solo. */}
      <Show
        when={props.strip === true}
        fallback={
          <>
            {muteButton()}
            {soloButton()}
            {volume()}
            {knob()}
          </>
        }
      >
        {knob()}
        {volume()}
        <div class={styles.stripButtons}>
          {muteButton()}
          {soloButton()}
        </div>
      </Show>
    </div>
  )
}

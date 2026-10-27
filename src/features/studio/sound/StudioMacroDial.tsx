// ============================================================
// Studio macro dial — a Sound macro as a centre-zero knob
// ============================================================
//
// The same control as the Sound panel's slider (`createStudioMacroDraft`),
// drawn as a knob for the mixing desk. A native range under the drawing takes
// the keys and the screen reader; a pointer drags up or down, Shift for fine
// steps, and a double-click returns it to the centre. Only a finished
// gesture saves, as one undoable change.
import { createSignal } from 'solid-js'
import type { StudioSoundEdit } from '@/lib/studio/model/sound-commands'
import type { StudioProject } from '@/lib/studio/model/types'
import type { MacroKey } from '@/lib/studio-fx/mix-macros'
import { MACRO_LABELS } from '@/lib/studio-fx/mix-macros'
import { createStudioMacroDraft, studioMacroValueText } from './macro-draft'
import styles from './StudioMacroDial.module.css'

interface StudioMacroDialProps {
  name: MacroKey
  project: StudioProject
  writable: boolean
  onCommand(command: StudioSoundEdit): boolean
}

// The ring: radius 18, with 270 of its 360 degrees drawn.
const RING = 2 * Math.PI * 18
const TRAVEL = (270 / 360) * RING
// The focus ring: radius 23 (clear of the zero mark), 240 degrees, ending
// above the end words.
const FOCUS_RING = 2 * Math.PI * 23
const FOCUS_ARC = (240 / 360) * FOCUS_RING
// Pixels of vertical drag for the whole -100 to 100 range.
const DRAG_PIXELS = 160
// A press that moves less than this is a click, not a turn.
const DEAD_ZONE = 3

// A true minus sign below the centre, a plus above it.
function signed(value: number): string {
  if (value > 0) return `+${value}`
  if (value < 0) return `\u2212${-value}`
  return '0'
}

export function StudioMacroDial(props: StudioMacroDialProps) {
  const draft = createStudioMacroDraft(props)
  const labels = () => MACRO_LABELS[props.name]
  const angle = () => (draft.value() / 100) * 135
  const [turning, setTurning] = createSignal(false)
  let input: HTMLInputElement | undefined
  let drag: {
    pointer: number
    y: number
    from: number
    moved: boolean
  } | null = null

  function down(event: PointerEvent): void {
    if (!props.writable || event.button !== 0) return
    event.preventDefault()
    input?.focus({ preventScroll: true })
    draft.pointerDown()
    drag = {
      pointer: event.pointerId,
      y: event.clientY,
      from: draft.value(),
      moved: false,
    }
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    setTurning(true)
  }

  function move(event: PointerEvent): void {
    if (drag === null || drag.pointer !== event.pointerId) return
    const rise = drag.y - event.clientY
    if (!drag.moved && Math.abs(rise) < DEAD_ZONE) return
    drag.moved = true
    const pixels = event.shiftKey ? DRAG_PIXELS * 4 : DRAG_PIXELS
    draft.set(drag.from + (rise / pixels) * 200)
  }

  function finish(event: PointerEvent): void {
    if (drag === null || drag.pointer !== event.pointerId) return
    drag = null
    setTurning(false)
    draft.pointerUp()
    draft.commit()
  }

  function cancel(): void {
    drag = null
    setTurning(false)
    draft.pointerCancel()
  }

  return (
    <div class={styles.dial}>
      <span class={styles.title} aria-hidden="true">
        {labels().label}
      </span>
      <span
        class={styles.face}
        classList={{ [styles.turning]: turning() }}
        title={`${labels().label}: drag up or down. Double-click for the centre.`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={finish}
        onLostPointerCapture={finish}
        onPointerCancel={cancel}
        onDblClick={() => {
          draft.set(0)
          draft.commit()
        }}
      >
        <input
          ref={input}
          class={styles.input}
          type="range"
          aria-label={labels().label}
          min="-100"
          max="100"
          step="1"
          value={draft.value()}
          disabled={!props.writable}
          aria-valuetext={studioMacroValueText(props.name, draft.value())}
          onInput={(event) => draft.input(event)}
          onChange={() => draft.change()}
          on:keydown={(event) => draft.keyDown(event)}
          on:keyup={(event) => draft.keyUp(event)}
          onBlur={() => draft.commit()}
        />
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <circle
            class={styles.focusRing}
            cx="24"
            cy="24"
            r="23"
            style={{ 'stroke-dasharray': `${FOCUS_ARC} ${FOCUS_RING}` }}
          />
          <line class={styles.zero} x1="24" y1="1.5" x2="24" y2="3.5" />
          <circle
            class={styles.track}
            cx="24"
            cy="24"
            r="18"
            style={{ 'stroke-dasharray': `${TRAVEL} ${RING}` }}
          />
          <circle
            class={styles.arc}
            classList={{ [styles.idle]: draft.value() === 0 }}
            cx="24"
            cy="24"
            r="18"
            style={{
              transform: `rotate(${-90 + Math.min(0, angle())}deg)`,
              'stroke-dasharray': `${(Math.abs(angle()) / 360) * RING} ${RING}`,
            }}
          />
          <circle class={styles.cap} cx="24" cy="24" r="12.5" />
          <line
            class={styles.pointer}
            x1="24"
            y1="12.5"
            x2="24"
            y2="16.5"
            style={{ transform: `rotate(${angle()}deg)` }}
          />
        </svg>
        <span class={styles.value} aria-hidden="true">
          {signed(draft.value())}
        </span>
      </span>
      <span class={styles.ends} aria-hidden="true">
        <span>{labels().low}</span>
        <span>{labels().high}</span>
      </span>
    </div>
  )
}

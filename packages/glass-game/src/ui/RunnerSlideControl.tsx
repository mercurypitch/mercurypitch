// Runner slide control — held pointer input and accessible toggles share the same stance owner.
import type { RunnerInputEdges } from './runner-input'

export function RunnerSlideControl(props: {
  input: RunnerInputEdges
  disabled: boolean
  sliding?: boolean
  class: string
}) {
  return (
    <button
      type="button"
      class={props.class}
      disabled={props.disabled}
      aria-label="Slide"
      aria-description="Hold to slide. Press Enter or Space to toggle."
      aria-keyshortcuts="ArrowDown S"
      aria-pressed={props.sliding === true}
      data-action="slide"
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (
          event.button !== 0 ||
          !props.input.pointerDown('slide', event.pointerId)
        )
          return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerUp={(event) => props.input.pointerEnd('slide', event.pointerId)}
      onPointerCancel={(event) =>
        props.input.pointerEnd('slide', event.pointerId)
      }
      onLostPointerCapture={(event) => {
        if (event.target === event.currentTarget)
          props.input.pointerEnd('slide', event.pointerId)
      }}
      onClick={(event) => {
        if (event.detail === 0) props.input.activate('slide')
      }}
    >
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M5 7h22M12 21h9l5 5M14 21l3-5h6M5 27h22" />
        <circle cx="8" cy="20" r="3" />
      </svg>
      <span>Slide</span>
    </button>
  )
}

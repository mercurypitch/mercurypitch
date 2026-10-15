// ReasonHold shows why a rail control is waiting, as text under it.
// ============================================================
//
// A control that waits for something (Loop for its A and B, Hear my voice
// for the mic) stays pressable: aria-disabled, never `disabled`, because a
// disabled button shows no tooltip and takes no press, so it could not say
// why. Pressed, hovered or focused, it shows its reason as text under it,
// and the text is the control's description (aria-describedby), so a screen
// reader hears it too. A press shows it for a few seconds and runs nothing.
//
// A control that is not waiting can still carry a reason (a blocked mic
// says how to unblock it) without blocking its press.
//
// The hold renders the control through a function, so the control keeps its
// own markup and handlers and only adds the ones it is given here.

import type { Accessor, Component, JSX } from 'solid-js'
import { createSignal, createUniqueId, onCleanup, Show } from 'solid-js'
import styles from './ReasonHold.module.css'

/** How long a press keeps the reason on screen. */
export const REASON_PRESS_MS = 3000

export interface ReasonControl {
  /** Spread on the control: describedby, and the hover and focus handlers. */
  attrs: {
    'aria-describedby': string | undefined
    'aria-disabled': 'true' | undefined
    onPointerEnter: () => void
    onPointerLeave: () => void
    onFocus: () => void
    onBlur: () => void
  }
  /**
   * Call first in the control's click handler: true when the control is
   * waiting, in which case the reason is shown and the press stops there.
   */
  refuse: () => boolean
}

export interface ReasonHoldProps {
  /** Why the control waits, or what is wrong; null when it has nothing to say. */
  reason: string | null
  /** The control waits: aria-disabled, and a press runs nothing. */
  blocks: boolean
  /** A warning (red edge) rather than a wait. */
  tone?: 'wait' | 'warn'
  class?: string
  children: (control: ReasonControl) => JSX.Element
}

export const ReasonHold: Component<ReasonHoldProps> = (props) => {
  const id = createUniqueId()
  const [hovered, setHovered] = createSignal(false)
  const [focused, setFocused] = createSignal(false)
  const [pressed, setPressed] = createSignal(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(timer))

  const showing: Accessor<boolean> = () =>
    props.reason !== null && (hovered() || focused() || pressed())

  const press = (): void => {
    clearTimeout(timer)
    setPressed(true)
    timer = setTimeout(() => setPressed(false), REASON_PRESS_MS)
  }

  const control: ReasonControl = {
    attrs: {
      get 'aria-describedby'() {
        return props.reason !== null ? id : undefined
      },
      get 'aria-disabled'() {
        return props.blocks ? ('true' as const) : undefined
      },
      onPointerEnter: () => setHovered(true),
      onPointerLeave: () => setHovered(false),
      onFocus: () => setFocused(true),
      onBlur: () => {
        setFocused(false)
        setPressed(false)
      },
    },
    refuse: () => {
      if (props.reason !== null) press()
      return props.blocks
    },
  }

  return (
    <span
      class={`${styles.hold} ${props.class ?? ''}`}
      data-hint={showing() ? 'on' : 'off'}
    >
      {props.children(control)}
      <Show when={props.reason}>
        {(reason) => (
          <span
            id={id}
            class={styles.hint}
            data-tone={props.tone ?? 'wait'}
            data-testid="rail-reason"
          >
            {reason()}
          </span>
        )}
      </Show>
    </span>
  )
}

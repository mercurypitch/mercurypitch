// ============================================================
// ShellRoot — the element every piece of shell chrome sits inside
// ============================================================
//
// It carries the motion tokens and the one decision that changes all of
// them: reduced motion, which collapses every transition in `shell.css` to a
// 120 ms opacity crossfade with nothing moving.
//
// The OS setting is answered twice on purpose. The media query in the
// stylesheet is what a real phone honours; the class this sets is what a
// test and a screenshot run can turn on without a browser flag — and it is
// the same set of tokens either way, so the two cannot drift.

import type { Component, JSX } from 'solid-js'
import { createSignal, onCleanup, onMount } from 'solid-js'

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export interface ShellRootProps {
  children: JSX.Element
}

export const ShellRoot: Component<ShellRootProps> = (props) => {
  const [reduced, setReduced] = createSignal(false)

  onMount(() => {
    const motion = window.matchMedia(REDUCED_MOTION_QUERY)
    setReduced(motion.matches)
    const onChange = (event: MediaQueryListEvent): void => {
      setReduced(event.matches)
    }
    motion.addEventListener('change', onChange)
    onCleanup(() => {
      motion.removeEventListener('change', onChange)
    })
  })

  return (
    <div
      class="mp-shell"
      classList={{ 'mp-reduced': reduced() }}
      data-reduced={reduced() ? 'on' : 'off'}
      data-testid="native-shell"
    >
      {props.children}
    </div>
  )
}

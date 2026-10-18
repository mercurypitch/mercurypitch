// ============================================================
// A room's measure of itself: taken on the page, and again on each resize
// ============================================================
//
// Every room lays its world out from a measure of the screen it has. Echo
// and the glide rooms measure their root: its size, the padding that keeps
// it clear of the shell's bars, and the heights their stylesheets give the
// head and the controls as custom properties (--lip-chip-clear). Long note
// measures its stage. The measure is taken once the room is on the page
// and again each time the element changes size, as a signal the room's
// layout reads; null until the first.

import type { Accessor } from 'solid-js'
import { createSignal, onCleanup, onMount } from 'solid-js'

/** A length in px from a computed style: a room's custom property; 0 when unset. */
export function cssPx(style: CSSStyleDeclaration, name: string): number {
  const value = Number.parseFloat(style.getPropertyValue(name))
  return Number.isFinite(value) ? value : 0
}

/**
 * `read(el())` once the room is mounted and again on every resize of that
 * element; null before. Call it in the room's body, before the element
 * exists: `el` is read only once the room is on the page.
 */
export function createMeasure<T>(
  el: () => HTMLElement | undefined,
  read: (el: HTMLElement) => T,
): Accessor<T | null> {
  const [value, setValue] = createSignal<T | null>(null)
  onMount(() => {
    const measure = (): void => {
      const target = el()
      if (target !== undefined) setValue(() => read(target))
    }
    measure()
    const observer = new ResizeObserver(measure)
    const target = el()
    if (target !== undefined) observer.observe(target)
    onCleanup(() => observer.disconnect())
  })
  return value
}

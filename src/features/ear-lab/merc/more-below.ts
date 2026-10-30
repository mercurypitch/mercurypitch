// ============================================================
// A scroll box's "more below": marked while some of it lies past its
// bottom edge, so its style can fade that edge (the plate on a short
// phone, docs/plans/ear-lab-native-look.md, phase 4).
// ============================================================

import { onCleanup } from 'solid-js'

/** Marks `box` with `data-more` while it can scroll further down. Given
 *  as the box's ref; the marking ends with the box's owner. */
export function markMoreBelow(box: HTMLElement): void {
  const mark = (): void => {
    box.toggleAttribute(
      'data-more',
      box.scrollTop + box.clientHeight < box.scrollHeight - 1,
    )
  }
  box.addEventListener('scroll', mark, { passive: true })
  const watch =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(mark)
  watch?.observe(box)
  // The box's own size holds while what is in it grows: watch that too,
  // once it is in.
  queueMicrotask(() => {
    for (const child of box.children) watch?.observe(child)
    mark()
  })
  onCleanup(() => {
    box.removeEventListener('scroll', mark)
    watch?.disconnect()
  })
}

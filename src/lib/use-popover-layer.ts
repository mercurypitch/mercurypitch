// usePopoverLayer gives every floating panel the same closing rule.
// ============================================================
//
// A menu, the key stepper or the loop menu floats over the page in a portal.
// Each one closes the same way, so a singer learns it once:
//
//   - a pointerdown outside the panel and its trigger (capture phase, so a
//     control that stops propagation cannot keep a stale panel open);
//   - a scroll that could have moved the trigger: the page, or anything that
//     holds the trigger. A panel left where its trigger used to be is worse
//     than no panel. A scroll elsewhere does not count, because the mixer's
//     lyrics scroll themselves all through a song and a panel that closed on
//     every line would never stay open long enough to use;
//   - a window resize, which moves everything;
//   - Escape, for the top layer only. Two panels open at once close one per
//     press, newest first, and the press that closes one is claimed with
//     preventDefault so nothing underneath acts on it too (focus mode, for
//     one, leaves on an unclaimed Escape). A press something above already
//     claimed, such as a dialog's own Escape, is left alone.
//
// A bottom sheet pinned to the viewport cannot drift, so `pinned` keeps it
// through scrolls and resizes; a press outside still closes it.
//
// Placement is `placePopover`, a pure function: hang below (or beside) the
// trigger, flip when the far side has no room, and clamp inside the viewport
// on both axes.

import type { Accessor } from 'solid-js'
import { createEffect, onCleanup } from 'solid-js'

export type PopoverCloseReason = 'outside' | 'escape' | 'scroll' | 'resize'

export interface PopoverLayerOptions {
  /** The rule applies while this is true. */
  open: Accessor<boolean>
  /** Close the panel. Escape is the one reason that should return focus. */
  onClose: (reason: PopoverCloseReason) => void
  /** The trigger and the panel: a pointerdown in either is not outside. */
  inside: () => readonly (Element | null | undefined)[]
  /** What the panel hangs from. Defaults to the first `inside` element. */
  anchor?: () => Element | null | undefined
  /** A sheet pinned to the viewport: scrolls and resizes keep it open. */
  pinned?: Accessor<boolean>
}

/** Open layers, oldest first. Escape belongs to the last one. */
const openLayers: object[] = []

export function usePopoverLayer(options: PopoverLayerOptions): void {
  createEffect(() => {
    if (!options.open()) return
    const layer = {}
    openLayers.push(layer)

    const isInside = (target: EventTarget | null): boolean =>
      target instanceof Node &&
      options.inside().some((element) => element?.contains(target) === true)

    const onPointerDown = (event: PointerEvent): void => {
      if (!(event.target instanceof Node) || isInside(event.target)) return
      options.onClose('outside')
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (openLayers[openLayers.length - 1] !== layer) return
      event.preventDefault()
      options.onClose('escape')
    }

    const onScroll = (event: Event): void => {
      if (options.pinned?.() === true) return
      const target = event.target
      // The panel's own list scrolling under the singer's finger.
      if (isInside(target)) return
      const anchor = options.anchor?.() ?? options.inside()[0]
      if (
        anchor == null ||
        !(target instanceof Node) ||
        target.contains(anchor)
      ) {
        options.onClose('scroll')
      }
    }

    const onResize = (): void => {
      if (options.pinned?.() === true) return
      options.onClose('resize')
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)

    onCleanup(() => {
      const index = openLayers.indexOf(layer)
      if (index !== -1) openLayers.splice(index, 1)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    })
  })
}

// ── Placement ─────────────────────────────────────────────────────

export interface PopoverAnchorRect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface PopoverPlacementOptions {
  /** 'block' hangs below (or above) the anchor; 'inline' sits beside it. */
  axis?: 'block' | 'inline'
  /** Which edges line up along the other axis. Default 'end'. */
  align?: 'start' | 'center' | 'end'
  /** Between the anchor and the panel. */
  gap?: number
  /** Kept clear of every viewport edge. */
  margin?: number
}

export interface PopoverPlacement {
  x: number
  y: number
  /** True when the panel flipped to the near side (above, or to the left). */
  above: boolean
}

/** Clear of the viewport edge, so a panel never sits flush against it. */
export const POPOVER_MARGIN = 8
/** Between a trigger and its panel. */
export const POPOVER_GAP = 6

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(minimum, value), Math.max(minimum, maximum))

/** Where along one axis a panel starts, given what it lines up with. */
function aligned(
  start: number,
  end: number,
  size: number,
  align: 'start' | 'center' | 'end',
): number {
  if (align === 'start') return start
  if (align === 'center') return (start + end) / 2 - size / 2
  return end - size
}

/**
 * Below the anchor (or right of it), flipped to the other side when that is
 * where the room is, and clamped inside the viewport on both axes.
 */
export function placePopover(
  anchor: PopoverAnchorRect,
  panel: { width: number; height: number },
  viewport: { width: number; height: number },
  options: PopoverPlacementOptions = {},
): PopoverPlacement {
  const margin = options.margin ?? POPOVER_MARGIN
  const gap = options.gap ?? POPOVER_GAP
  const align = options.align ?? 'end'
  const inline = options.axis === 'inline'

  // The axis the panel hangs along, as near/far edges and sizes.
  const near = inline ? anchor.left : anchor.top
  const far = inline ? anchor.right : anchor.bottom
  const size = inline ? panel.width : panel.height
  const room = inline ? viewport.width : viewport.height

  const after = far + gap
  const before = near - gap - size
  const fitsAfter = after + size <= room - margin
  const fitsBefore = before >= margin
  const flip = !fitsAfter && (fitsBefore || near > room - far)
  const main = clamp(flip ? before : after, margin, room - size - margin)

  // The other axis lines the panel up with the anchor.
  const cross = inline
    ? clamp(
        aligned(anchor.top, anchor.bottom, panel.height, align),
        margin,
        viewport.height - panel.height - margin,
      )
    : clamp(
        aligned(anchor.left, anchor.right, panel.width, align),
        margin,
        viewport.width - panel.width - margin,
      )

  return inline
    ? { x: main, y: cross, above: flip }
    : { x: cross, y: main, above: flip }
}

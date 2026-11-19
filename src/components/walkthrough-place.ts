// ============================================================
// walkthrough-place: where the Guide's tooltip stands beside its spotlight
// ============================================================
//
// The step names a side (`placement`, below unless it says otherwise). The
// tooltip goes there if it fits, else to the opposite side, and is held 12 px
// inside the window. A target taller than the room above and below it
// left the tooltip clamped over its middle: on a phone on its side (844x390)
// the Home tour's streak card is 430 px tall, and the tooltip covered its top
// for two steps while the 423 px to its right stood empty. Where neither
// above nor below fits, the tooltip stands beside the target if a side has
// the room. Plain arithmetic, no DOM, so it is tested on its own.

export type Placement = 'top' | 'bottom' | 'left' | 'right'

/** A box in the window's coordinates, as getBoundingClientRect gives it. */
export interface PlaceRect {
  top: number
  bottom: number
  left: number
  right: number
  width: number
  height: number
}

export interface TooltipPlace {
  placement: Placement
  left: number
  top: number
}

/** The gap between the spotlight's target and the tooltip. */
export const TOOLTIP_GAP = 12
/** How far inside the window's edges the tooltip is held. */
const EDGE = 12

/**
 * Where a tooltip `tW` x `tH` stands for `target`, in a `vw` x `vh` window,
 * when the step asks for `asked`.
 */
export function placeTooltip(
  target: PlaceRect,
  tW: number,
  tH: number,
  vw: number,
  vh: number,
  asked: Placement,
): TooltipPlace {
  let placement = asked

  // On narrow viewports, prefer bottom placement to avoid horizontal overflow
  if (vw < 480 && (placement === 'left' || placement === 'right')) {
    placement = 'bottom'
  }

  const centerX = target.left + target.width / 2
  const centerY = target.top + target.height / 2

  if (placement === 'right') {
    if (target.right + TOOLTIP_GAP + tW > vw) placement = 'left'
  } else if (placement === 'left') {
    if (target.left - TOOLTIP_GAP - tW < 0) placement = 'right'
  }

  if (placement === 'bottom') {
    if (target.bottom + TOOLTIP_GAP + tH > vh) placement = 'top'
  } else if (placement === 'top') {
    if (target.top - TOOLTIP_GAP - tH < 0) placement = 'bottom'
  }

  // Room neither below nor above: beside it, where a side has the room,
  // rather than clamped over the target's middle.
  if (
    (placement === 'top' || placement === 'bottom') &&
    target.bottom + TOOLTIP_GAP + tH > vh - EDGE &&
    target.top - TOOLTIP_GAP - tH < EDGE
  ) {
    if (target.right + TOOLTIP_GAP + tW <= vw - EDGE) placement = 'right'
    else if (target.left - TOOLTIP_GAP - tW >= EDGE) placement = 'left'
  }

  if (placement === 'right' && target.right > vw - tW * 0.5) {
    placement = 'bottom'
  } else if (placement === 'left' && target.left < tW * 0.5) {
    placement = 'bottom'
  }

  let left: number
  let top: number
  switch (placement) {
    case 'bottom':
      left = centerX - tW / 2
      top = target.bottom + TOOLTIP_GAP
      break
    case 'top':
      left = centerX - tW / 2
      top = target.top - tH - TOOLTIP_GAP
      break
    case 'right':
      left = target.right + TOOLTIP_GAP
      top = centerY - tH / 2
      break
    case 'left':
      left = target.left - tW - TOOLTIP_GAP
      top = centerY - tH / 2
      break
  }

  return {
    placement,
    left: Math.max(EDGE, Math.min(left, vw - tW - EDGE)),
    top: Math.max(EDGE, Math.min(top, vh - tH - EDGE)),
  }
}

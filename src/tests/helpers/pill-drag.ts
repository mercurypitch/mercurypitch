// ============================================================
// Driving a PillControl from jsdom
// ============================================================
//
// The capsule's whole gesture is vertical: press, slide, lift. jsdom has no
// PointerEvent, so `fireEvent.pointerDown` builds a bare Event and drops
// clientY on the floor — the handler reads NaN and every assertion about the
// resulting level passes or fails by accident. A MouseEvent dispatched under
// a pointer type name carries the coordinate and reaches the same listener.
//
// Same construction the shared `drag-gesture` suite uses; this is the
// pill-shaped wrapper of it, so the two suites that drive a pill cannot drift
// apart on the workaround.

/** Fakes the pointer-capture API jsdom does not implement. */
function installPointerCapture(element: HTMLElement): void {
  const captured = new Set<number>()
  element.setPointerCapture = (id: number): void => void captured.add(id)
  element.hasPointerCapture = (id: number): boolean => captured.has(id)
  element.releasePointerCapture = (id: number): void => void captured.delete(id)
}

function send(element: HTMLElement, type: string, clientY: number): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    // Real devices report the button held for every event of a press except
    // the terminating one.
    buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
    cancelable: true,
    clientY,
  })
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: 'touch' },
  })
  element.dispatchEvent(event)
}

/**
 * Press at `from`, slide to `to`, lift. Screen coordinates, so dragging UP
 * (raising the level) means `to` is the SMALLER number.
 *
 * `from === to` is a tap, which is what the pill's toggle listens for.
 * `end: 'pointercancel'` is the system taking the gesture away mid-press — an
 * edge swipe, an incoming call, a rejected palm — which must never read as a
 * tap.
 */
export function dragPill(
  pill: HTMLElement,
  from: number,
  to: number,
  options: { end?: 'pointerup' | 'pointercancel' } = {},
): void {
  installPointerCapture(pill)
  send(pill, 'pointerdown', from)
  send(pill, 'pointermove', to)
  send(pill, options.end ?? 'pointerup', to)
}

/** A press that never becomes a drag — the pill's tap-to-toggle gesture. */
export function tapPill(pill: HTMLElement, at = 100): void {
  dragPill(pill, at, at)
}

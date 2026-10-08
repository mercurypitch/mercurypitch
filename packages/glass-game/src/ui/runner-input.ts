// ============================================================
// Runner UI input edges — held keys and contacts submit one deterministic action.
// ============================================================

import type { RunnerInput } from '../runner/contracts'

export type RunnerControlAction = Exclude<RunnerInput['action'], 'steer'>
export type RunnerEdgeAction = Exclude<RunnerControlAction, 'slide'>

export interface RunnerKeyboardEdgeEvent {
  readonly code: string
  readonly repeat: boolean
  readonly defaultPrevented: boolean
  readonly metaKey: boolean
  readonly ctrlKey: boolean
  readonly altKey: boolean
  readonly target: EventTarget | null
  preventDefault(): void
}

export interface RunnerInputEdges {
  setEnabled(enabled: boolean): void
  activate(action: RunnerControlAction): boolean
  key(event: RunnerKeyboardEdgeEvent, down: boolean): boolean
  pointerDown(action: RunnerControlAction, pointerId: number): boolean
  pointerEnd(action: RunnerControlAction, pointerId: number): boolean
  clear(): void
}

const ACTION_BY_CODE: Readonly<Record<string, RunnerControlAction>> = {
  ArrowLeft: 'lane-left',
  KeyA: 'lane-left',
  ArrowRight: 'lane-right',
  KeyD: 'lane-right',
  ArrowUp: 'jump',
  KeyW: 'jump',
  Space: 'jump',
  ArrowDown: 'slide',
  KeyS: 'slide',
}

export function isRunnerInteractiveTarget(target: EventTarget | null): boolean {
  if (target === null || typeof target !== 'object') return false
  const element = target as HTMLElement
  if (element.isContentEditable === true) return true
  return (
    typeof element.closest === 'function' &&
    element.closest(
      'input, textarea, select, button, a[href], summary, [role="button"], [contenteditable="true"]',
    ) !== null
  )
}

export function createRunnerInputEdges(
  submit: (action: RunnerEdgeAction) => boolean,
  slide?: (held: boolean) => boolean,
): RunnerInputEdges {
  const heldCodes = new Set<string>()
  const pointersByAction = new Map<RunnerControlAction, number>()
  const actionsByPointer = new Map<number, RunnerControlAction>()
  let enabled = false
  let slideToggle = false
  let sliding = false

  const isActionHeld = (action: RunnerControlAction): boolean =>
    Array.from(heldCodes).some((code) => ACTION_BY_CODE[code] === action)

  function publishSlide(): boolean {
    const next =
      enabled &&
      (slideToggle || isActionHeld('slide') || pointersByAction.has('slide'))
    if (next === sliding) return true
    // A submission may synchronously clear the input on pause or recovery.
    sliding = next
    const accepted = slide?.(next) ?? false
    if (next && !accepted) {
      // Airborne starts are rejected. Keep unrelated movement contacts, but
      // require a fresh slide press instead of latching an invisible toggle.
      slideToggle = false
      for (const code of heldCodes)
        if (ACTION_BY_CODE[code] === 'slide') heldCodes.delete(code)
      const pointerId = pointersByAction.get('slide')
      if (pointerId !== undefined) actionsByPointer.delete(pointerId)
      pointersByAction.delete('slide')
      sliding = false
    }
    return accepted && (!next || (enabled && sliding))
  }

  function clear(): void {
    heldCodes.clear()
    pointersByAction.clear()
    actionsByPointer.clear()
    slideToggle = false
    publishSlide()
  }

  function blocksKeyboard(
    action: RunnerControlAction,
    target: EventTarget | null,
  ): boolean {
    if (!isRunnerInteractiveTarget(target)) return false
    const element = target as HTMLElement
    // Down/S remain movement keys on course buttons; Space keeps native activation.
    return (
      action !== 'slide' ||
      element.isContentEditable === true ||
      !element.closest?.('[aria-label="Course controls"] button')
    )
  }

  return {
    setEnabled(nextEnabled) {
      if (enabled === nextEnabled) return
      enabled = nextEnabled
      if (!enabled) clear()
    },
    activate(action) {
      if (!enabled || (action === 'slide' && slide === undefined)) return false
      if (action !== 'slide') return submit(action)
      slideToggle = !slideToggle
      return publishSlide()
    },
    key(event, down) {
      const action = ACTION_BY_CODE[event.code]
      if (action === undefined || (action === 'slide' && slide === undefined))
        return false
      if (!down) {
        const wasHeld = heldCodes.delete(event.code)
        if (wasHeld && action === 'slide') publishSlide()
        if (wasHeld && !isRunnerInteractiveTarget(event.target))
          event.preventDefault()
        return wasHeld
      }
      if (
        !enabled ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        blocksKeyboard(action, event.target)
      )
        return false
      event.preventDefault()
      if (heldCodes.has(event.code)) return true
      if (action === 'slide' && event.repeat) return true
      const actionWasHeld = isActionHeld(action)
      heldCodes.add(event.code)
      if (action === 'slide') publishSlide()
      else if (!event.repeat && !actionWasHeld) submit(action)
      return true
    },
    pointerDown(action, pointerId) {
      if (
        !enabled ||
        (action === 'slide' && slide === undefined) ||
        pointersByAction.has(action) ||
        actionsByPointer.has(pointerId)
      )
        return false
      pointersByAction.set(action, pointerId)
      actionsByPointer.set(pointerId, action)
      if (action === 'slide') publishSlide()
      else submit(action)
      return enabled && actionsByPointer.get(pointerId) === action
    },
    pointerEnd(action, pointerId) {
      if (pointersByAction.get(action) !== pointerId) return false
      pointersByAction.delete(action)
      actionsByPointer.delete(pointerId)
      if (action === 'slide') publishSlide()
      return true
    },
    clear,
  }
}

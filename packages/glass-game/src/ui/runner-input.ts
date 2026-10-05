// ============================================================
// Runner UI input edges — held keys and contacts submit one deterministic action.
// ============================================================

import type { RunnerInput } from '../runner/contracts'

export type RunnerControlAction = Exclude<RunnerInput['action'], 'steer'>

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
  submit: (action: RunnerControlAction) => boolean,
): RunnerInputEdges {
  const heldCodes = new Set<string>()
  const pointersByAction = new Map<RunnerControlAction, number>()
  const actionsByPointer = new Map<number, RunnerControlAction>()
  let enabled = false

  const isActionHeld = (action: RunnerControlAction): boolean =>
    Array.from(heldCodes).some((code) => ACTION_BY_CODE[code] === action)

  return {
    setEnabled(nextEnabled) {
      if (enabled === nextEnabled) return
      enabled = nextEnabled
      if (!enabled) {
        heldCodes.clear()
        pointersByAction.clear()
        actionsByPointer.clear()
      }
    },
    activate(action) {
      return enabled && submit(action)
    },
    key(event, down) {
      const action = ACTION_BY_CODE[event.code]
      if (action === undefined) return false
      if (!down) {
        const wasHeld = heldCodes.delete(event.code)
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
        isRunnerInteractiveTarget(event.target)
      )
        return false
      event.preventDefault()
      if (heldCodes.has(event.code)) return true
      const actionWasHeld = isActionHeld(action)
      heldCodes.add(event.code)
      if (!event.repeat && !actionWasHeld) submit(action)
      return true
    },
    pointerDown(action, pointerId) {
      if (
        !enabled ||
        pointersByAction.has(action) ||
        actionsByPointer.has(pointerId)
      )
        return false
      pointersByAction.set(action, pointerId)
      actionsByPointer.set(pointerId, action)
      submit(action)
      return true
    },
    pointerEnd(action, pointerId) {
      if (pointersByAction.get(action) !== pointerId) return false
      pointersByAction.delete(action)
      actionsByPointer.delete(pointerId)
      return true
    },
    clear() {
      heldCodes.clear()
      pointersByAction.clear()
      actionsByPointer.clear()
    },
  }
}

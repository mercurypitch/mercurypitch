// Continuous runner input — held keys and captured thumb displacement share one bounded steering axis.

import type { RunnerInputEdges, RunnerKeyboardEdgeEvent } from './runner-input'
import { createRunnerInputEdges, isRunnerInteractiveTarget, } from './runner-input'

export const RUNNER_STEERING_DEADZONE = 0.08
export const RUNNER_STEERING_TRAVEL_PX = 40

export interface RunnerSteeringState {
  readonly axis: number
  readonly pointerId: number | null
  readonly displacementPx: number
}

export interface RunnerContinuousInput extends RunnerInputEdges {
  steeringState(): RunnerSteeringState
  subscribeSteering(listener: (state: RunnerSteeringState) => void): () => void
  steeringDown(pointerId: number, clientX: number, travelPx: number): boolean
  steeringMove(pointerId: number, clientX: number): boolean
  steeringEnd(pointerId: number): boolean
}

const LEFT_CODES = new Set(['KeyA', 'ArrowLeft'])
const RIGHT_CODES = new Set(['KeyD', 'ArrowRight'])

function steeringTargetIsInteractive(target: EventTarget | null): boolean {
  if (!isRunnerInteractiveTarget(target)) return false
  const element = target as HTMLElement
  // Jump and steering controls can keep focus without swallowing movement keys.
  return element.closest('[aria-label="Course controls"]') === null
}

export function createRunnerContinuousInput(
  jump: () => boolean,
  steer: (axis: number) => boolean,
): RunnerContinuousInput {
  const jumpEdges = createRunnerInputEdges(
    (action) => action === 'jump' && jump(),
  )
  const heldCodes = new Set<string>()
  const jumpPointers = new Set<number>()
  const listeners = new Set<(state: RunnerSteeringState) => void>()
  let enabled = false
  let pointer: {
    id: number
    originX: number
    travelPx: number
    axis: number
    displacementPx: number
  } | null = null
  let state: RunnerSteeringState = Object.freeze({
    axis: 0,
    pointerId: null,
    displacementPx: 0,
  })

  function publish(): void {
    const keyboardAxis =
      Number([...RIGHT_CODES].some((code) => heldCodes.has(code))) -
      Number([...LEFT_CODES].some((code) => heldCodes.has(code)))
    const axis = pointer?.axis ?? keyboardAxis
    const next = Object.freeze({
      axis,
      pointerId: pointer?.id ?? null,
      displacementPx:
        pointer?.displacementPx ?? axis * RUNNER_STEERING_TRAVEL_PX,
    })
    if (
      next.axis === state.axis &&
      next.pointerId === state.pointerId &&
      next.displacementPx === state.displacementPx
    )
      return
    const previousAxis = state.axis
    state = next
    // Submission can synchronously enter recovery and clear these controls.
    // Store the axis first so that the lifecycle's neutral state wins.
    if (next.axis !== previousAxis) steer(next.axis)
    for (const listener of listeners) listener(state)
  }

  function clear(): void {
    heldCodes.clear()
    pointer = null
    jumpEdges.clear()
    jumpPointers.clear()
    publish()
  }

  return {
    setEnabled(next) {
      if (enabled === next) return
      if (!next) clear()
      enabled = next
      jumpEdges.setEnabled(next)
    },
    activate(action) {
      return action === 'jump' && jumpEdges.activate(action)
    },
    key(event: RunnerKeyboardEdgeEvent, down) {
      if (!LEFT_CODES.has(event.code) && !RIGHT_CODES.has(event.code))
        return jumpEdges.key(event, down)
      if (!down) {
        const wasHeld = heldCodes.delete(event.code)
        if (wasHeld) {
          event.preventDefault()
          publish()
        }
        return wasHeld
      }
      if (
        !enabled ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        steeringTargetIsInteractive(event.target)
      )
        return false
      event.preventDefault()
      // A key still physically held through pause/blur must be released first.
      if (event.repeat || heldCodes.has(event.code)) return true
      heldCodes.add(event.code)
      publish()
      return true
    },
    pointerDown(action, pointerId) {
      if (
        !enabled ||
        action !== 'jump' ||
        pointer?.id === pointerId ||
        jumpPointers.has(pointerId)
      )
        return false
      jumpPointers.add(pointerId)
      if (!jumpEdges.pointerDown(action, pointerId)) {
        jumpPointers.delete(pointerId)
        return false
      }
      return enabled && jumpPointers.has(pointerId)
    },
    pointerEnd(action, pointerId) {
      const ended = jumpEdges.pointerEnd(action, pointerId)
      if (ended) jumpPointers.delete(pointerId)
      return ended
    },
    clear,
    steeringState: () => state,
    subscribeSteering(listener) {
      listeners.add(listener)
      listener(state)
      return () => {
        listeners.delete(listener)
      }
    },
    steeringDown(pointerId, clientX, travelPx) {
      if (
        !enabled ||
        pointer !== null ||
        jumpPointers.has(pointerId) ||
        !Number.isFinite(clientX) ||
        !Number.isFinite(travelPx) ||
        travelPx <= 0
      )
        return false
      pointer = {
        id: pointerId,
        originX: clientX,
        travelPx,
        axis: 0,
        displacementPx: 0,
      }
      publish()
      return enabled && pointer?.id === pointerId
    },
    steeringMove(pointerId, clientX) {
      if (pointer?.id !== pointerId || !Number.isFinite(clientX)) return false
      const raw = Math.max(
        -1,
        Math.min(1, (clientX - pointer.originX) / pointer.travelPx),
      )
      const magnitude = Math.max(
        0,
        (Math.abs(raw) - RUNNER_STEERING_DEADZONE) /
          (1 - RUNNER_STEERING_DEADZONE),
      )
      pointer.axis = Math.sign(raw) * magnitude
      pointer.displacementPx = raw * pointer.travelPx
      publish()
      return true
    },
    steeringEnd(pointerId) {
      if (pointer?.id !== pointerId) return false
      pointer = null
      publish()
      return true
    },
  }
}

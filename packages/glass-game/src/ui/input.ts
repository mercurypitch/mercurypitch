// Adventure input — independently owned movement, camera and jump contacts.
import type { MovementInput } from '../contracts'

const MOVEMENT_INTENT_THRESHOLD = 0.001

interface MovementAxes {
  x: number
  forward: number
}

export function isAdventureEditableTarget(target: EventTarget | null): boolean {
  if (target === null || typeof target !== 'object') return false
  const element = target as HTMLElement
  return (
    element.isContentEditable === true ||
    (typeof element.closest === 'function' &&
      element.closest('input, textarea, select') !== null)
  )
}

function hasMovementIntent(axes: MovementAxes): boolean {
  return Math.hypot(axes.x, axes.forward) > MOVEMENT_INTENT_THRESHOLD
}

function changesDirection(before: MovementAxes, after: MovementAxes): boolean {
  const beforeLength = Math.hypot(before.x, before.forward)
  const afterLength = Math.hypot(after.x, after.forward)
  if (afterLength <= MOVEMENT_INTENT_THRESHOLD) return false
  if (beforeLength <= MOVEMENT_INTENT_THRESHOLD) return true
  return (
    Math.abs(before.x / beforeLength - after.x / afterLength) > 0.000001 ||
    Math.abs(before.forward / beforeLength - after.forward / afterLength) >
      0.000001
  )
}

export interface AdventureInput {
  read(yaw: number): MovementInput
  /** World-space heading requested by the current contact, before acceleration. */
  desiredTravelYaw(yaw: number): number | null
  hasMovementIntent(): boolean
  consumeMovementReferenceChange(): boolean
  setStick(x: number, y: number): void
  setJump(down: boolean): void
  clear(): void
  key(event: KeyboardEvent, down: boolean): boolean
}
export function createAdventureInput(): AdventureInput {
  const held = new Set<string>()
  let stickX = 0
  let stickY = 0
  let stickActive = false
  let touchJump = false
  let referenceChange: 'keyboard' | 'stick' | null = null
  const movementAxes = () => ({
    x:
      stickX +
      Number(held.has('KeyD') || held.has('ArrowRight')) -
      Number(held.has('KeyA') || held.has('ArrowLeft')),
    forward:
      -stickY +
      Number(held.has('KeyW') || held.has('ArrowUp')) -
      Number(held.has('KeyS') || held.has('ArrowDown')),
  })
  const movementInput = (yaw: number): MovementInput => {
    const { x, forward } = movementAxes()
    const magnitude = Math.hypot(x, forward)
    const length = Math.max(1, magnitude)
    const moving = magnitude > MOVEMENT_INTENT_THRESHOLD
    return {
      moveX: moving
        ? (x * Math.cos(yaw) - forward * Math.sin(yaw)) / length
        : 0,
      moveZ: moving
        ? (-x * Math.sin(yaw) - forward * Math.cos(yaw)) / length
        : 0,
      jumpDown: touchJump || held.has('Space'),
    }
  }
  return {
    key(event, down) {
      const supported = [
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Space',
      ].includes(event.code)
      if (!supported) return false
      const target = event.target
      const editable = isAdventureEditableTarget(target)
      if (
        down &&
        (event.defaultPrevented ||
          (event.code === 'Space' &&
            target !== null &&
            typeof target === 'object' &&
            typeof (target as Element).closest === 'function' &&
            (target as Element).closest('button, a[href], [role="button"]') !==
              null) ||
          editable ||
          event.metaKey ||
          event.ctrlKey ||
          event.altKey)
      )
        return false
      if (!down && !held.has(event.code)) return false
      const before = movementAxes()
      if (down) held.add(event.code)
      else held.delete(event.code)
      const after = movementAxes()
      if (!hasMovementIntent(after)) referenceChange = null
      else if (changesDirection(before, after)) referenceChange = 'keyboard'
      if (!editable) event.preventDefault()
      return true
    },
    read: movementInput,
    desiredTravelYaw(yaw) {
      const movement = movementInput(yaw)
      if (
        Math.hypot(movement.moveX, movement.moveZ) <= MOVEMENT_INTENT_THRESHOLD
      )
        return null
      return Math.atan2(-movement.moveX, -movement.moveZ)
    },
    hasMovementIntent() {
      return hasMovementIntent(movementAxes())
    },
    consumeMovementReferenceChange() {
      const changed = referenceChange !== null
      referenceChange = null
      return changed
    },
    setStick(x, y) {
      const wasActive = stickActive
      stickX = x
      stickY = y
      stickActive = Math.hypot(stickX, stickY) > MOVEMENT_INTENT_THRESHOLD
      if (!hasMovementIntent(movementAxes())) referenceChange = null
      else if (!wasActive && stickActive && referenceChange !== 'keyboard')
        referenceChange = 'stick'
      else if (wasActive && !stickActive && referenceChange === 'stick')
        referenceChange = null
    },
    setJump(down) {
      touchJump = down
    },
    clear() {
      held.clear()
      stickX = 0
      stickY = 0
      stickActive = false
      touchJump = false
      referenceChange = null
    },
  }
}

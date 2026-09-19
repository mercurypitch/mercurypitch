// Adventure input — independently owned movement, camera and jump contacts.
import type { MovementInput } from '../contracts'

export interface AdventureInput {
  read(yaw: number): MovementInput
  hasMovementIntent(): boolean
  setStick(x: number, y: number): void
  setJump(down: boolean): void
  clear(): void
  key(event: KeyboardEvent, down: boolean): boolean
}
export function createAdventureInput(): AdventureInput {
  const held = new Set<string>()
  let stickX = 0
  let stickY = 0
  let touchJump = false
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
  return {
    key(event, down) {
      const target = event.target as HTMLElement | null
      if (
        event.defaultPrevented ||
        (event.code === 'Space' &&
          target !== null &&
          target.closest('button, a[href], [role="button"]') !== null) ||
        target?.isContentEditable === true ||
        target?.closest('input, textarea, select') ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return false
      if (
        ![
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
      )
        return false
      if (down) held.add(event.code)
      else held.delete(event.code)
      event.preventDefault()
      return true
    },
    read(yaw) {
      const { x, forward } = movementAxes()
      const length = Math.max(1, Math.hypot(x, forward))
      return {
        moveX: (x * Math.cos(yaw) - forward * Math.sin(yaw)) / length,
        moveZ: (-x * Math.sin(yaw) - forward * Math.cos(yaw)) / length,
        jumpDown: touchJump || held.has('Space'),
      }
    },
    hasMovementIntent() {
      const { x, forward } = movementAxes()
      return Math.hypot(x, forward) > 0.001
    },
    setStick(x, y) {
      stickX = x
      stickY = y
    },
    setJump(down) {
      touchJump = down
    },
    clear() {
      held.clear()
      stickX = 0
      stickY = 0
      touchJump = false
    },
  }
}

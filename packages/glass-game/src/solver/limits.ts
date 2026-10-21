// Solver limits — finite public inputs prevent unbounded replay and allocation.
import type { MovementInput } from '../contracts.ts'
import type { MacroInput } from './contracts.ts'

export const MAX_MACRO_TICKS = 240
export const MAX_REPLAY_TICKS = 14_400

export function boundedInteger(
  value: number,
  minimum: number,
  maximum: number,
): boolean {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum
}

export function validMovementInput(input: MovementInput): boolean {
  return (
    input !== null &&
    typeof input === 'object' &&
    Number.isFinite(input.moveX) &&
    Math.abs(input.moveX) <= 1 &&
    Number.isFinite(input.moveZ) &&
    Math.abs(input.moveZ) <= 1 &&
    typeof input.jumpDown === 'boolean'
  )
}

export function assertMacro(macro: MacroInput): void {
  if (
    !validMovementInput(macro) ||
    !boundedInteger(macro.durationTicks, 1, MAX_MACRO_TICKS)
  ) {
    throw new RangeError(
      `Macro input must be finite and last 1–${MAX_MACRO_TICKS} integer ticks.`,
    )
  }
}

export function validReplay(
  inputs: readonly MovementInput[],
  maximum = MAX_REPLAY_TICKS,
): boolean {
  if (!Array.isArray(inputs) || inputs.length > maximum) return false
  // Reject sparse arrays too; Array.every would skip holes consumed by the replay.
  for (let index = 0; index < inputs.length; index++) {
    if (!validMovementInput(inputs[index])) return false
  }
  return true
}

export function assertReplay(inputs: readonly MovementInput[]): void {
  if (!validReplay(inputs))
    throw new RangeError(
      `Replay requires at most ${MAX_REPLAY_TICKS} finite movement inputs.`,
    )
}

// ============================================================
// Pitch Centre assessment utilities — immutable and exact-value helpers
// ============================================================
//
// These helpers keep the pilot assessor and its persisted-data validator on
// the same cloning and structural-equality rules without coupling either one
// to the public assessment facade.

import type { GuidedRetakeProtocol } from './contracts'

export function freezeDeep<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value
  }
  for (const nested of Object.values(
    value as unknown as Record<string, unknown>,
  )) {
    freezeDeep(nested)
  }
  return Object.freeze(value)
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function sameJsonValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((entry, index) => sameJsonValue(entry, right[index]))
    )
  }
  if (!isRecord(left) || !isRecord(right)) return false
  const leftKeys = Object.keys(left).sort()
  const rightKeys = Object.keys(right).sort()
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] && sameJsonValue(left[key], right[key]),
    )
  )
}

export function hasExactKeys(
  value: unknown,
  expectedKeys: readonly string[],
): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  const actualKeys = Object.keys(value).sort()
  const sortedExpectedKeys = [...expectedKeys].sort()
  return (
    actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index])
  )
}

export function cloneProtocol(
  protocol: Readonly<GuidedRetakeProtocol>,
): GuidedRetakeProtocol {
  const range = protocol.task.comfortableRangeMidiCents
  return {
    identity: { ...protocol.identity },
    task: {
      ...protocol.task,
      comfortableRangeMidiCents: range === null ? null : [range[0], range[1]],
      targetMidiCents: [...protocol.task.targetMidiCents],
      parameters: Object.fromEntries(
        Object.entries(protocol.task.parameters).map(([key, value]) => [
          key,
          Array.isArray(value) ? [...value] : value,
        ]),
      ),
    },
    comparisonFingerprint: protocol.comparisonFingerprint,
  }
}

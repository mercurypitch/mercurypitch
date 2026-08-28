// ============================================================
// The stage's keys: how they are named, and how a press matches.
//
// "1 · 2 on the keyboard" under the question, so a keyboard player
// knows the digits answer without hunting the keycaps on the pads.
// Space stays with the pad that shows it.
// ============================================================

import type { StageKey } from './EarStage'

/** `event.key` first; then the physical digit, so a numpad "1", a
 *  shifted digit or a layout that moves the top row still answers. */
export function keyMatches(
  key: string,
  event: Pick<KeyboardEvent, 'key' | 'code'>,
): boolean {
  if (event.key === key) return true
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(event.code)?.[1]
  return digit !== undefined && digit === key
}

export function formatKeyHint(keys: readonly StageKey[]): string | undefined {
  const names = keys.map((entry) => entry.key).filter((key) => key !== 'Space')
  const first = names[0]
  const last = names[names.length - 1]
  if (first === undefined || last === undefined) return undefined
  const list = names.length > 3 ? `${first}–${last}` : names.join(' · ')
  return `${list} on the keyboard`
}

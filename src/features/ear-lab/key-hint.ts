// ============================================================
// formatKeyHint — the keys the stage is listening for, said once.
//
// "1 · 2 on the keyboard" under the question, so a keyboard player
// knows the digits answer without hunting the keycaps on the pads.
// Space stays with the pad that shows it.
// ============================================================

import type { StageKey } from './EarStage'

export function formatKeyHint(keys: readonly StageKey[]): string | undefined {
  const names = keys.map((entry) => entry.key).filter((key) => key !== 'Space')
  const first = names[0]
  const last = names[names.length - 1]
  if (first === undefined || last === undefined) return undefined
  const list = names.length > 3 ? `${first}–${last}` : names.join(' · ')
  return `${list} on the keyboard`
}

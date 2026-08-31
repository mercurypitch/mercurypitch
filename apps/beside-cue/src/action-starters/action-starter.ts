// ============================================================
// Local action starters — offline-safe instruction and timer resolution
// ============================================================

import type { Cue } from '@irchiinnuss/beside-cue-core'
import { findActionDefinition, findActionDefinitionByLegacyValue, } from '@/content/actions'

export type LocalActionStarter =
  | {
      readonly kind: 'instruction'
      readonly instruction: string
      readonly actionId?: string
    }
  | {
      readonly kind: 'quiet-timer'
      readonly instruction: string
      readonly actionId: string
      readonly durationMs: number
    }

type SavedSideB = Pick<Cue, 'bSideSuggestionId' | 'bSideText'>

function resolvedAction(cue: SavedSideB) {
  if (cue.bSideSuggestionId !== undefined) {
    return findActionDefinition(cue.bSideSuggestionId)
  }

  return findActionDefinitionByLegacyValue(cue.bSideText)
}

export function resolveLocalActionStarter(cue: SavedSideB): LocalActionStarter {
  const action = resolvedAction(cue)
  const durationMinutes = action?.durationMinutes

  if (
    action?.kind === 'quiet-timer' &&
    action.requires.includes('timer') &&
    Number.isFinite(durationMinutes) &&
    Number.isInteger(durationMinutes) &&
    durationMinutes !== undefined &&
    durationMinutes > 0
  ) {
    return {
      kind: 'quiet-timer',
      instruction: cue.bSideText,
      actionId: action.id,
      durationMs: durationMinutes * 60_000,
    }
  }

  return {
    kind: 'instruction',
    instruction: cue.bSideText,
    ...(action === undefined ? {} : { actionId: action.id }),
  }
}

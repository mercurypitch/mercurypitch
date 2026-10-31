// ============================================================
// The Legend's card over the Sing room's exercises
// ============================================================
//
// The Sing room offers the running Legend above its exercises, as More's
// Together group does: the same room, a second way in (the approved
// mock-ups, docs/plans/native-more-and-community.md). The room cannot
// import the shell, so the shell hands it the card's words and the way in
// through its API (`legend`, native-shell-store.ts), as it hands it
// `openExercise` (premium-exercise-wiring.ts). The words come from the
// Legend the phone kept (legend-store.ts), so the card asks the network
// nothing. Behind NATIVE_LEAGUES: a store build registers none, and the
// picker draws no card.

import { NATIVE_LEAGUES } from '@/lib/native-build'
import type { LegendCardWords, NativeShellApi, } from '@/stores/native-shell-store'
import { pushScreen } from '../run-shell-store'
import { closesShortLine } from './legend-lines'
import { legendCard, legendStanding } from './legend-store'

/** What the shell adds to the API it registers for the rooms. */
export type LegendCardApi = Pick<NativeShellApi, 'legend'>

/**
 * The card's words now; null while no Legend is open, before one is read,
 * and for one kept past even its grace (a phone that could not read the
 * next): a card for it would open a room with nothing to sing.
 */
export function legendCardWords(nowMs: number): LegendCardWords | null {
  const card = legendCard()
  if (card === undefined || card === null) return null
  const when = closesShortLine(card.endsAt, nowMs)
  if (when === null) return null
  // The store keeps a best for the account and the Legend it was read for.
  const standing = legendStanding()
  return {
    title: card.title,
    when,
    line: 'Everyone sings the same notes, as written.',
    best: standing === null ? null : `Your best ${Math.round(standing.best)}%`,
  }
}

function install(): LegendCardApi {
  return {
    legend: {
      card: () => legendCardWords(Date.now()),
      open: () => pushScreen('legend'),
    },
  }
}

export function installLegendCard(): LegendCardApi {
  return NATIVE_LEAGUES ? install() : {}
}

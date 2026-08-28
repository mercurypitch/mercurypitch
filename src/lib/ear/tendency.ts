// ============================================================
// tendency — which degree wants to move, and where.
//
// The Pull's table. In a major key the leading tone leans hardest,
// up to the tonic; 4 leans down to 3; 6 and 2 lean more gently to
// 5 and 1; 1, 3 and 5 rest. The bank pairs each restless degree
// with each stable one, then the restless with each other where
// the ranking is not in dispute — 6 against 2 and 7 against 4 are
// left out, since good ears disagree there.
//
// Pure. Nothing here plays a sound.
// ============================================================

import type { EarBankItem } from './banks'
import { degreeSolfege } from './phrase'

export interface Tendency {
  /** Where the degree resolves; 8 is the tonic above. */
  toward: number
  /** How hard it leans, 0 for the stable degrees. */
  pull: number
}

export const TENDENCY: Readonly<Record<number, Tendency>> = {
  1: { toward: 1, pull: 0 },
  2: { toward: 1, pull: 2 },
  3: { toward: 3, pull: 0 },
  4: { toward: 3, pull: 3 },
  5: { toward: 5, pull: 0 },
  6: { toward: 5, pull: 2 },
  7: { toward: 8, pull: 4 },
}

export function pullOf(degree: number): number {
  return TENDENCY[degree]?.pull ?? 0
}

export function resolvesTo(degree: number): number {
  return TENDENCY[degree]?.toward ?? degree
}

/** The degree of the two that leans harder. Ties are not in the
 *  bank; if one is asked for, the first wins. */
export function morePulling(a: number, b: number): number {
  return pullOf(b) > pullOf(a) ? b : a
}

/** "Ti leaning to Do′", or "Do at rest". */
export function leaningWord(degree: number): string {
  const tendency = TENDENCY[degree] as Tendency | undefined
  if (!tendency || tendency.pull === 0)
    return `${degreeSolfege(degree)} at rest`
  return `${degreeSolfege(degree)} leaning to ${degreeSolfege(tendency.toward)}`
}

const PAIRS: ReadonlyArray<[number, number, number]> = [
  // restless against stable: the leading tone is plainest
  [7, 1, 900],
  [7, 3, 950],
  [7, 5, 1000],
  [4, 1, 1000],
  [4, 3, 1050],
  [4, 5, 1100],
  [6, 1, 1150],
  [6, 3, 1200],
  [6, 5, 1250],
  [2, 1, 1150],
  [2, 3, 1200],
  [2, 5, 1250],
  // restless against restless, where the ranking is settled
  [7, 6, 1350],
  [7, 2, 1350],
  [4, 6, 1450],
  [4, 2, 1450],
]

export const PULL_BANK: readonly EarBankItem[] = PAIRS.map(([a, b, seed]) => ({
  itemId: `pull-${a}v${b}`,
  label: `${a} vs ${b}`,
  name: `${degreeSolfege(a)} against ${degreeSolfege(b)}`,
  seed,
  payload: [a, b],
}))

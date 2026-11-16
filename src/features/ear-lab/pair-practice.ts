// ============================================================
// Pair practice — a short run on the two items a rated run mixed up.
//
// The native room's rated plate lists where a run slipped ("4 Fa heard
// as 5 Sol, twice"), and a slip offers practice on just those two. Such
// a run rates nothing: its questions come from two items the singer has
// just shown they confuse, so an answer to it says little about the
// singer against the whole bank, and an Elo update from it would pull
// the rating and the two items' difficulties toward one hard pair. It is
// practice, so nothing is written but the minutes, and the rating plate
// is not drawn for it.
//
// Its questions are balanced and shuffled: each item comes up as often
// as the other, in an order nothing about the last question predicts.
// Picking without repeats (as a rated run does) would alternate two
// items strictly and give every answer away. A lesson's set (two items or
// more, lib/ear/subsets.ts) is asked the same way, by balancedOrder.
// ============================================================

/** Questions in a pair practice: a Today's short run's length. */
export const PAIR_PRACTICE_ROUNDS = 8

/** The two items, each `rounds / 2` times (an odd one left to a coin),
 *  in a shuffled order. `random` is an argument so a test can hold it. */
export function pairOrder<T>(
  pair: readonly [T, T],
  rounds: number,
  random: () => number = Math.random,
): T[] {
  return balancedOrder(pair, rounds, random)
}

/** Any number of items asked the same way: each `rounds / n` times, the
 *  rounds left over each a different item drawn at random, in a shuffled
 *  order. A lesson's set (lib/ear/subsets.ts) asks its items so, for the
 *  same reason as a pair: a run that never repeats an item back to back
 *  would give a two-item set's answers away. */
export function balancedOrder<T>(
  items: readonly T[],
  rounds: number,
  random: () => number = Math.random,
): T[] {
  if (items.length === 0) return []
  const each = Math.floor(rounds / items.length)
  const order: T[] = items.flatMap((item) =>
    Array.from({ length: each }, () => item),
  )
  const left = [...items]
  for (let k = rounds % items.length; k > 0; k--) {
    order.push(left.splice(Math.floor(random() * left.length), 1)[0])
  }
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

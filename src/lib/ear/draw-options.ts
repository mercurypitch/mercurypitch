// ============================================================
// draw-options — a menu of N with the answer among them.
//
// Cadence and Subdivide show four pads out of a larger pool; the
// right one sits at a random slot beside three others drawn fresh
// each round, so the menu never repeats and never gives the
// answer away by position. Randomness is an argument, so a test
// can hold it still.
//
// A pair practice (features/ear-lab/pair-practice.ts) asks one of
// two items each round, so both stand on the pads every round, each
// at a random slot: a menu holding only one of the two would name it.
// ============================================================

export function drawOptions<T>(
  item: T,
  pool: readonly T[],
  idOf: (entry: T) => string,
  count = 4,
  random: () => number = Math.random,
  /** Drawn every time beside the item, at a random slot of its own. */
  alongside?: T,
): T[] {
  const kept =
    alongside === undefined || idOf(alongside) === idOf(item)
      ? undefined
      : alongside
  const others = pool.filter(
    (other) =>
      idOf(other) !== idOf(item) &&
      (kept === undefined || idOf(other) !== idOf(kept)),
  )
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[others[i], others[j]] = [others[j], others[i]]
  }
  const drawn = others.slice(
    0,
    Math.max(0, count - (kept === undefined ? 1 : 2)),
  )
  if (kept !== undefined) {
    drawn.splice(Math.floor(random() * (drawn.length + 1)), 0, kept)
  }
  const slot = Math.min(drawn.length, Math.floor(random() * count))
  drawn.splice(slot, 0, item)
  return drawn
}

// ============================================================
// draw-options — a menu of N with the answer among them.
//
// Cadence and Subdivide show four pads out of a larger pool; the
// right one sits at a random slot beside three others drawn fresh
// each round, so the menu never repeats and never gives the
// answer away by position. Randomness is an argument, so a test
// can hold it still.
// ============================================================

export function drawOptions<T>(
  item: T,
  pool: readonly T[],
  idOf: (entry: T) => string,
  count = 4,
  random: () => number = Math.random,
): T[] {
  const others = pool.filter((other) => idOf(other) !== idOf(item))
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[others[i], others[j]] = [others[j], others[i]]
  }
  const drawn = others.slice(0, Math.max(0, count - 1))
  const slot = Math.min(drawn.length, Math.floor(random() * count))
  drawn.splice(slot, 0, item)
  return drawn
}

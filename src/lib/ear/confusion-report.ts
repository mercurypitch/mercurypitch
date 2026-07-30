// ============================================================
// Ear Lab — the Ear Report's confusion maths (pure).
//
// The store keeps raw miss pairs ("deg-4>deg-5": 3). This module
// turns them into the two things the report renders: a full
// expected × answered matrix for the heatmap, and a ranked list
// of the worst confusions with rates — "you hear Fa as Sol 41%
// of the time" is the single most actionable sentence the Ear
// Lab can produce, and no shipping trainer produces it.
// ============================================================

export interface ConfusionCell {
  expected: string
  answered: string
  count: number
}

export interface TopConfusion extends ConfusionCell {
  /** Share of that item's attempts that became this confusion, or
   *  null when attempts are unknown (mic answers, no item state). */
  rate: number | null
}

export interface ConfusionMatrix {
  labels: string[]
  /** rows = expected, cols = answered, in `labels` order. */
  cells: number[][]
  /** Largest single cell (heatmap normalisation). */
  maxCount: number
  totalMisses: number
}

/** Build the matrix over a fixed label order. Pairs mentioning
 *  labels outside the order (older data after a rename) are
 *  dropped rather than crashing the report. */
export function buildConfusionMatrix(
  confusions: Readonly<Record<string, number>>,
  labels: readonly string[],
): ConfusionMatrix {
  const index = new Map(labels.map((label, i) => [label, i]))
  const cells = labels.map(() => labels.map(() => 0))
  let maxCount = 0
  let totalMisses = 0

  for (const [key, count] of Object.entries(confusions)) {
    const sep = key.indexOf('>')
    if (sep < 0) continue
    const row = index.get(key.slice(0, sep))
    const col = index.get(key.slice(sep + 1))
    if (row === undefined || col === undefined) continue
    cells[row][col] += count
    totalMisses += count
    if (cells[row][col] > maxCount) maxCount = cells[row][col]
  }

  return { labels: [...labels], cells, maxCount, totalMisses }
}

/** The worst confusions, ranked by count then rate. */
export function topConfusions(
  confusions: Readonly<Record<string, number>>,
  options?: {
    limit?: number
    /** Attempts per expected label, for rate computation. */
    attemptsFor?: (expected: string) => number
  },
): TopConfusion[] {
  const limit = options?.limit ?? 3
  const out: TopConfusion[] = []

  for (const [key, count] of Object.entries(confusions)) {
    const sep = key.indexOf('>')
    if (sep < 0 || count <= 0) continue
    const expected = key.slice(0, sep)
    const answered = key.slice(sep + 1)
    const attempts = options?.attemptsFor?.(expected) ?? 0
    out.push({
      expected,
      answered,
      count,
      rate: attempts > 0 ? Math.min(1, count / attempts) : null,
    })
  }

  return out
    .sort((a, b) => b.count - a.count || (b.rate ?? 0) - (a.rate ?? 0))
    .slice(0, limit)
}

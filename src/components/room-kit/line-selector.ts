// ============================================================
// Merc's line selector: the next line for a moment, never twice running
// ============================================================
//
// Each premium exercise keeps its own table of Merc's lines, keyed by its
// moments (Long note's is merc-lines.ts), and asks here for the next one.
// Every moment has a few variants, and the selector never says the same
// line twice in a row for a moment. `{note}` becomes the target ("A3").

/** One of Merc's lines. */
export interface MercLine {
  /** Stable id, for a recorded voice line later. */
  readonly id: string
  readonly text: string
}

export interface LineSelector<M extends string> {
  /** The next line for a moment, with `{note}` filled in. */
  next(moment: M, note: string): string
}

export function fillNote(text: string, note: string): string {
  return text.replaceAll('{note}', note)
}

export function createLineSelector<M extends string>(
  lines: Readonly<Record<M, readonly MercLine[]>>,
  random: () => number = Math.random,
): LineSelector<M> {
  const last = new Map<M, string>()
  return {
    next(moment, note) {
      const all = lines[moment]
      const previous = last.get(moment)
      const pool =
        all.length > 1 ? all.filter((line) => line.id !== previous) : all
      const sample = random()
      const index = Number.isFinite(sample)
        ? Math.min(
            pool.length - 1,
            Math.max(0, Math.floor(sample * pool.length)),
          )
        : 0
      const line = pool[index]
      last.set(moment, line.id)
      return fillNote(line.text, note)
    },
  }
}

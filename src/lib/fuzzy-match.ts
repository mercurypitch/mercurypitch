// ============================================================
// fuzzy-match — lightweight, dependency-free text matching
// ============================================================
//
// Used to filter the karaoke session list by song name. Case-insensitive:
// a direct substring wins; otherwise an in-order subsequence match (so
// "gd mr" matches "Green Day - Mr. Brightside"). Returns a score for optional
// ranking (higher = better; 0 = no match).

/** Returns a match score in [0, 1]; 0 means no match. */
export function fuzzyScore(query: string, text: string): number {
  const q = query.trim().toLowerCase()
  if (q === '') return 1
  const t = text.toLowerCase()

  // Exact / prefix / substring — strongest signals.
  if (t === q) return 1
  const idx = t.indexOf(q)
  if (idx === 0) return 0.95
  if (idx > 0) return 0.85

  // Subsequence: every query char appears in order. Ignore spaces in the
  // query so multi-word queries ("gd mr") match across separators.
  const compact = q.replace(/\s+/g, '')
  let ti = 0
  let matched = 0
  for (let qi = 0; qi < compact.length; qi++) {
    const ch = compact[qi]
    let found = -1
    for (let j = ti; j < t.length; j++) {
      if (t[j] === ch) {
        found = j
        break
      }
    }
    if (found === -1) return 0
    ti = found + 1
    matched++
  }
  // Reward density (fewer gaps relative to text length).
  return (
    0.5 * (matched / Math.max(compact.length, 1)) + 0.2 * (matched / t.length)
  )
}

/** True when `text` matches `query` (empty query matches everything). */
export function fuzzyMatch(query: string, text: string): boolean {
  return fuzzyScore(query, text) > 0
}

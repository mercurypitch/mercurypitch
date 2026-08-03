// ── Who just walked in ───────────────────────────────────────────────
// The words the room uses when somebody arrives or leaves.
//
// Randomised, because a room that says the same sentence every time reads
// like a log file, and never the same phrase twice running, because that
// is exactly when randomness looks broken.
//
// Pure: the picker takes its own state, so a test can watch a whole run of
// choices without touching a store or a clock.
//
// See docs/plans/jam-arrival-notices.md.

/** Where the name goes. Every phrase has exactly one. */
const NAMES = '{names}'

export const ARRIVAL_PHRASES = [
  `${NAMES} slid into the jam`,
  `${NAMES} plugged in`,
  `${NAMES} took the stage`,
  `${NAMES} stepped up to the mic`,
  `${NAMES} joined the harmony`,
  `${NAMES} counted themselves in`,
] as const

export const DEPARTURE_PHRASES = [
  `${NAMES} unplugged`,
  `${NAMES} slipped out`,
  `${NAMES} left the stage`,
  `${NAMES} packed up`,
] as const

/**
 * Losing the host changes what the room can do, so it gets its own line
 * rather than the general "somebody left".
 */
export const HOST_LEFT = 'The host stepped away — the room is holding'
export const HOST_RETURNED = 'You are running the room now'

/**
 * How many names are spelled out before the rest become a count.
 *
 * Three is about where a list stops being people and starts being a
 * crowd; past that the names are noise and the number is the information.
 */
const MAX_NAMED = 3

/** "Ada", "Ada and Bo", "Ada, Bo and Cy", "Ada, Bo and 4 others". */
export function joinNames(names: readonly string[]): string {
  const clean = names.filter((n) => n.trim() !== '')
  if (clean.length === 0) return 'Someone'
  if (clean.length === 1) return clean[0] ?? 'Someone'
  if (clean.length <= MAX_NAMED) {
    return `${clean.slice(0, -1).join(', ')} and ${clean[clean.length - 1]}`
  }
  const shown = clean.slice(0, MAX_NAMED - 1)
  const rest = clean.length - shown.length
  return `${shown.join(', ')} and ${rest} others`
}

/**
 * A phrase picker that never repeats itself back to back.
 *
 * Returns the chosen phrase with `{names}` still in it: the caller keeps
 * it and re-fills it as more people arrive, so a toast that started as
 * "Ada plugged in" becomes "Ada and Bo plugged in" rather than switching
 * to a different sentence mid-read.
 */
export function makePhrasePicker(
  phrases: readonly string[],
  random: () => number = Math.random,
): () => string {
  let last = -1
  return () => {
    if (phrases.length === 0) return NAMES
    if (phrases.length === 1) return phrases[0] ?? NAMES
    let i = Math.floor(random() * phrases.length) % phrases.length
    if (i === last) i = (i + 1) % phrases.length
    last = i
    return phrases[i] ?? NAMES
  }
}

/** Put the names into a phrase from either book. */
export function fillPhrase(phrase: string, names: readonly string[]): string {
  return phrase.replace(NAMES, joinNames(names))
}

// ============================================================
// Voice command grammar — pure utterance-to-command matching
// ============================================================
//
// No model in the loop: the STT engine hands over text, this file decides
// what (if anything) it means. Full-utterance matching is deliberate — it is
// the main defence against backing-track lyrics triggering the transport:
// "play" matches, "play that funky music" does not. Homophone repair (e.g.
// "for" as 4) is intentionally NOT attempted; recognizers emit digits for
// numbers in command context, and guessing turns lyrics into numbers.

import type { VoiceCommand, VoiceMatch } from './types'

// ── Normalization ──────────────────────────────────────────────

/**
 * Lowercase, strip diacritics and punctuation, collapse whitespace. Dots
 * survive only when they start a decimal ("1.5", ".5") so numeric tokens
 * keep their value while "play." still reads as "play".
 */
export function normalizeUtterance(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}.]+/gu, ' ')
    .replace(/\.(?![0-9])/g, ' ')
    .replace(/([0-9])(\p{L})/gu, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Politeness / wake-word stripping ───────────────────────────

const LEADING_FILLERS = new Set(['hey', 'ok', 'okay'])
const WAKE_NAME = 'mercury'

export interface FillerSplit {
  tokens: string[]
  /** True when the utterance carried the wake word ("mercury ..."). */
  hadWakeWord: boolean
}

/**
 * Drops an optional leading "hey/ok/okay [mercury]" or bare "mercury" plus a
 * leading/trailing "please", so a wake-word habit works without being
 * required — and reports whether the wake word was there, for the
 * wake-word-required-while-playing mode. Only ever removes tokens — never
 * rewrites them.
 */
export function splitFillerTokens(tokens: readonly string[]): FillerSplit {
  let start = 0
  let end = tokens.length
  let hadWakeWord = false
  if (start < end && LEADING_FILLERS.has(tokens[start])) start++
  if (start < end && tokens[start] === WAKE_NAME) {
    start++
    hadWakeWord = true
  }
  if (start < end && tokens[start] === 'please') start++
  if (end > start && tokens[end - 1] === 'please') end--
  return { tokens: tokens.slice(start, end), hadWakeWord }
}

export function stripFillerTokens(tokens: readonly string[]): string[] {
  return splitFillerTokens(tokens).tokens
}

// ── Number parsing ─────────────────────────────────────────────

const SMALL_NUMBER_WORDS = new Map<string, number>(
  Object.entries({
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
  }),
)

const TENS_NUMBER_WORDS = new Map<string, number>(
  Object.entries({
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
  }),
)

const DIGIT_TOKEN = /^[0-9]*\.?[0-9]+$/

interface ParsedNumber {
  value: number
  consumed: number
}

/** "twenty" / "twenty five" / "seven" — 0..99 in words. */
function parseSmallNumber(
  tokens: readonly string[],
  start: number,
): ParsedNumber | null {
  const word = tokens[start]
  if (word === undefined) return null
  const tens = TENS_NUMBER_WORDS.get(word)
  if (tens !== undefined) {
    const unit = SMALL_NUMBER_WORDS.get(tokens[start + 1] ?? '')
    if (unit !== undefined && unit >= 1 && unit <= 9) {
      return { value: tens + unit, consumed: 2 }
    }
    return { value: tens, consumed: 1 }
  }
  const small = SMALL_NUMBER_WORDS.get(word)
  if (small !== undefined) return { value: small, consumed: 1 }
  return null
}

/**
 * Parses a number starting at `tokens[start]`: digit tokens ("15", "1.5",
 * ".5") or English words up to the hundreds ("twenty five", "one hundred
 * fifty"). Returns how many tokens the number consumed, or null when the
 * position does not start a number.
 */
export function parseNumberAt(
  tokens: readonly string[],
  start: number,
): ParsedNumber | null {
  const word = tokens[start]
  if (word === undefined) return null
  if (DIGIT_TOKEN.test(word)) {
    const value = Number.parseFloat(word)
    return Number.isFinite(value) ? { value, consumed: 1 } : null
  }
  const lead = parseSmallNumber(tokens, start)
  if (lead === null) return null
  let { value, consumed } = lead
  if (tokens[start + consumed] === 'hundred') {
    value *= 100
    consumed++
    const rest = parseSmallNumber(tokens, start + consumed)
    if (rest !== null) {
      value += rest.value
      consumed += rest.consumed
    }
  }
  // Spoken decimals — "one point five" (single fractional digit; that is
  // how speeds are actually said).
  if (tokens[start + consumed] === 'point') {
    const fraction = SMALL_NUMBER_WORDS.get(tokens[start + consumed + 1] ?? '')
    if (fraction !== undefined && fraction <= 9) {
      value += fraction / 10
      consumed += 2
    }
  }
  return { value, consumed }
}

// ── Matching ───────────────────────────────────────────────────

interface PhraseMatch {
  value?: number
  /** Second `<n>` occurrence, for range phrases ("loop from <n> to <n>"). */
  value2?: number
}

/**
 * A phrase matches only when it consumes the WHOLE utterance — leftover
 * tokens on either side mean no match. Each `<n>` consumes whatever tokens
 * parse as one number; a phrase may carry two.
 */
function matchPhrase(
  tokens: readonly string[],
  phrase: string,
): PhraseMatch | null {
  const phraseTokens = phrase.split(' ').filter(Boolean)
  let ti = 0
  const values: number[] = []
  for (const phraseToken of phraseTokens) {
    if (phraseToken === '<n>') {
      const parsed = parseNumberAt(tokens, ti)
      if (parsed === null) return null
      values.push(parsed.value)
      ti += parsed.consumed
      continue
    }
    if (tokens[ti] !== phraseToken) return null
    ti++
  }
  if (ti !== tokens.length) return null
  return { value: values[0], value2: values[1] }
}

export type VoiceResolveOutcome =
  | {
      kind: 'matched'
      command: VoiceCommand
      n?: number
      m?: number
      phrase: string
    }
  /**
   * A phrase matched but every command carrying it is gated off (wrong tab,
   * suspended surface). Distinct from 'none' so the user hears "not
   * available here" instead of "did not understand".
   */
  | { kind: 'unavailable'; command: VoiceCommand }
  /** Wake word required but absent — expected while music plays; callers
   *  give no feedback at all (it is the backing track singing, not the
   *  user talking to us). */
  | { kind: 'ignored' }
  | { kind: 'none' }

export interface VoiceResolveOptions {
  /** Only utterances starting with the wake word count as commands. */
  requireWakeWord?: boolean
}

/** Leading tokens the salvage pass may discard (see resolveVoiceCommand). */
const SALVAGE_MAX_DROPPED_TOKENS = 2

/**
 * Runs one utterance against the registered commands. The first command
 * whose `available()` passes and whose phrase consumes the full utterance
 * wins; registration order is the priority order. When only gated-off
 * commands match the phrase, the outcome says so.
 */
export function resolveVoiceCommand(
  rawUtterance: string,
  commands: readonly VoiceCommand[],
  options?: VoiceResolveOptions,
): VoiceResolveOutcome {
  const split = splitFillerTokens(
    normalizeUtterance(rawUtterance).split(' ').filter(Boolean),
  )
  const tokens = split.tokens
  if (tokens.length === 0) return { kind: 'none' }
  if (options?.requireWakeWord === true && !split.hadWakeWord) {
    return { kind: 'ignored' }
  }
  let unavailable: VoiceCommand | null = null
  for (const command of commands) {
    const isAvailable = command.available === undefined || command.available()
    for (const phrase of command.phrases) {
      const matched = matchPhrase(tokens, phrase)
      if (matched === null) continue
      if (isAvailable) {
        return {
          kind: 'matched',
          command,
          n: matched.value,
          m: matched.value2,
          phrase,
        }
      }
      unavailable ??= command
      break
    }
  }

  // Salvage pass — self-corrections and stray lead-ins: "backwards...
  // forward 60 seconds", "guitar, i play guitar". Up to two leading tokens
  // may be dropped, and what remains must be at least two tokens, so
  // single-word commands stay exact-only ("baby stop" and lyric tails never
  // fire) while a changed mind mid-utterance still lands.
  for (
    let drop = 1;
    drop <= SALVAGE_MAX_DROPPED_TOKENS && tokens.length - drop >= 2;
    drop++
  ) {
    const tail = tokens.slice(drop)
    for (const command of commands) {
      if (command.available !== undefined && !command.available()) continue
      for (const phrase of command.phrases) {
        const matched = matchPhrase(tail, phrase)
        if (matched !== null) {
          return {
            kind: 'matched',
            command,
            n: matched.value,
            m: matched.value2,
            phrase,
          }
        }
      }
    }
  }

  if (unavailable !== null) return { kind: 'unavailable', command: unavailable }
  return { kind: 'none' }
}

/** Matched-only view of `resolveVoiceCommand`, for callers and tests that
 *  do not care why an utterance failed. */
export function matchVoiceCommand(
  rawUtterance: string,
  commands: readonly VoiceCommand[],
): VoiceMatch | null {
  const outcome = resolveVoiceCommand(rawUtterance, commands)
  if (outcome.kind !== 'matched') return null
  return {
    command: outcome.command,
    n: outcome.n,
    m: outcome.m,
    phrase: outcome.phrase,
  }
}

/**
 * True when `phrase` is a strict prefix of another registered phrase.
 * Eager interim execution defers such matches to the final transcript:
 * an interim "go" that is still becoming "go to karaoke" — or "loop"
 * becoming "loop off" — must not fire the shorter command mid-sentence.
 * Compared over raw phrase strings, so `<n>` slots line up literally
 * ("back <n>" is a prefix of "back <n> seconds").
 */
export function phraseExtendsFurther(
  phrase: string,
  commands: readonly VoiceCommand[],
): boolean {
  const prefix = `${phrase} `
  return commands.some((command) =>
    command.phrases.some((candidate) => candidate.startsWith(prefix)),
  )
}

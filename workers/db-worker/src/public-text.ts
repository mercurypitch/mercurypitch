// ── Text other singers read ──────────────────────────────────────────
// Every column a singer writes that another singer reads, with the name
// filter's rules for it (name-filter.ts). validateWrite checks each write
// with it; the moderation console's name audit reads existing rows with it
// (reports.ts). A column a PATCH leaves out is not checked. Pure, as
// validation.ts is, so the app can ask before it posts.
//
// A share's `author` is not here: it is a server column now, written from
// the profile (share-authors.ts), so a client's value is dropped unread.

import type { NameProblem, NameRules } from './name-filter'
import { DISPLAY_NAME_MAX, hasSlur, nameProblem } from './name-filter'
import { WORD_NOT_ALLOWED } from './public-text-wording'

/** The longest share name: the app's shared result already caps it here. */
export const SHARE_NAME_MAX = 200
export const BIO_MAX = 300
export const TAG_MAX = 40
export const TAGS_MAX = 20
export const AVATAR_URL_MAX = 500

// Every name is optional: an empty display name reads as "Singer-..." on the
// boards, and an unnamed melody can already be shared.
const NAMES: Readonly<Record<string, Readonly<Record<string, NameRules>>>> = {
  userProfiles: {
    displayName: { max: DISPLAY_NAME_MAX, optional: true },
    bio: { max: BIO_MAX, optional: true, multiline: true },
  },
  sharedMelodies: { melodyName: { max: SHARE_NAME_MAX, optional: true } },
  sharedSessions: { sessionName: { max: SHARE_NAME_MAX, optional: true } },
}

export type TextProblem =
  | NameProblem
  | 'not-text'
  | 'too-many'
  | 'not-https'
  | 'slur'

export interface FieldProblem {
  field: string
  problem: TextProblem
}

const WORDS: Readonly<Record<TextProblem, string>> = {
  empty: 'is required',
  'too-long': 'is too long',
  unreadable: 'has characters that cannot be shown',
  words: WORD_NOT_ALLOWED,
  'not-text': 'must be text',
  'too-many': `holds more than ${TAGS_MAX} tags`,
  'not-https': 'must be an https address',
  slur: WORD_NOT_ALLOWED,
}

function nameField(value: unknown, rules: NameRules): TextProblem | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return 'not-text'
  return nameProblem(value, rules)
}

/** Tags arrive as an array in a write and as JSON text in a stored row. */
function tagsProblem(value: unknown): TextProblem | null {
  if (value === null || value === undefined) return null
  let tags: unknown = value
  if (typeof value === 'string') {
    try {
      tags = JSON.parse(value)
    } catch {
      return 'not-text'
    }
  }
  if (!Array.isArray(tags)) return 'not-text'
  if (tags.length > TAGS_MAX) return 'too-many'
  for (const tag of tags) {
    const problem = nameField(tag, { max: TAG_MAX, optional: true })
    if (problem !== null) return problem
  }
  return null
}

/**
 * A melody's lyrics, the `lyricText` of each of its notes, read for slurs.
 * `itemsJson` is JSON text as the app sends it and as a row stores it, but
 * a write may carry the array itself, which the worker stores as the same
 * text, so both are read.
 */
function lyricsProblem(value: unknown): TextProblem | null {
  let items: unknown = value
  if (typeof value === 'string') {
    try {
      items = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (!Array.isArray(items)) return null
  const lyrics = items
    .map((item: unknown) =>
      typeof item === 'object' && item !== null
        ? (item as { lyricText?: unknown }).lyricText
        : undefined,
    )
    .filter((text): text is string => typeof text === 'string')
  return lyrics.length > 0 && hasSlur(lyrics.join(' ')) ? 'slur' : null
}

/** An address, not a name: it is never read for words, only for its shape. */
function avatarProblem(value: unknown): TextProblem | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') return 'not-text'
  if (value.length > AVATAR_URL_MAX) return 'too-long'
  return /^https:\/\/[^\s]+$/u.test(value) ? null : 'not-https'
}

/** Every problem with the text in a row other singers will read. */
export function publicTextProblems(
  entity: string,
  row: Readonly<Record<string, unknown>>,
): FieldProblem[] {
  const problems: FieldProblem[] = []
  const add = (field: string, problem: TextProblem | null): void => {
    if (problem !== null) problems.push({ field, problem })
  }
  const names = Object.hasOwn(NAMES, entity) ? NAMES[entity] : {}
  for (const [field, rules] of Object.entries(names)) {
    add(field, nameField(row[field], rules))
  }
  if (entity === 'userProfiles') add('avatarUrl', avatarProblem(row.avatarUrl))
  if (entity === 'sharedMelodies') {
    add('tags', tagsProblem(row.tags))
    add('itemsJson', lyricsProblem(row.itemsJson))
  }
  return problems
}

/** validateWrite's answer: the first problem, worded, or null. */
export function publicTextError(
  entity: string,
  body: Readonly<Record<string, unknown>>,
): string | null {
  const [first] = publicTextProblems(entity, body)
  return first === undefined ? null : `${first.field} ${WORDS[first.problem]}`
}

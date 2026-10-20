// ============================================================
// Lesson publishing — each lesson's state on this site, why, and what a save said
// ============================================================
//
// A lesson's state on this site is its override when the Content Studio has
// set one (src/lib/lesson-state.ts), and the code's default otherwise: a
// released lesson is published, a draft is published where this site shows
// drafts and held back where it does not, and a lesson with no page has
// nothing to publish. Who set an override, and when, is the newest matching
// change in the lesson's log.
//
// Whether this site shows drafts is the page's to pass in: draft-switch.ts's
// DRAFTS_SHOWN, the answer this build was made with, never whether the build
// carries a draft's page (lesson-admin.ts `publishedByDefault`).
//
// The words the Lessons page prints for all of that are here too, from the
// state words to what the page says after a save, so the page and its tests
// read one set. Admin copy, in American English. No DOM.

import type { LessonOverride, LessonStateChange, LessonStateField, } from '@/lib/lesson-state'
import type { LessonRow } from './lesson-admin'
import { publishedByDefault } from './lesson-admin'
import type { LessonApiError } from './lesson-state-client'

/**
 * Why a lesson stands where it does on this site.
 * - `released`, `draft-shown` and `draft-hidden`: the code's default.
 * - `set`: an override set here.
 * - `no-page`: no page yet, so nothing to publish.
 * - `film`: the trailer, a film that never has a page.
 */
export type PublishReason =
  | 'released'
  | 'draft-shown'
  | 'draft-hidden'
  | 'set'
  | 'no-page'
  | 'film'

export interface PublishView {
  /** Whether this site is meant to serve its page, as the state and the build decide. */
  readonly published: boolean
  readonly reason: PublishReason
  /** What the code decides on this site, the state aside. */
  readonly byDefault: boolean
  /** Whether its publish state is set here, rather than left to the code. */
  readonly overridden: boolean
  /** Whether it has a page to publish. */
  readonly canPublish: boolean
  /** The change that set the override: who and when. Null while unread, or when the log has none. */
  readonly change: LessonStateChange | null
}

/** The newest change of `field` in a log read newest first. */
export function latestChange(
  log: readonly LessonStateChange[] | null,
  field: LessonStateField,
): LessonStateChange | null {
  return log?.find((change) => change.field === field) ?? null
}

function defaultReason(row: LessonRow, draftsShown: boolean): PublishReason {
  if (row.path === null) return 'film'
  if (row.build === 'released') return 'released'
  if (row.build === 'draft') return draftsShown ? 'draft-shown' : 'draft-hidden'
  return 'no-page'
}

/** Lesson `row`'s state on this site, from its override, its log, and whether this site shows drafts. */
export function publishView(
  row: LessonRow,
  override: LessonOverride,
  log: readonly LessonStateChange[] | null,
  draftsShown: boolean,
): PublishView {
  const canPublish = row.written && row.path !== null
  const byDefault = publishedByDefault(row, draftsShown)
  const set =
    typeof override.published === 'boolean' ? override.published : null
  const overridden = set !== null
  return {
    published: canPublish && (set ?? byDefault),
    reason: canPublish && overridden ? 'set' : defaultReason(row, draftsShown),
    byDefault,
    overridden,
    canPublish,
    change: overridden ? latestChange(log, 'published') : null,
  }
}

/** The state in a word or two: Published, Unpublished, No page yet, or No page for the trailer. */
export function stateWord(view: PublishView): string {
  if (view.reason === 'film') return 'No page'
  if (view.reason === 'no-page') return 'No page yet'
  return view.published ? 'Published' : 'Unpublished'
}

const FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/**
 * "Oct 20, 2:02 PM", in the viewer's time zone, breaking only after its
 * comma; the text as given if it is not a time.
 */
export function changeTime(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return iso
  // No-break spaces hold "Oct 20" and "2:02 PM" together on a narrow
  // line. ICU's own narrow one before PM becomes a full-width one.
  return FORMAT.format(at)
    .replace(/\s/g, '\u00a0')
    .replace(/,\u00a0/g, ', ')
}

/** Who made a change: the Access identity, or the shared key that has none. */
export function changedBy(change: LessonStateChange): string {
  return change.changedBy === null
    ? 'with the shared admin key'
    : `by ${change.changedBy}`
}

const FIELD_WORDS: Record<Exclude<LessonStateField, 'published'>, string> = {
  hook: 'Hook',
  tease: 'Tease',
}

/** What a change did: "Published", "Hook set to “figures”", "Tease set back to the default". */
export function changeWords(change: LessonStateChange): string {
  const value = change.newValue
  if (change.field === 'published') {
    if (value === null) return 'Publishing set back to the default'
    return value === true ? 'Published' : 'Unpublished'
  }
  const field = FIELD_WORDS[change.field]
  return value === null || typeof value === 'boolean'
    ? `${field} set back to the default`
    : `${field} set to “${value}”`
}

/** One change as a line: "Published by owner@example, Oct 20, 2:02 PM". */
export function changeLine(change: LessonStateChange): string {
  return `${changeWords(change)} ${changedBy(change)}, ${changeTime(change.changedAt)}`
}

const REASON_LINES: Record<Exclude<PublishReason, 'set'>, string> = {
  released: 'Default: released in code',
  'draft-shown': 'Default: this site shows drafts',
  'draft-hidden': 'Default: this site leaves drafts out',
  'no-page': 'Its page is not written yet',
  film: 'A film, with no page of its own',
}

/** Why, in a few words, for the table: "Default: released in code", "Set here by …". */
export function reasonLine(view: PublishView): string {
  if (view.reason !== 'set') return REASON_LINES[view.reason]
  return view.change === null
    ? 'Set here'
    : `Set here ${changedBy(view.change)}, ${changeTime(view.change.changedAt)}`
}

/** What the code decides on this site, as a sentence: the default "Use default" goes back to. */
export function defaultSentence(row: LessonRow, view: PublishView): string {
  if (row.path === null) return 'A film has no page to publish.'
  if (!view.canPublish) {
    return 'It has no page yet, so there is nothing to publish.'
  }
  if (row.build === 'released') {
    return 'The default here is published: it is released in code.'
  }
  return view.byDefault
    ? 'The default here is published: this site shows drafts.'
    : 'The default here is unpublished: this site leaves drafts out.'
}

/** "Lesson 3's" or "The trailer's". */
function possessive(name: string): string {
  return name === 'Trailer' ? "The trailer's" : `${name}'s`
}

export const SITE_FOLLOWS = 'The site follows within about a minute.'

/** What the page says once a save landed. */
export function savedMessage(
  name: string,
  field: LessonStateField,
  value: boolean | string | null,
  changed: boolean,
  defaultPublished: boolean,
): string {
  if (!changed) return `${name} already had that, so nothing changed.`
  if (field === 'published') {
    if (value === null) {
      const word = defaultPublished ? 'published' : 'unpublished'
      return `${name} is back to the default here: ${word}. ${SITE_FOLLOWS}`
    }
    return `${name} is ${value === true ? 'published' : 'unpublished'} here. ${SITE_FOLLOWS}`
  }
  const what = `${possessive(name)} ${field}`
  return typeof value === 'string'
    ? `${what} is now “${value}”. ${SITE_FOLLOWS}`
    : `${what} is back to the default. ${SITE_FOLLOWS}`
}

/** Text as a sentence: the API's error texts carry no full stop. */
export const asSentence = (text: string): string =>
  /[.!?]$/.test(text) ? text : `${text}.`

/** What the page says when a save failed, in the API's words where it gave any. */
export function failedMessage(name: string, error: LessonApiError): string {
  const lead = `${name} was not saved`
  if (error.kind === 'forbidden') {
    return `${lead}: the admin key was not accepted. Change admin key to unlock the studio again.`
  }
  if (error.kind === 'offline') {
    return `${lead}: the content API could not be reached. Check the connection, then try again.`
  }
  return `${lead}: ${asSentence(error.message)}`
}

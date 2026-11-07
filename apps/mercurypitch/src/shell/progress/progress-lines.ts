// ============================================================
// The native Progress page's words and orders, worked out from the snapshot
// ============================================================
//
// Pure: everything here reads the snapshot the web page reads
// (buildProgressPageSnapshot) and decides only how the phone lays it out.
// No number is made here: a tile splits a label the view model already
// wrote ("3 active days" is a 3 over "active days"), the keyboard draws the
// measured range the voice card already states, and the moments keep the
// order they were first shown in.

import type { ProgressActionView, ProgressHistoryItemView, ProgressSourceKind, ProgressWeekView, } from '@/features/progress/ProgressPage'
import { noteToMidi } from '@/lib/frequency-to-note'
import type { PushedScreen } from '../pushed-screen-ids'

/** A tile's figure and its words, from one label: "3 active days". */
export interface TileParts {
  value: string
  words: string
}

/**
 * The figure a label leads with, and the words after it. A label that
 * leads with no figure is all value, so a tile never loses a word.
 */
export function leadNumber(label: string): TileParts {
  const match = /^(\d[\d,.]*%?)\s+(.+)$/u.exec(label.trim())
  return match === null
    ? { value: label.trim(), words: '' }
    : { value: match[1], words: match[2] }
}

/** The kinds of run, in the words the web page's marks use. */
export function sourceWord(source: ProgressSourceKind): string {
  if (source === 'weekly') return 'Weekly Legend'
  if (source === 'exercise') return 'Exercise'
  if (source === 'challenge') return 'Challenge'
  return 'Practice'
}

/**
 * Every name the record gives a kind of run: the marks' word (sourceWord)
 * and the view model's (progress-view-model.ts sourceName), which names a
 * path's stop by its kind.
 */
const KIND_NAMES: Readonly<Record<ProgressSourceKind, readonly string[]>> = {
  practice: ['practice', 'singing'],
  exercise: ['exercise', 'exercises'],
  challenge: ['challenge', 'challenges'],
  weekly: ['weekly legend', 'weekly'],
}

/**
 * A path stop's kind, as a tag beside its name, or nothing where the name
 * is the kind already ("Exercises" needs no "Exercise" beside it).
 */
export function pathTag(
  label: string,
  source: ProgressSourceKind | undefined,
): string | undefined {
  if (source === undefined) return undefined
  return KIND_NAMES[source].includes(label.trim().toLowerCase())
    ? undefined
    : sourceWord(source)
}

/** "Week 12 of 13". */
export function weekOrdinal(index: number, count: number): string {
  return `Week ${index + 1} of ${count}`
}

/** Everything a week's bar says to a screen reader, as its name. */
export function weekLabel(
  week: ProgressWeekView,
  index: number,
  count: number,
): string {
  const sources =
    week.sources.length === 0
      ? 'No recorded kind of run.'
      : `${week.sources.map(sourceWord).join(', ')}.`
  const partial =
    week.coverage === 'partial' ? ' From the loaded history only.' : ''
  const milestone =
    week.milestoneLabel === undefined
      ? ''
      : ` Milestone: ${week.milestoneLabel}.`
  return `${weekOrdinal(index, count)}, ${week.rangeLabel}. ${week.summary} ${sources}${partial}${milestone}`
}

/**
 * The moments in the order the pager shows them. The record lists the
 * chosen moment and up to three others, and choosing another reorders
 * that list around it; the pager keeps the order it first showed while
 * the same moments are on offer, so a swipe never moves the dots under
 * the singer. A different set starts a new order, the chosen one first.
 */
export function pagerOrder(
  previous: readonly string[],
  selected: string,
  alternates: readonly string[],
): string[] {
  const offered = [selected, ...alternates.filter((id) => id !== selected)]
  const same =
    previous.length === offered.length &&
    offered.every((id) => previous.includes(id))
  return same ? [...previous] : offered
}

/**
 * The actions the phone can follow: an in-app place (a hash route) or a
 * step with no place at all. A page of the web app the native bundle does
 * not carry (`/mirror`) would open nothing in the app, so it is left out
 * rather than offered.
 */
export function inAppAction(
  action: ProgressActionView | undefined,
): ProgressActionView | undefined {
  if (action === undefined) return undefined
  return action.href === undefined || action.href.startsWith('#')
    ? action
    : undefined
}

/**
 * The web routes the phone draws as a screen of its own, pushed over the
 * page rather than opened in the web app: Voice Constellation, whose web
 * route is a full-screen dialog that covers the shell and its Back.
 */
const PUSHED_PLACES: Readonly<Record<string, PushedScreen>> = {
  '#/voice-constellation': 'voice-constellation',
}

/** The screen an action pushes, when the phone has its own for its place. */
export function pushedScreenFor(
  action: ProgressActionView,
): PushedScreen | undefined {
  return action.href === undefined ? undefined : PUSHED_PLACES[action.href]
}

/**
 * Where an action's link goes, or nothing where it is a button: a step
 * with no place, or a place the phone pushes as its own screen.
 */
export function linkHref(action: ProgressActionView): string | undefined {
  return pushedScreenFor(action) === undefined ? action.href : undefined
}

/** One day of the history list, under its date. */
export interface HistoryDay {
  label: string
  items: ProgressHistoryItemView[]
}

/** The history's rows, a heading over each run of the same date. */
export function historyDays(
  items: readonly ProgressHistoryItemView[],
): HistoryDay[] {
  const days: HistoryDay[] = []
  for (const item of items) {
    const last = days.at(-1)
    if (last !== undefined && last.label === item.occurredAtLabel) {
      last.items.push(item)
    } else {
      days.push({ label: item.occurredAtLabel, items: [item] })
    }
  }
  return days
}

/**
 * A history row's line under its title: how the attempt went, or what kind
 * of attempt it was when the record has no figure for it.
 */
export function historyLine(item: ProgressHistoryItemView): string {
  return item.facts.length > 0 ? item.facts.join(' · ') : item.context
}

/**
 * Where the attempt is kept, and whether it compares like for like. The
 * coverage line says what the context does ("Comparable attempt details"
 * is "Ready for like-for-like comparison"), so a row says it once.
 */
export function historyWhere(item: ProgressHistoryItemView): string {
  return [item.storageLabel, item.coverageLabel ?? item.context].join(' · ')
}

/** The measured range a voice metric states, as MIDI notes, low first. */
export interface MeasuredRange {
  low: number
  high: number
}

/**
 * "C3–A4" as two notes. Anything else (no range measured, a note the
 * parser does not read) is null, and the keyboard is not drawn.
 */
export function measuredRange(value: string): MeasuredRange | null {
  const parts = value.split(/\s*[–-]\s*/u)
  if (parts.length !== 2) return null
  const low = noteToMidi(parts[0])
  const high = noteToMidi(parts[1])
  if (!Number.isFinite(low) || !Number.isFinite(high) || high < low) {
    return null
  }
  return { low, high }
}

const C2 = 36
const C6 = 84

/** The keyboard the range is drawn on: C2 to C6, or wider for a range past it, from a C to a C. */
export function keyboardSpan(range: MeasuredRange): MeasuredRange {
  const low = Math.min(C2, range.low - (((range.low % 12) + 12) % 12))
  const top = Math.max(C6, range.high)
  const high = top % 12 === 0 ? top : top + (12 - (top % 12))
  return { low, high }
}

/** Whether a MIDI note is a black key. */
export function isBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12)
}

/** Which of the shell's glyphs a moment's chip carries, by its kind's name. */
export type MomentGlyph =
  | 'calendar'
  | 'pulse'
  | 'print'
  | 'mic'
  | 'trophy'
  | 'target'
  | 'return'
  | 'sparkle'

const MOMENT_GLYPHS: Readonly<Record<string, MomentGlyph>> = {
  Consistency: 'calendar',
  'Comparable best': 'pulse',
  Voiceprint: 'print',
  'Latest practice': 'mic',
  Milestone: 'trophy',
  League: 'trophy',
  Challenge: 'target',
  Return: 'return',
}

/** The chip's glyph; a kind the page has no glyph for gets the sparkle. */
export function momentGlyph(kindLabel: string): MomentGlyph {
  return MOMENT_GLYPHS[kindLabel] ?? 'sparkle'
}

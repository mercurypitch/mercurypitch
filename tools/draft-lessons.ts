// ============================================================
// Draft lessons — every lesson page in every build, and a build's default for drafts
// ============================================================
//
// A Find Your Pitch lesson can be finished and still wait on a sign-off:
// Lesson 3 waits on the vocal coach (MASTER-PLAN § 12 item 8). The list of
// drafts is src/features/lessons/kit/drafts.ts. Whether a lesson is live is
// no longer the build's to say: the admin console publishes and unpublishes
// lessons at run time, and the site worker answers an unpublished lesson's
// address with the 404 page (src/lesson-gate.ts). So every build carries
// every lesson page, a draft's included, and main stays safe to release
// with a draft on it because production's worker holds drafts back
// (`LESSON_DRAFTS` in wrangler.jsonc), not because its build leaves them
// out.
//
// Every lesson page is a hand-written document, learn/NN.html, served at
// /learn/NN: each is a build input, and the dev and preview servers rewrite
// each clean path to it. Nothing here or in vite.config.ts names a lesson.
//
// What the build still decides is the default of a page no worker served:
// `pnpm dev`, the e2e bundle's static server, a page saved from the
// browser. That is `VITE_DRAFT_LESSONS`, set per Vite mode, as the
// Glassworks listing is (tools/glassworks-listing.ts): `1` in
// `.env.development`, `0` in `.env.production`, and `build:e2e` sets it to
// 1. Only "1" or "true" shows them: a build that loses the variable holds
// them back rather than publishing them. The client reads it through
// src/features/lessons/kit/draft-switch.ts, which vite.config.ts pins with
// a `define`, and scripts/assert-draft-lessons.mjs checks the finished dist.
// The static listings a crawler reads (the sitemap, llms.txt, every entry
// document's nav) name released lessons only (`releasedLessons`); the
// worker adds a published draft to the sitemap and llms.txt as it serves
// them.
//
// A page's own words can follow the state too. Where a lesson page's
// markup says whether another lesson is ready, it writes both readings,
// each in a `<span data-if-live="5">` or `<span data-if-planned="5">`. The
// worker keeps the one that is true where it serves the page, and so does
// the page's script (src/features/lessons/kit/page-state.ts), so both stay
// in the build: `lessonStatesPlugin` checks each and marks `hidden` the one
// that is false under the build's defaults, so a page no worker served
// reads correctly before its script runs, or without it.

import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { DRAFT_LESSONS } from '../src/features/lessons/kit/drafts'

export const DRAFT_LESSONS_ENV = 'VITE_DRAFT_LESSONS'

/** "1" or "true" shows the draft lessons; anything else, unset included, holds them back. */
export function isDraftLessonsShown(value: string | undefined): boolean {
  const normalized = (value ?? '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true'
}

type DraftList = Readonly<Partial<Record<number, string>>>

/** The draft lessons' numbers, in lesson order. */
export function draftLessons(drafts: DraftList = DRAFT_LESSONS): number[] {
  return Object.keys(drafts)
    .map(Number)
    .filter((n) => Number.isInteger(n) && drafts[n] !== undefined)
    .sort((a, b) => a - b)
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** A lesson's clean path: `/learn/03`. */
export const lessonPath = (n: number): string => `/learn/${pad(n)}`

/** A lesson's document, relative to the repository root and to dist: `learn/03.html`. */
export const lessonDocument = (n: number): string => `learn/${pad(n)}.html`

/** Every lesson page in the repository at `root`, by number: its learn/NN.html documents. */
export function lessonPages(root: string): number[] {
  const dir = resolve(root, 'learn')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .map((name) => /^(\d{2})\.html$/.exec(name)?.[1])
    .filter((nn): nn is string => nn !== undefined)
    .map(Number)
    .sort((a, b) => a - b)
}

/** The released lesson pages: every one with no line in drafts.ts, which is what a static listing names. */
export function releasedLessons(
  root: string,
  drafts: DraftList = DRAFT_LESSONS,
): number[] {
  const waiting = draftLessons(drafts)
  return lessonPages(root).filter((n) => !waiting.includes(n))
}

/**
 * The lesson pages live on a page no worker served, by the build's default:
 * every released one, and the drafts too where `shown`.
 */
export function liveByDefault(
  root: string,
  shown: boolean,
  drafts: DraftList = DRAFT_LESSONS,
): number[] {
  return shown ? lessonPages(root) : releasedLessons(root, drafts)
}

/** Every lesson page as a Rollup input: `lesson01`, `lesson03`. */
export function lessonInputs(root: string): Record<string, string> {
  return Object.fromEntries(
    lessonPages(root).map((n) => [
      `lesson${pad(n)}`,
      resolve(root, lessonDocument(n)),
    ]),
  )
}

/** Their clean paths, which the dev and preview servers rewrite to the documents. */
export function lessonPaths(root: string): string[] {
  return lessonPages(root).map(lessonPath)
}

// One reading of a lesson's state: plain text or inline markup, never
// another span, since the first closing tag ends it. Its opening tag holds
// the one attribute, so the worker and the page's script, which read it
// with a selector, find exactly what this finds.
const STATE_SPAN =
  /<span\s+data-if-(live|planned)="(\d{1,2})"\s*>([\s\S]*?)<\/span\s*>/g

// Any element that writes a reading, as the worker and the page's script
// select it: the span above is the only form this allows.
const ANY_READING = /<([a-z][a-z0-9-]*)\b[^>]*\bdata-if-(?:live|planned)\b/gi

/**
 * Checks each `data-if-live` and `data-if-planned` reading and marks
 * `hidden` the one that is false where the lessons `live` are the live
 * ones; the true one is left as written. Both stay, for the worker and the
 * page's script to settle by the state the page is served with.
 */
export function markLessonStates(
  html: string,
  live: readonly number[],
): string {
  let spans = 0
  const marked = html.replace(
    STATE_SPAN,
    (_all: string, state: string, n: string, inner: string) => {
      if (inner.includes('<span'))
        throw new Error(
          `A data-if-${state}="${n}" reading holds a span; it must be text or inline markup without one.`,
        )
      spans += 1
      const holds = live.includes(Number(n)) === (state === 'live')
      return `<span data-if-${state}="${n}"${holds ? '' : ' hidden'}>${inner}</span>`
    },
  )
  const readings = [...html.matchAll(ANY_READING)]
  if (readings.length !== spans)
    throw new Error(
      'A data-if-live or data-if-planned reading must be `<span data-if-live="N">` with that one attribute and a lesson number of one or two digits.',
    )
  return marked
}

/** Marks every page's readings for this build's defaults, on the dev server as in a build. */
export function lessonStatesPlugin(live: readonly number[]): Plugin {
  return {
    name: 'mercurypitch:lesson-states',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => markLessonStates(html, live),
    },
  }
}

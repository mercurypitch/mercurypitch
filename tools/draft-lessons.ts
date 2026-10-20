// ============================================================
// Draft lessons — the build switch that keeps an unsigned lesson off the live site
// ============================================================
//
// A Find Your Pitch lesson can be finished and still wait on a sign-off:
// Lesson 3 waits on the vocal coach (MASTER-PLAN § 12 item 8). Main deploys
// to dev.mercurypitch.com and every release tag deploys main to production,
// so main must stay safe to release with a draft on it. The list of drafts
// is src/features/lessons/kit/drafts.ts; this file applies it to the build.
//
// Every lesson page is a hand-written document, learn/NN.html, served at
// /learn/NN. The build takes every one of them, less the drafts where it
// hides them, so releasing a lesson is deleting its line from drafts.ts:
// nothing here or in vite.config.ts names a lesson.
//
// The switch is `VITE_DRAFT_LESSONS`, set per Vite mode, as the Glassworks
// listing is (tools/glassworks-listing.ts): `1` in `.env.development`, `0` in
// `.env.production`. That is the split build.yml already makes: a push to
// main builds `build:dev` for the dev deploy, a `v*` tag builds `build` for
// production, so no workflow step carries it, and `build:e2e` sets it to 1 so
// CI's browser tests cover the drafts. Only "1" or "true" shows them: a
// build that loses the variable hides them rather than publishing them.
//
// Where drafts are shown, each draft's document is a build input and its
// clean path is served by the dev and preview servers. Where they are
// hidden, neither: the production asset layer answers its path with the
// 404 page. The client reads the same value through
// src/features/lessons/kit/draft-switch.ts, which vite.config.ts pins with a
// `define`, so a hidden build's season map lists the draft as planned and
// carries no link to it. scripts/assert-draft-lessons.mjs checks the
// finished dist either way. The service worker leaves every lesson path to
// the network in both (src/lib/sw-runtime.ts), so a hidden draft's path
// reaches the 404 page rather than the app shell.
//
// A page's own words can follow the build too. Where a lesson page says
// whether another lesson is ready (a next-lesson card's "ready to read" or
// "coming later"), it writes both readings, each in a
// `<span data-if-live="5">` or `<span data-if-planned="5">`, and
// `lessonStatesPlugin` keeps the one that is true of the build: live where
// Lesson 5's page is built, planned where it is not. So a page reads
// correctly with or without its script, and releasing a draft changes its
// words with everything else.

import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { DRAFT_LESSONS } from '../src/features/lessons/kit/drafts'

export const DRAFT_LESSONS_ENV = 'VITE_DRAFT_LESSONS'

/** "1" or "true" shows the draft lessons; anything else, unset included, hides them. */
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

/** The lesson pages a build carries: every one, less the drafts where drafts are hidden. */
export function builtLessons(
  root: string,
  shown: boolean,
  drafts: DraftList = DRAFT_LESSONS,
): number[] {
  const hidden = shown ? [] : draftLessons(drafts)
  return lessonPages(root).filter((n) => !hidden.includes(n))
}

/** Those pages as Rollup inputs: `lesson01`, `lesson03`. */
export function lessonInputs(
  root: string,
  shown: boolean,
  drafts: DraftList = DRAFT_LESSONS,
): Record<string, string> {
  return Object.fromEntries(
    builtLessons(root, shown, drafts).map((n) => [
      `lesson${pad(n)}`,
      resolve(root, lessonDocument(n)),
    ]),
  )
}

/** Their clean paths, which the dev and preview servers rewrite to the documents. */
export function lessonPaths(
  root: string,
  shown: boolean,
  drafts: DraftList = DRAFT_LESSONS,
): string[] {
  return builtLessons(root, shown, drafts).map(lessonPath)
}

// One reading of a lesson's state: plain text or inline markup, never
// another span, since the first closing tag ends it.
const STATE_SPAN =
  /<span\s+data-if-(live|planned)="(\d+)"\s*>([\s\S]*?)<\/span\s*>/g

/**
 * Keeps, of each `data-if-live` and `data-if-planned` span, the reading that
 * is true where the lessons `live` are the pages built, unwrapped; drops the
 * other.
 */
export function resolveLessonStates(
  html: string,
  live: readonly number[],
): string {
  return html.replace(
    STATE_SPAN,
    (_all: string, state: string, n: string, inner: string) => {
      if (inner.includes('<span'))
        throw new Error(
          `A data-if-${state}="${n}" reading holds a span; it must be text or inline markup without one.`,
        )
      return live.includes(Number(n)) === (state === 'live') ? inner : ''
    },
  )
}

/** Resolves every page's readings for this build, on the dev server as in a build. */
export function lessonStatesPlugin(live: readonly number[]): Plugin {
  return {
    name: 'mercurypitch:lesson-states',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => resolveLessonStates(html, live),
    },
  }
}

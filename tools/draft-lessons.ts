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

import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
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

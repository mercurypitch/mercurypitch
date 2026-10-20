// ============================================================
// Only the publishing rules read the draft list and the build's default
// ============================================================
//
// Whether a lesson is live is publish.ts's to say, for the state a page was
// served with; page-state.ts gives it that state, or the build's default on
// a page no worker served. A lesson module that read drafts.ts or
// draft-switch.ts itself would decide by the build again: on
// mercurypitch.com a draft the admin console publishes would stay unlinked
// there, and a lesson it holds back would stay linked. So within the
// lessons feature, publish.ts alone reads DRAFT_LESSONS and page-state.ts
// alone reads DRAFTS_SHOWN; everything else asks page-state.ts.
//
// The bundle no longer has to fold the list away: every build carries every
// draft's page (tools/draft-lessons.ts), and the site worker answers a
// held-back one's address with the 404 page (src/lesson-gate.ts).

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname, '../../..')
const LESSONS_FEATURE = resolve(__dirname, '..')

/** Every module under `dir` that a build can bundle: no tests, no fixtures. */
function* bundled(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* bundled(path)
    else if (
      /\.tsx?$/.test(entry.name) &&
      !/\.(test|spec|test-fixtures)\.tsx?$/.test(entry.name)
    )
      yield path
  }
}

/** The code a module wrote: no imports, which name a value without reading it, and no comments. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/^import\b[^]*?\bfrom\s+['"][^'"]+['"]/gm, '')
    .replace(/\/\*[^]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
}

/** The lessons feature's modules that read `name`, other than the one that defines it. */
function readersOf(name: string, definedIn: string): string[] {
  const readers: string[] = []
  for (const file of bundled(LESSONS_FEATURE)) {
    if (file === join(LESSONS_FEATURE, definedIn)) continue
    if (new RegExp(`\\b${name}\\b`).test(code(file)))
      readers.push(relative(SRC, file))
  }
  return readers
}

describe("the lessons feature's draft list and build default", () => {
  it('are read by the publishing rules alone', () => {
    // Act
    const drafts = readersOf('DRAFT_LESSONS', 'kit/drafts.ts')
    const shown = readersOf('DRAFTS_SHOWN', 'kit/draft-switch.ts')

    // Assert: each scan finds the one reader it is meant to, so it cannot
    // pass by finding nothing
    expect(drafts).toEqual(['features/lessons/kit/publish.ts'])
    expect(shown).toEqual(['features/lessons/kit/page-state.ts'])
  })
})

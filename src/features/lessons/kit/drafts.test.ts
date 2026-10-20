// ============================================================
// The draft list is read in place, wherever it ships
// ============================================================
//
// season.ts leaves a hidden draft's page out of a production build only
// because the bundler can still see DRAFT_LESSONS's values: the entry's
// `DRAFT_LESSONS[3] !== undefined` folds to a constant. Hand the object on
// as a value anywhere in the bundle (an argument, a parameter's default)
// and the bundler stops folding it, the hidden page's address ships, and
// scripts/assert-draft-lessons.mjs fails the production build. Pull
// requests build only with drafts shown, so that failure would wait for a
// release tag; this holds every module that ships to the rule at once.

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname, '../../..')

/** Every module under src/ that a build can bundle: no tests, no Playwright specs. */
function* bundled(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'e2e' && entry.name !== 'e2e-cloud')
        yield* bundled(path)
    } else if (
      /\.tsx?$/.test(entry.name) &&
      !/\.(test|spec)\.tsx?$/.test(entry.name)
    ) {
      yield path
    }
  }
}

/** The code a reader of the list wrote: no imports, which name it without reading it, and no comments. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/^import\b[^]*?\bfrom\s+['"][^'"]+['"]/gm, '')
    .replace(/\/\*[^]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
}

describe('DRAFT_LESSONS', () => {
  it('is read in place, never handed on as a value, in every module that ships', () => {
    const readers: string[] = []
    const handedOn: string[] = []
    for (const file of bundled(SRC)) {
      if (file === join(SRC, 'features/lessons/kit/drafts.ts')) continue
      const source = code(file)
      if (/\bDRAFT_LESSONS\b/.test(source)) readers.push(relative(SRC, file))
      if (/\bDRAFT_LESSONS\b(?!\[)/.test(source))
        handedOn.push(relative(SRC, file))
    }

    // The scan sees the readers it is meant to hold, so it cannot pass by
    // finding nothing.
    expect(readers).toContain('features/lessons/kit/season.ts')
    expect(handedOn).toEqual([])
  })
})

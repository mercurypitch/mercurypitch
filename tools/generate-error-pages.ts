// Writes the static error documents from src/error-kit/.
//
// Called from vite.config.ts beside writeEntryPages, so dev, preview, build
// and the tests (src/tests/setup-entry-pages.ts) all see the same files. The
// output is git-ignored for the same reason the entry documents are: the
// kit is the thing under review, and a hand-kept copy of the room links is
// how 404.html used to drift.
//
// At the project root, like the entry documents: the asset layer answers an
// unmatched path with the 404.html beside the others (wrangler.jsonc,
// not_found_handling), and Vite emits an input at its path from the root.

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { RenderErrorPageOptions } from '../src/error-kit/render-error-page'
import { renderErrorPage } from '../src/error-kit/render-error-page'
import { releasedLessonLinks } from './lesson-links'

/** Each error document, by the file the asset layer serves it from. */
const ERROR_DOCUMENTS = { '404.html': 'not-found' } as const

/**
 * Generate every error document. Returns the absolute paths written, keyed
 * by file name, for Vite's `rollupOptions.input`.
 */
export function writeErrorPages(
  root: string,
  options: RenderErrorPageOptions = {},
): Record<keyof typeof ERROR_DOCUMENTS, string> {
  const rendered = { lessons: releasedLessonLinks(root), ...options }
  const written = {} as Record<keyof typeof ERROR_DOCUMENTS, string>
  for (const [name, state] of Object.entries(ERROR_DOCUMENTS) as [
    keyof typeof ERROR_DOCUMENTS,
    (typeof ERROR_DOCUMENTS)[keyof typeof ERROR_DOCUMENTS],
  ][]) {
    const file = resolve(root, name)
    const next = renderErrorPage(state, rendered)
    // Only touch the file when it changed: an unconditional write retriggers
    // the dev server's full-reload watcher on every config read.
    let current = ''
    try {
      current = readFileSync(file, 'utf8')
    } catch {
      /* first run */
    }
    if (current !== next) writeFileSync(file, next)
    written[name] = file
  }
  return written
}

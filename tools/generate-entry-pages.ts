// Writes one HTML document per entry in src/seo/entry-pages.ts.
//
// Called from vite.config.ts before Vite resolves its build inputs, so dev,
// preview, build and the tests all see the same files. The output is
// git-ignored: the model is the thing under review, not eleven generated
// documents that used to drift apart by hand.
//
// The files land at the PROJECT ROOT rather than a subdirectory, and that is
// load-bearing. Vite writes an HTML input to dist at its path relative to the
// project root, and production resolves /vocal-range-test through Cloudflare's
// asset-layer html_handling, which only maps a clean path to a document beside
// it. Generating into tools/ or entries/ would emit dist/entries/*.html and
// every live entry URL would 404.

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ENTRY_PAGES } from '../src/seo/entry-pages'
import { renderEntryPage } from '../src/seo/render-entry-page'

/**
 * Generate every entry document. Returns the absolute paths written, in model
 * order, so the caller can build Vite's `rollupOptions.input` from the same list.
 */
export function writeEntryPages(root: string): Record<string, string> {
  const inputs: Record<string, string> = {}
  for (const page of ENTRY_PAGES) {
    const file = resolve(root, `${page.slug}.html`)
    const next = renderEntryPage(page)
    // Only touch the file when it actually changed: an unconditional write
    // retriggers the dev server's full-reload watcher on every config read.
    let current = ''
    try {
      current = readFileSync(file, 'utf8')
    } catch {
      /* first run */
    }
    if (current !== next) writeFileSync(file, next)
    inputs[camel(page.slug)] = file
  }
  return inputs
}

function camel(slug: string): string {
  return slug.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

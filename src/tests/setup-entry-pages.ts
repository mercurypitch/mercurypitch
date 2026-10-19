// Vitest global setup: write the generated entry and error documents before
// any test runs.
//
// The crawlable entry documents (mirror.html, vocal-range-test.html, …) are
// generated from src/seo/entry-pages.ts and git-ignored, so a fresh checkout
// does not have them. Several suites read those files off disk on purpose —
// asserting on the real artefact catches a broken generator in a way that
// re-rendering the model inside the test never could — which means the
// generator has to have run first. Locally it always had, because a previous
// `vite build` left the files behind; CI checks out clean and the reads failed
// with ENOENT.
//
// Running it here rather than depending on build order means `vitest` alone is
// enough, and the generator itself is exercised on every test run.

import { fileURLToPath } from 'node:url'
import { writeEntryPages } from '../../tools/generate-entry-pages'
import { writeErrorPages } from '../../tools/generate-error-pages'

export default function setup(): void {
  const root = fileURLToPath(new URL('../..', import.meta.url))
  writeEntryPages(root)
  // 404.html, from src/error-kit/ (tools/generate-error-pages.ts).
  writeErrorPages(root)
}

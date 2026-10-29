// Studio markup — no `<header>` or `<footer>` tag in Studio's own components, which the app's global rules would style.
//
// src/styles/app.css styles the app's header by its tag: padding and a
// wrapping flex row on a phone, and `!important` padding in a short
// landscape viewport, which no module class can override.
// docs/agent/CONVENTIONS.md §5 says to use a div with a class; this keeps it
// so for every component under src/features/studio.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const STUDIO = resolve(__dirname)

function components(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name)
    if (entry.isDirectory()) return components(path)
    return entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')
      ? [path]
      : []
  })
}

describe('Studio markup', () => {
  it('uses no header or footer tag, which global styles target', () => {
    const tagged = components(STUDIO)
      .filter((path) => /<(?:header|footer)\b/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(STUDIO, path))

    expect(tagged).toEqual([])
  })
})

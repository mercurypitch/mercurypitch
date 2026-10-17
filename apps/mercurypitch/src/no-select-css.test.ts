// ============================================================
// The native app selects nothing, unless a place says so
// ============================================================
//
// shell/shell.css turns text selection, the iOS long-press callout and image
// dragging off for the whole document, and text fields turn selection back
// on. The rooms said `user-select: none` unprefixed, and an iPhone honours
// only `-webkit-user-select`: this bundle's build added no vendor prefixes
// then, so an unprefixed rule never reached iOS (TestFlight report, 17 Oct).
// The build has a CSS target now (NATIVE_CSS_TARGET in vite.config.ts,
// native-css-target.test.ts) and adds the prefix itself; the sources still
// say it, because they are what this suite can read. Here rather than
// beside shell.css, because src/shell/ runs under jsdom, which gives no file
// URL to read from.
//
// The last block is the guard that matters most: with selection off for the
// document, any place that wants it back must say so in the prefixed
// spelling too, so an iPhone gets it back whatever the build's target says.

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (url: URL | string): string => readFileSync(url, 'utf8')
const bare = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//gu, '')

/** Every rule in a stylesheet, as its selectors and its declarations. */
function rules(css: string): { selectors: string[]; body: string }[] {
  return [...bare(css).matchAll(/([^{}]+)\{([^{}]*)\}/gu)].map((m) => ({
    selectors: m[1].split(',').map((one) => one.trim()),
    body: m[2],
  }))
}

/** The declarations of every rule whose selector list has this selector. */
function bodiesFor(css: string, selector: string): string {
  return rules(css)
    .filter((r) => r.selectors.includes(selector))
    .map((r) => r.body)
    .join(';')
}

const SHELL = read(new URL('./shell/shell.css', import.meta.url))
const SETTINGS = read(new URL('./shell/settings/settings.css', import.meta.url))

describe("the native shell's baseline", () => {
  const root = bodiesFor(SHELL, ':root[data-native-shell]')

  it('turns selection off on the document, prefixed for iOS', () => {
    expect(root).toMatch(/-webkit-user-select:\s*none\b/u)
    expect(root).toMatch(/(?:^|[;\s])user-select:\s*none\b/u)
  })

  it('turns the long-press callout off, and keeps the tap highlight clear', () => {
    expect(root).toMatch(/-webkit-touch-callout:\s*none\b/u)
    expect(root).toMatch(/-webkit-tap-highlight-color:\s*transparent\b/u)
  })

  it('stops pictures and links being dragged', () => {
    for (const el of ['img', 'a']) {
      expect(bodiesFor(SHELL, `:root[data-native-shell] ${el}`)).toMatch(
        /-webkit-user-drag:\s*none\b/u,
      )
    }
  })

  it('gives text fields selection back, so they still take typing', () => {
    for (const el of [
      'input',
      'textarea',
      "[contenteditable]:not([contenteditable='false'])",
    ]) {
      const field = bodiesFor(SHELL, `:root[data-native-shell] ${el}`)
      expect(field, el).toMatch(/-webkit-user-select:\s*text\b/u)
      expect(field, el).toMatch(/-webkit-touch-callout:\s*default\b/u)
    }
  })

  it('keeps the account email selectable', () => {
    const email = bodiesFor(SETTINGS, '.mp-set-card__email')
    expect(email).toMatch(/-webkit-user-select:\s*text\b/u)
  })
})

describe('every place that wants selection back says it the WebKit way', () => {
  const REPO = fileURLToPath(new URL('../../../', import.meta.url))
  const ROOTS = [
    fileURLToPath(new URL('../../../src/', import.meta.url)),
    fileURLToPath(new URL('./', import.meta.url)),
  ]
  const sheets = ROOTS.flatMap((dir) =>
    readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((name) => name.endsWith('.css'))
      .map((name) => join(dir, name)),
  )
  const optIns = sheets.flatMap((path) =>
    rules(read(path))
      .filter((r) => /(?:^|[;\s])user-select:\s*(?:text|all)\b/u.test(r.body))
      .map((r) => ({
        where: `${relative(REPO, path)} ${r.selectors.join(', ')}`,
        body: r.body,
      })),
  )

  it('finds the opt-ins it is meant to guard', () => {
    // The email, the developer report, the console, the copied codes, and
    // the editor's BPM field: if the parser stopped seeing them, the loop
    // below would pass on nothing.
    expect(optIns.length).toBeGreaterThanOrEqual(8)
  })

  it.each(optIns.map((o) => [o.where, o.body] as const))(
    '%s',
    (_where, body) => {
      const value = /(?:^|[;\s])user-select:\s*(text|all)\b/u.exec(body)?.[1]
      expect(body).toMatch(
        new RegExp(`-webkit-user-select:\\s*${value}\\b`, 'u'),
      )
    },
  )
})

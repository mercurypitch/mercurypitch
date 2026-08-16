// ============================================================
// Singing control-bar theme contract — filled controls keep readable ink
// ============================================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8')

const controlBarCss = source(
  'src/components/shared/control-bar/control-bar.module.css',
)
const appCss = source('src/styles/app.css')

const luminance = (hex: string): number => {
  const channels = [1, 3, 5].map((index) =>
    Number.parseInt(hex.slice(index, index + 2), 16),
  )
  const linear = channels.map((channel) => {
    const value = channel / 255
    return value <= 0.04045
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

const contrast = (foreground: string, background: string): number => {
  const foregroundLuminance = luminance(foreground)
  const backgroundLuminance = luminance(background)
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  )
}

const token = (body: string, name: string): string => {
  const value = body.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]
  if (value === undefined) throw new Error(`Missing --${name}`)
  return value
}

const themeBodies = (): Array<[string, string]> => {
  const root = appCss.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1]
  if (root === undefined) throw new Error('Missing :root theme')
  return [
    ['dark', root],
    ...[...appCss.matchAll(/\[data-theme='([^']+)'\]\s*\{([\s\S]*?)\n\}/g)].map(
      (match): [string, string] => [match[1], match[2]],
    ),
  ]
}

/**
 * The declarations of one rule, by exact selector.
 *
 * `[^}]` rather than `[\s\S]`: a lazy any-character run crosses the closing
 * brace, so a rule that had lost its `color` still matched the next rule's —
 * reverting `.hero` alone to `color: #fff` left all of this green. The test
 * only failed once all three were reverted at the same time, which is the one
 * way the regression will not arrive.
 */
const ruleBody = (css: string, selector: string): string => {
  const body = css.match(
    new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`),
  )?.[1]
  if (body === undefined) throw new Error(`Missing rule ${selector}`)
  return body
}

describe('Singing control-bar theme contract', () => {
  // White ink fails WCAG AA on eight of the nine palettes against both
  // --accent and --green (dark 2.53:1, amber 2.21:1, ocean-on-green 1.82:1);
  // only `light` passes. --bg-primary passes on all nine, which is what the
  // fallback chain below resolves to until a semantic --on-* token exists.
  it.each([
    ['.hero', '--on-accent'],
    ['.heroPlay', '--on-success'],
    ['.countin', '--on-accent'],
  ])('%s takes its ink from %s', (selector, expected) => {
    expect(ruleBody(controlBarCss, selector)).toMatch(
      new RegExp(
        `color:\\s*var\\(${expected},\\s*var\\(--bg-primary,\\s*#0d1117\\)\\);`,
      ),
    )
  })

  it.each(themeBodies())('%s fallback pairs meet WCAG AA', (_, body) => {
    const foreground = token(body, 'bg-primary')

    expect(contrast(foreground, token(body, 'accent'))).toBeGreaterThanOrEqual(
      4.5,
    )
    expect(contrast(foreground, token(body, 'green'))).toBeGreaterThanOrEqual(
      4.5,
    )
  })
})

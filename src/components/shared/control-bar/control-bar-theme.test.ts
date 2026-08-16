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

describe('Singing control-bar theme contract', () => {
  it('uses semantic foregrounds for filled transport controls', () => {
    expect(controlBarCss).toMatch(
      /\.hero\s*\{[\s\S]*?color:\s*var\(--on-accent,\s*var\(--bg-primary,\s*#0d1117\)\);/,
    )
    expect(controlBarCss).toMatch(
      /\.heroPlay\s*\{[\s\S]*?color:\s*var\(--on-success,\s*var\(--bg-primary,\s*#0d1117\)\);/,
    )
    expect(controlBarCss).toMatch(
      /\.countin\s*\{[\s\S]*?color:\s*var\(--on-accent,\s*var\(--bg-primary,\s*#0d1117\)\);/,
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

// Theme CSS contract — prevents invalid legacy variables and global selector leakage from returning.

import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC_DIR = resolve(process.cwd(), 'src')
const APP_CSS = readFileSync(resolve(SRC_DIR, 'styles/app.css'), 'utf8')
const THEMES = [
  'dark',
  'light',
  'midnight',
  'forest',
  'ocean',
  'cyberpunk',
  'rose',
  'amber',
  'slate',
] as const
const SOURCE_EXTENSIONS = new Set(['.css', '.ts', '.tsx'])
const RETIRED_UNDEFINED_TOKENS = [
  '--text',
  '--border-light',
  '--border-mid',
  '--blue',
  '--ob-ink-1',
  '--accent-success',
  '--accent-warning',
  '--accent-danger',
  '--accent-info',
] as const

function productionSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'e2e' || entry.name === '__tests__') return []
      return productionSourceFiles(path)
    }

    if (!SOURCE_EXTENSIONS.has(extname(entry.name))) return []
    if (/\.(?:test|spec)\.[^.]+$/.test(entry.name)) return []
    return [path]
  })
}

function unscopedClassRules(source: string, className: string): string[] {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rule = new RegExp(`^\\.${escaped}(?=[\\s:{.#])`, 'gm')
  return source.match(rule) ?? []
}

function referencesToken(source: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`var\\(\\s*${escaped}(?=[\\s,)])`).test(source)
}

function cssBlock(source: string, selector: string): string {
  const selectorStart = source.indexOf(`${selector} {`)
  if (selectorStart < 0) throw new Error(`missing CSS block ${selector}`)
  const bodyStart = source.indexOf('{', selectorStart) + 1
  let depth = 1
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return source.slice(bodyStart, index)
  }
  throw new Error(`unterminated CSS block ${selector}`)
}

function declarations(block: string): Map<string, string> {
  return new Map(
    [...block.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map((match) => [
      match[1],
      match[2].trim(),
    ]),
  )
}

const ROOT_TOKENS = declarations(cssBlock(APP_CSS, ':root'))

function themeTokens(theme: (typeof THEMES)[number]): Map<string, string> {
  if (theme === 'dark') return new Map(ROOT_TOKENS)
  return new Map([
    ...ROOT_TOKENS,
    ...declarations(cssBlock(APP_CSS, `[data-theme='${theme}']`)),
  ])
}

function hexChannels(hex: string): number[] {
  return [1, 3, 5].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16),
  )
}

function mix(foreground: string, background: string, weight: number): number[] {
  const front = hexChannels(foreground)
  const back = hexChannels(background)
  return front.map((channel, index) =>
    Math.round(channel * weight + back[index] * (1 - weight)),
  )
}

function luminance(channels: number[]): number {
  const linear = channels.map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function contrast(foreground: number[], background: number[]): number {
  const front = luminance(foreground)
  const back = luminance(background)
  return (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05)
}

function hexToken(tokens: Map<string, string>, name: string): string {
  const value = tokens.get(name) ?? ''
  expect(value, `${name} must be a six-digit hex color`).toMatch(
    /^#[\da-f]{6}$/i,
  )
  return value
}

function rgbaToken(
  tokens: Map<string, string>,
  name: string,
): { color: string; alpha: number } {
  const value = tokens.get(name) ?? ''
  const match = value.match(
    /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/,
  )
  if (match === null) throw new Error(`${name} must be an rgba color`)
  const color = `#${match
    .slice(1, 4)
    .map((channel) => Number(channel).toString(16).padStart(2, '0'))
    .join('')}`
  return { color, alpha: Number(match[4]) }
}

describe('theme CSS contract', () => {
  it('never references the retired variables whose declarations resolved invalid', () => {
    const offenders = productionSourceFiles(SRC_DIR).flatMap((path) => {
      const source = readFileSync(path, 'utf8')
      return RETIRED_UNDEFINED_TOKENS.flatMap((token) =>
        referencesToken(source, token)
          ? [`${relative(SRC_DIR, path)}: ${token}`]
          : [],
      )
    })

    expect(offenders).toEqual([])
  })

  it('keeps Community share buttons out of UVR global selector scope', () => {
    const communityCss = readFileSync(
      resolve(SRC_DIR, 'styles/vocal-analysis.css'),
      'utf8',
    )
    const uvrCss = readFileSync(resolve(SRC_DIR, 'styles/uvr.css'), 'utf8')

    expect(communityCss).toContain('.community-share-tab .share-btn {')
    expect(unscopedClassRules(communityCss, 'share-btn')).toEqual([])
    expect(unscopedClassRules(uvrCss, 'share-btn')).toEqual([])
  })

  it('uses readable foreground roles for small status and selected text', () => {
    const sessionBrowser = readFileSync(
      resolve(SRC_DIR, 'components/SessionBrowser.tsx'),
      'utf8',
    )
    const presetPills = readFileSync(
      resolve(SRC_DIR, 'styles/PresetPillGallery.module.css'),
      'utf8',
    )

    for (const role of [
      '--status-success-fg',
      '--status-warning-fg',
      '--status-danger-fg',
    ]) {
      expect(sessionBrowser).toContain(`var(${role}, color-mix(`)
    }
    expect(sessionBrowser).toContain(
      'var(--accent-text, color-mix(in srgb, var(--accent) 75%',
    )
    expect(presetPills).toContain('--accent-text,')
    expect(presetPills).toContain(
      'color-mix(in srgb, var(--accent) 75%, var(--text-primary))',
    )

    for (const theme of THEMES) {
      const tokens = themeTokens(theme)
      const text = hexToken(tokens, '--text-primary')
      const statusFallbacks = [
        mix(hexToken(tokens, '--green'), text, 0.8),
        mix(hexToken(tokens, '--yellow'), text, 0.8),
        mix(hexToken(tokens, '--red'), text, 0.8),
      ]
      const accent = hexToken(tokens, '--accent')
      const accentForeground = mix(accent, text, 0.75)
      const accentDim = rgbaToken(tokens, '--accent-dim')

      for (const surfaceToken of [
        '--bg-primary',
        '--bg-secondary',
        '--bg-tertiary',
        '--bg-card',
      ]) {
        const surface = hexToken(tokens, surfaceToken)
        for (const foreground of statusFallbacks) {
          expect(
            contrast(foreground, hexChannels(surface)),
            `${theme} status fallback on ${surfaceToken}`,
          ).toBeGreaterThanOrEqual(4.5)
        }
        const selectedBackground = mix(
          accentDim.color,
          surface,
          accentDim.alpha,
        )
        expect(
          contrast(accentForeground, selectedBackground),
          `${theme} selected accent on ${surfaceToken}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})

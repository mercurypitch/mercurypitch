// ============================================================
// Theme token contract — every preset resolves one accessible semantic palette
// ============================================================
//
// This reads the shipped CSS rather than copying its colours into a fixture.
// A preset that omits a base role, breaks an alias, or lowers contrast fails
// before a component has a chance to inherit the wrong theme.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ThemeMode } from '@/stores/theme-store'
import { THEME_CHROME_COLORS, THEME_PRESETS } from '@/stores/theme-store'

const APP_CSS = readFileSync(
  resolve(process.cwd(), 'src/styles/app.css'),
  'utf8',
)

const BASE_PALETTE_TOKENS = [
  '--bg-primary',
  '--bg-secondary',
  '--bg-tertiary',
  '--bg-card',
  '--border-subtle',
  '--border',
  '--border-strong',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--text-disabled',
  '--accent',
  '--accent-dim',
  '--accent-glow',
  '--accent-hover',
  '--green',
  '--green-dim',
  '--green-glow',
  '--red',
  '--yellow',
  '--orange',
  '--purple',
  '--teal',
  '--note-active',
  '--bg-inverse',
  '--text-inverse',
] as const

const SEMANTIC_TOKENS = [
  '--accent-text',
  '--accent-surface',
  '--accent-fill',
  '--accent-fill-hover',
  '--on-accent',
  '--status-success-fg',
  '--status-success-bg',
  '--status-success-fill',
  '--status-success-on-fill',
  '--status-warning-fg',
  '--status-warning-bg',
  '--status-warning-fill',
  '--status-warning-on-fill',
  '--status-danger-fg',
  '--status-danger-bg',
  '--status-danger-fill',
  '--status-danger-on-fill',
  '--status-info-fg',
  '--status-info-bg',
  '--status-info-fill',
  '--status-info-on-fill',
] as const

const COMPATIBILITY_TOKENS = [
  '--border-color',
  '--border-light',
  '--border-mid',
  '--accent-color',
  '--bg-accent',
  '--text-accent',
  '--on-success',
  '--on-warning',
  '--on-danger',
  '--on-info',
] as const

const SURFACE_TOKENS = [
  '--bg-primary',
  '--bg-secondary',
  '--bg-tertiary',
  '--bg-card',
] as const

const READABLE_TEXT_TOKENS = [
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--accent-text',
  '--status-success-fg',
  '--status-warning-fg',
  '--status-danger-fg',
  '--status-info-fg',
] as const

const ON_FILL_PAIRS = [
  ['--accent-fill', '--on-accent'],
  ['--status-success-fill', '--status-success-on-fill'],
  ['--status-warning-fill', '--status-warning-on-fill'],
  ['--status-danger-fill', '--status-danger-on-fill'],
  ['--status-info-fill', '--status-info-on-fill'],
] as const

const SEMANTIC_SURFACE_PAIRS = [
  ['--accent-text', '--accent-surface'],
  ['--status-success-fg', '--status-success-bg'],
  ['--status-warning-fg', '--status-warning-bg'],
  ['--status-danger-fg', '--status-danger-bg'],
  ['--status-info-fg', '--status-info-bg'],
] as const

function cssBlock(selector: string): string {
  const selectorStart = APP_CSS.indexOf(`${selector} {`)
  if (selectorStart < 0) throw new Error(`missing CSS block ${selector}`)
  const bodyStart = APP_CSS.indexOf('{', selectorStart) + 1
  let depth = 1

  for (let index = bodyStart; index < APP_CSS.length; index += 1) {
    if (APP_CSS[index] === '{') depth += 1
    if (APP_CSS[index] === '}') depth -= 1
    if (depth === 0) return APP_CSS.slice(bodyStart, index)
  }

  throw new Error(`unterminated CSS block ${selector}`)
}

function declarations(block: string): Map<string, string> {
  const tokens = new Map<string, string>()
  const declaration = /^\s*(--[\w-]+):\s*([^;]+);/gm
  let match: RegExpExecArray | null

  while ((match = declaration.exec(block)) !== null) {
    tokens.set(match[1], match[2].trim())
  }

  return tokens
}

const ROOT_TOKENS = declarations(cssBlock(':root'))

function tokensFor(theme: ThemeMode): Map<string, string> {
  if (theme === 'dark') return new Map(ROOT_TOKENS)
  return new Map([
    ...ROOT_TOKENS,
    ...declarations(cssBlock(`[data-theme='${theme}']`)),
  ])
}

function resolveValue(
  value: string,
  tokens: Map<string, string>,
  stack: string[] = [],
): string {
  return value.replace(/var\((--[\w-]+)\)/g, (_, token: string) => {
    if (stack.includes(token)) {
      throw new Error(`circular theme token: ${[...stack, token].join(' -> ')}`)
    }
    const next = tokens.get(token)
    if (next === undefined) throw new Error(`unresolved theme token: ${token}`)
    return resolveValue(next, tokens, [...stack, token])
  })
}

function resolvedToken(tokens: Map<string, string>, token: string): string {
  const value = tokens.get(token)
  if (value === undefined) throw new Error(`missing theme token: ${token}`)
  return resolveValue(value, tokens, [token])
}

function hexToken(tokens: Map<string, string>, token: string): string {
  const value = resolvedToken(tokens, token)
  expect(value, `${token} must resolve to a six-digit hex colour`).toMatch(
    /^#[\da-f]{6}$/i,
  )
  return value
}

function hexFromChannels(channels: number[]): string {
  return `#${channels
    .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
    .join('')}`
}

function channelsFromHex(hex: string): number[] {
  return [1, 3, 5].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16),
  )
}

function composite(
  foreground: string,
  background: string,
  alpha: number,
): string {
  const foregroundChannels = channelsFromHex(foreground)
  const backgroundChannels = channelsFromHex(background)
  return hexFromChannels(
    foregroundChannels.map(
      (channel, index) =>
        channel * alpha + backgroundChannels[index] * (1 - alpha),
    ),
  )
}

function semanticBackground(
  tokens: Map<string, string>,
  token: string,
  surface: string,
): string {
  const value = resolvedToken(tokens, token)
  if (/^#[\da-f]{6}$/i.test(value)) return value

  const rgba = value.match(
    /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i,
  )
  if (rgba) {
    return composite(
      hexFromChannels(rgba.slice(1, 4).map(Number)),
      surface,
      Number(rgba[4]),
    )
  }

  const colorMix = value.match(
    /^color-mix\(in srgb,\s*(#[\da-f]{6})\s+([\d.]+)%,\s*transparent\)$/i,
  )
  if (colorMix) {
    return composite(colorMix[1], surface, Number(colorMix[2]) / 100)
  }

  throw new Error(`${token} has an unsupported semantic background: ${value}`)
}

function luminance(hex: string): number {
  const channels = channelsFromHex(hex)
  const linear = channels.map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function contrast(foreground: string, background: string): number {
  const foregroundLuminance = luminance(foreground)
  const backgroundLuminance = luminance(background)
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  )
}

describe('theme token contract', () => {
  it.each(THEME_PRESETS)(
    '%s exposes the complete base and semantic palette',
    (theme) => {
      const tokens = tokensFor(theme)

      for (const token of [
        ...BASE_PALETTE_TOKENS,
        ...SEMANTIC_TOKENS,
        ...COMPATIBILITY_TOKENS,
      ]) {
        expect(resolvedToken(tokens, token), `${theme} ${token}`).not.toContain(
          'var(',
        )
      }
    },
  )

  it('requires every non-default preset to declare the complete base palette', () => {
    for (const theme of THEME_PRESETS.filter((preset) => preset !== 'dark')) {
      const ownTokens = declarations(cssBlock(`[data-theme='${theme}']`))

      for (const token of BASE_PALETTE_TOKENS) {
        expect(ownTokens.has(token), `${theme} must declare ${token}`).toBe(
          true,
        )
      }
    }
  })

  it.each(THEME_PRESETS)(
    '%s keeps supporting and status text readable on every app surface',
    (theme) => {
      const tokens = tokensFor(theme)

      for (const textToken of READABLE_TEXT_TOKENS) {
        for (const surfaceToken of SURFACE_TOKENS) {
          expect(
            contrast(
              hexToken(tokens, textToken),
              hexToken(tokens, surfaceToken),
            ),
            `${theme} ${textToken} on ${surfaceToken}`,
          ).toBeGreaterThanOrEqual(4.5)
        }
      }
    },
  )

  it.each(THEME_PRESETS)(
    '%s gives every solid semantic fill an accessible foreground',
    (theme) => {
      const tokens = tokensFor(theme)

      for (const [fillToken, foregroundToken] of ON_FILL_PAIRS) {
        expect(
          contrast(
            hexToken(tokens, foregroundToken),
            hexToken(tokens, fillToken),
          ),
          `${theme} ${foregroundToken} on ${fillToken}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    },
  )

  it.each(THEME_PRESETS)(
    '%s keeps semantic foregrounds readable on their tinted surfaces',
    (theme) => {
      const tokens = tokensFor(theme)

      for (const [foregroundToken, backgroundToken] of SEMANTIC_SURFACE_PAIRS) {
        for (const surfaceToken of SURFACE_TOKENS) {
          const surface = hexToken(tokens, surfaceToken)
          expect(
            contrast(
              hexToken(tokens, foregroundToken),
              semanticBackground(tokens, backgroundToken, surface),
            ),
            `${theme} ${foregroundToken} on ${backgroundToken} over ${surfaceToken}`,
          ).toBeGreaterThanOrEqual(4.5)
        }
      }
    },
  )

  it.each(THEME_PRESETS)(
    '%s reserves the lower-contrast role for disabled content',
    (theme) => {
      const tokens = tokensFor(theme)
      const background = hexToken(tokens, '--bg-primary')

      expect(
        contrast(hexToken(tokens, '--text-muted'), background),
      ).toBeGreaterThan(
        contrast(hexToken(tokens, '--text-disabled'), background),
      )
    },
  )

  it.each(THEME_PRESETS)(
    '%s keeps the strong border visible against every app surface',
    (theme) => {
      const tokens = tokensFor(theme)

      for (const surfaceToken of SURFACE_TOKENS) {
        expect(
          contrast(
            hexToken(tokens, '--border-strong'),
            hexToken(tokens, surfaceToken),
          ),
          `${theme} --border-strong on ${surfaceToken}`,
        ).toBeGreaterThanOrEqual(3)
      }
    },
  )

  it('keeps browser chrome colours aligned with every primary surface', () => {
    expect(Object.keys(THEME_CHROME_COLORS)).toEqual([...THEME_PRESETS])

    for (const theme of THEME_PRESETS) {
      expect(THEME_CHROME_COLORS[theme]).toBe(
        hexToken(tokensFor(theme), '--bg-primary'),
      )
    }
  })
})

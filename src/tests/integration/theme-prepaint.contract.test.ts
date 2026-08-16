// ============================================================
// Theme prepaint contract — persisted colour reaches the document before mount
// ============================================================
//
// The inline head script is the only code that can prevent a wrong-theme
// browser frame while the module graph downloads. Execute that shipped script
// directly so a test cannot pass against a reimplementation.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { THEME_CHROME_COLORS, THEME_PRESETS } from '@/stores/theme-store'

const INDEX_HTML = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
const APP_ENTRY = readFileSync(resolve(process.cwd(), 'src/index.tsx'), 'utf8')
const RESPONSE_HEADERS = readFileSync(
  resolve(process.cwd(), 'public/_headers'),
  'utf8',
)
const PREPAINT_SCRIPT =
  INDEX_HTML.match(/<script data-theme-prepaint>([\s\S]*?)<\/script>/)?.[1] ??
  ''
const THEME_META_CONTENT =
  INDEX_HTML.match(
    /<meta\s+name="theme-color"\s+content="([^"]+)"\s*\/?>/,
  )?.[1] ?? null
const PREPAINT_PALETTE =
  PREPAINT_SCRIPT.match(/const chromeColors = \{([\s\S]*?)\n\s*\}/)?.[1] ?? ''

const originalMatchMedia = window.matchMedia
let themeColorMeta: HTMLMetaElement

function runPrepaint(): void {
  window.eval(PREPAINT_SCRIPT)
}

function installMatchMedia(prefersDark: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue({ matches: prefersDark }),
  })
}

describe('theme prepaint contract', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.removeProperty('color-scheme')
    if (THEME_META_CONTENT === null) {
      throw new Error('index.html is missing the production theme-color meta')
    }
    themeColorMeta = document.createElement('meta')
    themeColorMeta.name = 'theme-color'
    themeColorMeta.content = THEME_META_CONTENT
    document.head.append(themeColorMeta)
  })

  afterEach(() => {
    vi.useRealTimers()
    themeColorMeta.remove()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.removeProperty('color-scheme')
    if (originalMatchMedia === undefined) {
      Reflect.deleteProperty(window, 'matchMedia')
    } else {
      window.matchMedia = originalMatchMedia
    }
  })

  it.each(THEME_PRESETS)(
    'applies persisted %s before the app entry executes',
    (theme) => {
      localStorage.setItem('pitchperfect_theme', theme)

      runPrepaint()

      expect(document.documentElement.dataset.theme).toBe(theme)
      expect(document.documentElement.style.colorScheme).toBe(
        theme === 'light' ? 'light' : 'dark',
      )
      expect(themeColorMeta.content).toBe(THEME_CHROME_COLORS[theme])
    },
  )

  it.each([
    [false, 'amber'],
    [true, 'ocean'],
  ] as const)(
    'resolves system dark=%s through the persisted day and night presets',
    (prefersDark, expected) => {
      localStorage.setItem('pitchperfect_theme', 'light')
      localStorage.setItem('pitchperfect_theme_source', 'system')
      localStorage.setItem('pitchperfect_theme_auto_day', 'amber')
      localStorage.setItem('pitchperfect_theme_auto_night', 'ocean')
      installMatchMedia(prefersDark)

      runPrepaint()

      expect(document.documentElement.dataset.theme).toBe(expected)
      expect(themeColorMeta.content).toBe(THEME_CHROME_COLORS[expected])
    },
  )

  it.each([
    [6, 'rose'],
    [7, 'light'],
    [18, 'light'],
    [19, 'rose'],
  ] as const)(
    'resolves hour %s with the same day boundary as the store',
    (hour, expected) => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 0, 15, hour, 0, 0))
      localStorage.setItem('pitchperfect_theme_source', 'time')
      localStorage.setItem('pitchperfect_theme_auto_day', 'light')
      localStorage.setItem('pitchperfect_theme_auto_night', 'rose')

      runPrepaint()

      expect(document.documentElement.dataset.theme).toBe(expected)
      expect(themeColorMeta.content).toBe(THEME_CHROME_COLORS[expected])
    },
  )

  it('falls back to dark when persisted values are outside the contract', () => {
    localStorage.setItem('pitchperfect_theme', 'unknown')
    localStorage.setItem('pitchperfect_theme_source', 'unknown')

    runPrepaint()

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(themeColorMeta.content).toBe(THEME_CHROME_COLORS.dark)
  })

  it('runs both boot synchronizers before Solid renders', () => {
    const themeMeta = INDEX_HTML.indexOf('name="theme-color"')
    const inlinePrepaint = INDEX_HTML.indexOf('<script data-theme-prepaint>')
    const moduleEntry = INDEX_HTML.indexOf(
      '<script type="module" src="/src/index.tsx">',
    )
    const runtimeInit = APP_ENTRY.indexOf('\ninitTheme()')
    const solidRender = APP_ENTRY.indexOf('\n  render(')
    const paletteKeys = [...PREPAINT_PALETTE.matchAll(/^\s*(\w+):/gm)].map(
      (match) => match[1],
    )
    const contentSecurityPolicy =
      RESPONSE_HEADERS.match(/Content-Security-Policy:\s*([^\n]+)/)?.[1] ?? ''

    expect(PREPAINT_SCRIPT.length).toBeGreaterThan(500)
    expect(THEME_META_CONTENT).toBe(THEME_CHROME_COLORS.dark)
    expect(themeMeta).toBeGreaterThan(0)
    expect(themeMeta).toBeLessThan(inlinePrepaint)
    expect(paletteKeys).toEqual([...THEME_PRESETS])
    expect(inlinePrepaint).toBeGreaterThan(0)
    expect(inlinePrepaint).toBeLessThan(moduleEntry)
    expect(runtimeInit).toBeGreaterThan(0)
    expect(runtimeInit).toBeLessThan(solidRender)
    expect(contentSecurityPolicy).toMatch(/script-src[^;]*'unsafe-inline'/)
    expect(contentSecurityPolicy).toMatch(/style-src[^;]*'unsafe-inline'/)
  })
})

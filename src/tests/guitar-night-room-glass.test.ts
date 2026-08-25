// ============================================================
// The Guitar Night room is a photograph, and it has to be visible
// ============================================================
//
// Four rooms ship as photographs. Until the glass token they were behind two
// dark gradients the backdrop lays over itself plus fourteen
// `backdrop-filter` layers, and the owner's report was blunt: on the darker
// rooms there is nothing to see.
//
// jsdom has no layout and no compositor, so none of this is observable by
// rendering. The contract is read off the stylesheet the same way
// `guitar-night-mobile-chrome.test.ts` reads the phone header — and the same
// way a future compaction pass would quietly undo it, which is the point.
//
// The behaviour half — the slider writing the custom property, and the value
// surviving a reload — lives in `GuitarNightRoomGlass.test.tsx`.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  'src/features/guitar-night/GuitarNightApp.module.css',
  'utf8',
)

/** The declarations of the first rule whose selector list is exactly `sel`. */
function ruleBody(sel: string): string {
  const opener = `\n${sel} {`
  const start = css.indexOf(opener)
  expect(start, `missing rule for ${sel}`).toBeGreaterThan(-1)
  const from = start + opener.length
  const end = css.indexOf('\n}', from)
  expect(end, `unterminated rule for ${sel}`).toBeGreaterThan(-1)
  return css.slice(from, end)
}

/**
 * Chrome that floats over the room photograph, and the blur radius each one
 * was authored with. These are the surfaces the slider exists for.
 */
const ROOM_CHROME: readonly (readonly [string, number])[] = [
  ['.entryPanel', 18],
  ['.firstWinBrief', 14],
  ['.stageHeader > div:first-child', 12],
  ['.stageModes', 12],
  ['.stageInvitation', 12],
  ['.stageSetup summary,\n.stageViewTrigger', 12],
  ['.stageInstrument', 12],
  ['.roomStatus', 10],
]

/**
 * Menus, scrims and full-screen overlays. These deliberately stay opaque:
 * a dropdown you can read the room through is the failure this work is
 * trying to fix, not a feature of it. Karaoke Night reached the same
 * conclusion about toasts — see `--toast-surface` in `karaoke-night.css`.
 */
const NOT_ROOM_CHROME: readonly string[] = [
  '.scoreSessionPanel',
  '.stageViewPicker',
  '.learnScrim',
  '.guitarNightFileDropOverlay',
]

describe('one token opens the room back up', () => {
  it('declares the glass and the three scales derived from it', () => {
    const app = ruleBody('.app')
    expect(app).toContain('--gn-glass: 0.55;')
    expect(app).toContain(
      '--gn-surface-scale: calc(1 - var(--gn-glass) * 0.82)',
    )
    expect(app).toContain('--gn-blur-scale: calc(1 - var(--gn-glass) * 0.98)')
    expect(app).toContain('--gn-veil-scale: calc(1 - var(--gn-glass) * 0.85)')
  })

  it('lets the backdrop stop veiling its own photograph', () => {
    const backdrop = ruleBody('.backdrop')
    // Five gradient stops carry alpha; every one of them has to follow the
    // slider, or turning it up just thins the panels over a still-black room.
    const scaled = backdrop.match(/var\(--gn-veil-scale\)/g) ?? []
    expect(scaled).toHaveLength(5)
    expect(backdrop).not.toMatch(/rgba\(\d+, \d+, \d+, 0\.\d+\)/)
  })
})

describe('the chrome over the room follows the slider', () => {
  it.each(ROOM_CHROME)('%s thins out and unblurs', (sel, radius) => {
    const body = ruleBody(sel)
    expect(body).toContain(`blur(calc(${radius}px * var(--gn-blur-scale)))`)
    // Both spellings, or Safari keeps the fixed radius the owner complained
    // about — which is the one platform the report came from.
    expect(body).toContain(
      `-webkit-backdrop-filter: blur(calc(${radius}px * var(--gn-blur-scale)))`,
    )
    // The entry panel's whole background IS `--faceplate`, so its alpha
    // follows the glass through the token rather than in the rule.
    expect(body).toMatch(/var\(--gn-surface-scale\)|var\(--faceplate\)/)
    expect(body).not.toMatch(/backdrop-filter: blur\(\d/)
  })

  it('reaches the entry panel through the faceplate token', () => {
    // `--faceplate` is the entry panel's whole background; the rule itself
    // never names a colour, so the token is where the glass has to land.
    expect(ruleBody('.app')).toContain(
      '--faceplate: rgb(22 17 14 / calc(0.94 * var(--gn-surface-scale)))',
    )
    expect(ruleBody('.entryPanel')).toContain('var(--faceplate)')
  })

  it('keeps a contrast-safe faceplate floor on catalog-authored light rooms', () => {
    const lightRoom = ruleBody(".app[data-backdrop-treatment='light']")
    expect(lightRoom).toContain(
      '--gn-surface-scale: calc(1 - var(--gn-glass) * 0.42)',
    )
    expect(lightRoom).toContain('--muted: #f1e6d6')
    expect(lightRoom).toContain('--muted-readable: #f4eadb')
    expect(0.94 * (1 - 1 * 0.42)).toBeGreaterThanOrEqual(0.54)
    expect(css).toContain('.tunerEntryAction span {\n  color: var(--muted);')
  })

  it.each(NOT_ROOM_CHROME)('leaves %s opaque', (sel) => {
    const body = ruleBody(sel)
    expect(body).not.toContain('--gn-surface-scale')
    expect(body).not.toContain('--gn-blur-scale')
  })
})

describe('zero means the room exactly as it shipped', () => {
  /**
   * Every scale is `1 - glass * k`, so all three are exactly 1 at zero and
   * every scaled value reduces to the literal it replaced. That is what makes
   * the slider safe to ship on by default: the old room is still reachable,
   * and it is reachable exactly.
   */
  it.each([
    ['--gn-surface-scale', 0.82],
    ['--gn-blur-scale', 0.98],
    ['--gn-veil-scale', 0.85],
  ])('%s resolves to 1', (token, k) => {
    expect(ruleBody('.app')).toContain(
      `${token}: calc(1 - var(--gn-glass) * ${k})`,
    )
    expect(1 - 0 * k).toBe(1)
  })

  it('never lets a scale reach zero, so chrome cannot vanish', () => {
    // At the top of the slider surfaces keep a little of their alpha and
    // blur keeps a fiftieth of its radius — nearly clear, which is what
    // "as open as it goes" was asked to mean, but not literally nothing.
    // Small ivory type over a lit amplifier needs some diffusion left, and
    // Daylight Loft is bright enough to prove it.
    expect(1 - 1 * 0.82).toBeCloseTo(0.18)
    expect(1 - 1 * 0.98).toBeCloseTo(0.02)
    expect(1 - 1 * 0.85).toBeCloseTo(0.15)
    for (const k of [0.82, 0.98, 0.85]) {
      expect(1 - 1 * k).toBeGreaterThan(0)
    }
  })

  it('opens further at the top than the first cut did', () => {
    // Reported after using it: "the max setting should be a bit more".
    // The range stayed 0..1 — a clean clarity scale — and the curve got
    // steeper instead, so the same slider position means more room.
    const before = { surface: 0.65, blur: 0.92 }
    const after = { surface: 0.82, blur: 0.98 }
    expect(1 - after.blur).toBeLessThan(1 - before.blur)
    expect(1 - after.surface).toBeLessThan(1 - before.surface)
  })

  it('starts mid-slider, not a quarter turn up', () => {
    // "around middle by default so its a bit more less blurry than what
    // default is currently on prod". At 0.35 the faceplate still carried
    // 12.96px of blur; at 0.55 it carries 8.3px.
    expect(18 * (1 - 0.55 * 0.98)).toBeCloseTo(8.3, 1)
    expect(18 * (1 - 0.35 * 0.8)).toBeCloseTo(12.96, 1)
  })
})

describe('the control is reachable at every width', () => {
  it('lives in the room drawer, which every width keeps', () => {
    // Karaoke Night's slider lives in its topbar and is display:none under
    // 900px, so the phone — where this was reported — cannot reach it. This
    // one is inside the Room drawer, which is the same panel at every width,
    // so there is no breakpoint that can hide it.
    expect(ruleBody('.roomGlass')).not.toContain('display: none')
    expect(css).not.toMatch(/\.roomGlass \{[^}]*display: none/)
  })

  it('stretches to the drawer instead of keeping a topbar width', () => {
    // It used to be 5.5rem wide because it sat in the rail between two
    // pills. In a 27rem drawer a fixed width is just a short slider.
    expect(ruleBody('.roomGlassSlider')).toContain('flex: 1 1 auto')
    expect(ruleBody('.roomGlassSlider')).not.toContain('width: 5.5rem')
  })
})

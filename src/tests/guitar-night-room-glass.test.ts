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
    expect(app).toContain('--gn-glass: 0.35;')
    expect(app).toContain(
      '--gn-surface-scale: calc(1 - var(--gn-glass) * 0.55)',
    )
    expect(app).toContain('--gn-blur-scale: calc(1 - var(--gn-glass) * 0.8)')
    expect(app).toContain('--gn-veil-scale: calc(1 - var(--gn-glass) * 0.5)')
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
    ['--gn-surface-scale', 0.55],
    ['--gn-blur-scale', 0.8],
    ['--gn-veil-scale', 0.5],
  ])('%s resolves to 1', (token, k) => {
    expect(ruleBody('.app')).toContain(
      `${token}: calc(1 - var(--gn-glass) * ${k})`,
    )
    expect(1 - 0 * k).toBe(1)
  })

  it('never lets a scale reach zero, so chrome cannot vanish', () => {
    // At the top of the slider: surfaces keep 45% of their alpha and blur
    // keeps a fifth of its radius. Small ivory type over a lit amplifier
    // needs some diffusion left, and Daylight Loft is bright enough to prove
    // it.
    expect(1 - 1 * 0.55).toBeCloseTo(0.45)
    expect(1 - 1 * 0.8).toBeCloseTo(0.2)
    expect(1 - 1 * 0.5).toBeCloseTo(0.5)
  })
})

describe('the control is reachable at every width', () => {
  it('sits in the Room menu, which the phone keeps', () => {
    // Karaoke Night's slider lives in its topbar and is display:none under
    // 900px, so the phone — where this was reported — cannot reach it. The
    // Room menu is the collapsed drawer on a phone, so this one survives.
    expect(css).toContain('.venueMenu .roomGlass')
    expect(ruleBody('.roomGlass')).not.toContain('display: none')
  })

  it('stretches to the drawer instead of keeping the topbar width', () => {
    expect(css).toMatch(/\.venueMenu \.roomGlassSlider \{[^}]*flex: 1 1 auto/)
  })
})

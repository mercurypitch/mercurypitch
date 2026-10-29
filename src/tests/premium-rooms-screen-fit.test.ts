// ============================================================
// The premium rooms keep to the screen, whatever way it is turned
// ============================================================
//
// A premium room is drawn full-bleed in a pushed screen whose body does
// not scroll (the shell's premium-rooms.ts, D1). A phone is held upright
// in it (portrait-lock.ts, D2); an iPad and an Android tablet keep
// turning. Each room kept a floor of 520 px, so on a screen shorter than
// that (an iPad window in Stage Manager, a small tablet on its side) the
// room ran past the bottom edge, and First note's Start with it. Ng slides
// measures its bridge in the room's width (bridge-layout.ts), so on a
// screen wider than tall the deck and Merc slid under the bottom edge: its
// room keeps to a column five sixths of the screen's height wide.
//
// jsdom applies no CSS modules, so the contract is pinned in the
// stylesheets themselves (as in notifications-hit-through.test.ts). The
// layouts were checked in Chromium, in the bleed body, at phone, tablet
// and iPad sizes upright and on their side.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const ROOMS = {
  'Long note': 'src/features/long-note/LongNoteRoom.module.css',
  Echo: 'src/features/echo/EchoRoom.module.css',
  'Lip roll': 'src/features/lip-roll/LipRollRoom.module.css',
  'Ng slides': 'src/features/ng-slides/NgSlidesRoom.module.css',
  'First note': 'src/features/first-note/FirstNoteRoom.module.css',
  'Home note': 'src/features/home-note/HomeNoteRoom.module.css',
} as const

/** The declarations of every `.room` rule, at the top or in a media query. */
function roomRules(css: string): string[] {
  const rules: string[] = []
  for (const match of css.matchAll(/(?:^|\n)\s*\.room\s*\{/gu)) {
    const open = (match.index ?? 0) + match[0].length
    rules.push(css.slice(open, css.indexOf('}', open)))
  }
  return rules
}

/** Each `min-height` a room rule declares, comments left out. */
function floors(rule: string): string[] {
  const bare = rule.replace(/\/\*[\s\S]*?\*\//gu, '')
  return [...bare.matchAll(/min-height:\s*([^;]+);/gu)].map((m) => m[1].trim())
}

describe('the premium rooms on a short or a wide screen', () => {
  for (const [name, path] of Object.entries(ROOMS)) {
    it(`${name} never grows taller than the screen`, () => {
      const rules = roomRules(readFileSync(path, 'utf8'))
      expect(rules.length, `${name}'s .room rule`).toBeGreaterThan(0)
      const declared = rules.flatMap(floors)
      expect(declared.length, `${name} keeps a floor`).toBeGreaterThan(0)
      for (const floor of declared) {
        expect(floor, name).toMatch(/^min\(\d+px, 100dvh\)$/u)
      }
    })
  }

  it('Ng slides keeps its bridge in a column on a wide screen', () => {
    const css = readFileSync(ROOMS['Ng slides'], 'utf8')
    const [room] = roomRules(css)
    expect(room).toContain('max-width: calc(100dvh * 5 / 6);')
    expect(room).toContain('margin-inline: auto;')
    // The river's dark either side, and the bridge's edges fading into it.
    expect(room).toContain('box-shadow: 0 0 0 100vmax #05081a;')
    expect(css).toMatch(/@media \(min-aspect-ratio: 5 \/ 6\)\s*\{\s*\.scene/u)
  })
})

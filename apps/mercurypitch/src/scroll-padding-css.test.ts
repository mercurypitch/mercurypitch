// ============================================================
// The scrollers keep a focused control clear of the chrome
// ============================================================
//
// The tab's scroller and a pushed screen's are padded at the foot for the
// dock (and the parked run's pill), and the tab's at the head for a room's
// header, so a hand can scroll the last control out from under them. A
// control the keyboard or a screen reader moved the focus to was only
// scrolled into the scroller's box, which runs under the dock: walked at
// 390 x 844, the focus stopped on Leagues' and Community's last rows under
// the rail. Each padding has a scroll padding as its twin now. Read from the
// stylesheets: jsdom lays nothing out.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), 'utf8').replace(
    /\/\*[\s\S]*?\*\//gu,
    '',
  )

const SHELL = read('./shell/shell.css')
const KIT = read('../../../src/styles/mobile-kit.css')

/** A declaration of the first rule for exactly this selector, spaced flat. */
function declaration(
  css: string,
  selector: string,
  property: string,
): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  const rule = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'u').exec(
    css,
  )
  if (rule === null) return null
  const value = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+);`, 'u').exec(
    rule[1],
  )
  return value === null ? null : value[1].replace(/\s+/gu, ' ').trim()
}

const twins = [
  ['a pushed screen', SHELL, '.mp-pushed__body', 'bottom'],
  [
    'a pushed screen, with the pill',
    SHELL,
    ":root[data-shell-pill='on'] .mp-pushed__body",
    'bottom',
  ],
  ['the tab', KIT, ':root[data-native-shell] .main-content', 'bottom'],
  [
    'the tab, with the pill',
    KIT,
    ":root[data-native-shell][data-shell-pill='on'] .main-content",
    'bottom',
  ],
  [
    'the tab, under a room header',
    KIT,
    ":root[data-native-shell][data-room-header='on'] .main-content",
    'top',
  ],
] as const

describe("the scrollers' scroll padding", () => {
  it.each(twins)(
    '%s keeps a focused control as clear of the chrome as its padding does',
    (_, css, selector, side) => {
      const flat = (value: string | null): string | null =>
        value === null
          ? null
          : value.replace(/\( /gu, '(').replace(/ \)/gu, ')')
      const padding = flat(declaration(css, selector, `padding-${side}`))

      expect(padding).not.toBeNull()
      expect(flat(declaration(css, selector, `scroll-padding-${side}`))).toBe(
        padding,
      )
    },
  )
})

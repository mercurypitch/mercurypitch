// ============================================================
// The mic check's stage fits a phone
// ============================================================
//
// The stage is half as tall as it is wide (`aspect-ratio: 2 / 1`) and never
// shorter than 210 px, so a phone's narrow stage keeps room for the ribbon,
// the notes and the keys. WebKit carries that min-height through the ratio
// into a minimum width: 420 px. In the panel's column the stage then ran
// 420 px wide inside a 280 px panel on a 320 px phone, and Settings scrolled
// sideways on an iPhone. Chromium stretches the stage to the panel either
// way, so the browser suite never saw it. `min-width: 0` drops the minimum
// WebKit carries over (WebKitGTK 2.54.2: 258 px at 320, 328 px at 390).
//
// jsdom applies no CSS, so this reads the sheets as text.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** A sheet's text, comments gone and space made single. */
const sheet = (file: string): string =>
  readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/\s+/gu, ' ')

/** Every rule in `css`: its selector and its declarations, by property. */
function rules(css: string): { selector: string; body: Map<string, string> }[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/gu)].map((found) => ({
    selector: found[1].trim(),
    body: new Map(
      found[2]
        .split(';')
        .map((declaration): [string, string] => [
          declaration.slice(0, declaration.indexOf(':')).trim(),
          declaration.slice(declaration.indexOf(':') + 1).trim(),
        ])
        .filter(([property]) => property !== ''),
    ),
  }))
}

/** The sheets that draw the stage, in Settings and in First Light. */
const SHEETS = [
  'src/features/mic-check/MicCheckPanel.module.css',
  'src/features/mic-check/MicCheckStage.module.css',
  'src/features/onboarding/beats/FirstLightMic.module.css',
]

describe("the mic check's stage", () => {
  const stage = rules(
    sheet('src/features/mic-check/MicCheckPanel.module.css'),
  ).find((rule) => rule.selector === '.stage')

  it('keeps its ratio and its floor', () => {
    expect(stage?.body.get('aspect-ratio')).toBe('2 / 1')
    expect(stage?.body.get('min-height')).toBe('210px')
  })

  it('can be narrower than its floor times its ratio', () => {
    expect(stage?.body.get('min-width')).toBe('0')
  })

  it.each(SHEETS)(
    'pairs no ratio with a min-height in %s unless the width may shrink',
    (file) => {
      const risky = rules(sheet(file)).filter(
        (rule) =>
          rule.body.has('aspect-ratio') &&
          rule.body.has('min-height') &&
          rule.body.get('min-width') !== '0',
      )
      expect(risky.map((rule) => rule.selector)).toEqual([])
    },
  )
})

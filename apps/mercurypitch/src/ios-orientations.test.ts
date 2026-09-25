// ============================================================
// Which ways up iOS may turn the app
// ============================================================
//
// The screens were built to turn (the alley on its side, owner decision
// Q-4), but the iPhone list in Info.plist named portrait alone, so iOS never
// turned the app when the phone was (device round 4). Upside down stays off:
// on an iPhone with a notch or an island that is not an orientation a person
// holds it in. The iPad keeps its own list. No simulator in CI rotates, so
// the rule is read off the file.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const PLIST = readFileSync(
  new URL('../ios/App/App/Info.plist', import.meta.url),
  'utf8',
).replace(/<!--[\s\S]*?-->/gu, '')

/** The strings of one top-level <array>, by its exact key. */
function listed(key: string): string[] {
  const found = new RegExp(
    `<key>${key}</key>\\s*<array>([\\s\\S]*?)</array>`,
    'u',
  ).exec(PLIST)
  if (found === null) throw new Error(`Info.plist: no ${key} array`)
  return [...found[1].matchAll(/<string>([^<]*)<\/string>/gu)]
    .map((match) => match[1].trim())
    .sort()
}

describe('the orientations iOS may turn the app to', () => {
  it('on an iPhone: upright and on either side, never upside down', () => {
    expect(listed('UISupportedInterfaceOrientations')).toEqual([
      'UIInterfaceOrientationLandscapeLeft',
      'UIInterfaceOrientationLandscapeRight',
      'UIInterfaceOrientationPortrait',
    ])
  })

  it('on an iPad: all four, as before', () => {
    expect(listed('UISupportedInterfaceOrientations~ipad')).toEqual([
      'UIInterfaceOrientationLandscapeLeft',
      'UIInterfaceOrientationLandscapeRight',
      'UIInterfaceOrientationPortrait',
      'UIInterfaceOrientationPortraitUpsideDown',
    ])
  })
})

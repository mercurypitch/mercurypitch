// ============================================================
// The native CSS is written for the iOS floor, and only for it
// ============================================================
//
// vite.config.ts gives the build a CSS target (NATIVE_CSS_TARGET), and the
// minifier adds the `-webkit-` prefixes iOS 16 and 17 need from it: without
// `-webkit-backdrop-filter` no glass surface blurs before Safari 18. Nothing
// on a pull request builds for an old iPhone, so a target that went missing
// would pass every check and ship flat glass. This reads the target from the
// config, checks it against the two other files that name the iOS floor, and
// runs a sample through the same minifier with it.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadConfigFromFile, transformWithEsbuild } from 'vite'
import { describe, expect, it } from 'vitest'

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), 'utf8')

/** The CSS target this app's build runs with. */
async function cssTarget(): Promise<string[]> {
  const path = fileURLToPath(new URL('../vite.config.ts', import.meta.url))
  const loaded = await loadConfigFromFile(
    { command: 'build', mode: 'production' },
    path,
  )
  const target = loaded?.config.build?.cssTarget
  if (!Array.isArray(target)) {
    throw new Error(`no build.cssTarget list in ${path}`)
  }
  return target
}

/** The iOS major version a target names, from its `ios` entry. */
function iosMajor(target: string[]): number {
  const ios = target.find((entry) => /^ios\d/u.test(entry))
  if (ios === undefined) throw new Error('the CSS target names no iOS')
  return Number.parseInt(ios.slice('ios'.length), 10)
}

describe("the native build's CSS target", () => {
  it('is Safari and iOS 16, and no other browser', async () => {
    // Chrome is left out on purpose: chrome74 lowered `inset` in 198 rules
    // and chrome60 rewrote 1,556 colours and shadows (vite.config.ts).
    expect(await cssTarget()).toEqual(['safari16', 'ios16'])
  })

  it('names the same iOS the Xcode project deploys to', async () => {
    const pbxproj = read('../ios/App/App.xcodeproj/project.pbxproj')
    const floors = [
      ...pbxproj.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = (\d+)\.\d+;/gu),
    ].map((match) => Number.parseInt(match[1], 10))
    expect(floors.length).toBeGreaterThan(0)
    expect(new Set(floors)).toEqual(new Set([iosMajor(await cssTarget())]))
  })

  it('names the same iOS the Swift package supports', async () => {
    const swift = read('../ios/App/CapApp-SPM/Package.swift')
    const floor = /\.iOS\(\.v(\d+)\)/u.exec(swift)?.[1]
    expect(floor).toBeDefined()
    expect(Number(floor)).toBe(iosMajor(await cssTarget()))
  })

  it('makes the minifier add the prefixes iOS needs, and nothing else', async () => {
    const sample =
      '.glass{backdrop-filter:blur(16px);inset:0;color:rgb(0 0 0/50%)}' +
      '.still{user-select:none}'
    const { code } = await transformWithEsbuild(sample, 'sample.css', {
      loader: 'css',
      minify: true,
      target: await cssTarget(),
    })
    expect(code).toContain('-webkit-backdrop-filter:blur(16px)')
    expect(code).toContain('-webkit-user-select:none')
    // What an older Chrome in the list would rewrite stays modern: chrome74
    // spells `inset` as four properties, chrome60 a colour as rgba().
    expect(code).toContain('inset:0')
    expect(code).not.toMatch(/\btop:/u)
    expect(code).toContain('color:#0000007f')
  })
})

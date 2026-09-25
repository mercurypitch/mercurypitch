// ============================================================
// The Android launch frame on every supported release
// ============================================================
//
// minSdk is 29. Android 12 and later draw the launch frame from the two
// SplashScreen items; on 10 and 11 Theme.SplashScreen's own window background
// is a compat layer-list of the same two. A launch theme that sets
// `android:windowBackground` replaces that layer-list with a flat field, and
// the mark went missing on 10 and 11. No emulator in CI runs those releases,
// so the rule is read off the resource files.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const RES = fileURLToPath(
  new URL('../android/app/src/main/res', import.meta.url),
)
const STYLES = readFileSync(join(RES, 'values/styles.xml'), 'utf8')

/** The items of one <style>, by name, comments dropped. */
function styleItems(name: string): Map<string, string> {
  const bare = STYLES.replace(/<!--[\s\S]*?-->/gu, '')
  const block = new RegExp(
    `<style name="${name.replace(/\./gu, '\\.')}"[^>]*>([\\s\\S]*?)</style>`,
    'u',
  ).exec(bare)
  if (block === null) throw new Error(`no style ${name}`)
  const items = new Map<string, string>()
  for (const [, key, value] of block[1].matchAll(
    /<item name="([^"]+)">([^<]*)<\/item>/gu,
  )) {
    items.set(key, value.trim())
  }
  return items
}

describe('the launch theme', () => {
  const launch = styleItems('AppTheme.NoActionBarLaunch')

  it('leaves the window background to Theme.SplashScreen', () => {
    expect(launch.has('android:windowBackground')).toBe(false)
  })

  it('carries no background item nothing reads', () => {
    expect(launch.has('android:background')).toBe(false)
  })

  it('names the ground and the mark for the splash', () => {
    expect(launch.get('windowSplashScreenBackground')).toBe(
      '@color/mp_launch_ground',
    )
    expect(launch.get('windowSplashScreenAnimatedIcon')).toBe(
      '@drawable/splash_icon',
    )
  })
})

describe('the theme the app runs under', () => {
  it('keeps the launch ground behind the web view', () => {
    expect(
      styleItems('AppTheme.NoActionBar').get('android:windowBackground'),
    ).toBe('@color/mp_launch_ground')
  })
})

describe('every drawable the styles name', () => {
  it('exists', () => {
    const named = [...STYLES.matchAll(/@drawable\/([a-z0-9_]+)/gu)].map(
      (match) => match[1],
    )
    const folders = readdirSync(RES).filter((dir) => dir.startsWith('drawable'))
    for (const name of named) {
      const found = folders.some((dir) =>
        ['.xml', '.png', '.webp'].some((ext) =>
          existsSync(join(RES, dir, `${name}${ext}`)),
        ),
      )
      expect(found, `@drawable/${name}`).toBe(true)
    }
  })
})

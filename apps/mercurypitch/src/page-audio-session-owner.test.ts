// ============================================================
// navigator.audioSession.type: one owner, and the page API only
// ============================================================
//
// Two parts of the app ask WebKit for a session type: a premium room's
// visit (room-visit.ts) and a play from behind the app
// (webkit-now-playing.ts). Each puts back the type it found, so written
// from two places the two could put back each other's word; both ask
// packages/mobile-runtime page-audio-session.ts instead, which alone
// writes the type. And it is the page's type only: the app's own
// AVAudioSession is never changed at runtime under WebKit's audio (#923;
// ios-audio-output.test.ts keeps the plugin a reader). Read off the
// sources, as the other wiring tests are.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const REPO = fileURLToPath(new URL('../../../', import.meta.url))

const read = (path: string): string => readFileSync(join(REPO, path), 'utf8')

/** A TypeScript source with its comments dropped, so prose cannot match. */
const code = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '')

/** Every shipped TypeScript source under `dir`: no tests, no fixtures. */
function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(join(REPO, dir))) {
    if (name === 'node_modules' || name === 'dist') continue
    const path = join(dir, name)
    if (statSync(join(REPO, path)).isDirectory()) yield* sources(path)
    else if (
      /\.tsx?$/u.test(name) &&
      !/\.(test|spec|dom\.test)\.tsx?$/u.test(name) &&
      !/test-fixtures?\.tsx?$/u.test(name) &&
      !name.endsWith('.d.ts')
    )
      yield path
  }
}

const TREES = ['src', 'apps/mercurypitch/src', 'packages']
const OWNER = 'packages/mobile-runtime/src/page-audio-session.ts'

/** An assignment to a session's `type`: `session.type = ...`. */
const TYPE_WRITE = /[sS]ession\)?\.type\s*=(?!=)/u

describe('the page’s audio session type', () => {
  it('is written in one place only', () => {
    const writers = TREES.flatMap((tree) => [...sources(tree)])
      .filter((path) =>
        TYPE_WRITE.test(code(readFileSync(join(REPO, path), 'utf8'))),
      )
      .map((path) => relative(REPO, join(REPO, path)))
    expect(writers).toEqual([OWNER])
  })

  it('is asked for by a premium room’s visit, through the owner', () => {
    const visit = code(read('apps/mercurypitch/src/shell/room-visit.ts'))
    expect(visit).toContain(
      "from '@irchiinnuss/mobile-runtime/page-audio-session'",
    )
    expect(visit).toMatch(
      /claimPageAudioSession\(\s*`room \$\{room\}`,\s*'play-and-record',?\s*\)/u,
    )
  })

  it('is asked for with every premium room, and with no other screen', () => {
    const screens = code(read('apps/mercurypitch/src/shell/ShellScreens.tsx'))
    expect(screens).toContain(
      '{isPremiumRoom(screen) ? <RoomVisit room={screen} /> : null}',
    )
    // Before the room, so its first sound already has the session.
    expect(screens.indexOf('<RoomVisit')).toBeLessThan(
      screens.indexOf('{body(screen)}'),
    )
  })

  it('is asked for by Now Playing’s play from behind the app, through the owner', () => {
    const nowPlaying = code(
      read('packages/mobile-runtime/src/webkit-now-playing.ts'),
    )
    expect(nowPlaying).toContain(
      "claimPageAudioSession('now playing', 'playback')",
    )
  })

  it('is reached by the app through a plugin-free entry of its own', () => {
    const runtime = JSON.parse(
      read('packages/mobile-runtime/package.json'),
    ) as {
      exports: Record<string, { import: string }>
    }
    expect(runtime.exports['./page-audio-session']?.import).toBe(
      './src/page-audio-session.ts',
    )
    expect(code(read(OWNER))).not.toMatch(/from '@capacitor\//u)
  })
})

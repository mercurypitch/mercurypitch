// ============================================================
// A TV connected to the iPhone mirrors it, not a second app
// ============================================================
//
// AirPlay screen mirroring, or a cable, makes iOS connect a scene with the
// external-display role. Capacitor 8.5's template gave every scene
// SceneDelegate, which builds a ViewController -- a second web app on the
// TV, on its start page, sharing storage and initialising every plugin twice
// (ionic-team/capacitor#8648). The app gives SceneDelegate to the
// application role alone, and SceneDelegate refuses any other, so iOS
// mirrors the phone. No simulator in CI connects a display, so the rule is
// read off the files.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** A Swift file with its comments removed, so a comment cannot pass a check. */
function swift(name: string): string {
  return readFileSync(
    new URL(`../ios/App/App/${name}`, import.meta.url),
    'utf8',
  )
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/\/\/.*$/gmu, '')
}

/** The body of the first function whose signature contains `marker`. */
function body(source: string, marker: string): string {
  const at = source.indexOf(marker)
  if (at < 0) throw new Error(`no function with ${marker}`)
  const open = source.indexOf('{', at)
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    if (source[i] === '}') depth -= 1
    if (depth === 0) return source.slice(open + 1, i)
  }
  throw new Error(`unbalanced braces after ${marker}`)
}

describe('a connected TV mirrors the phone', () => {
  it('AppDelegate gives SceneDelegate to the application role alone', () => {
    const configure = body(
      swift('AppDelegate.swift'),
      'configurationForConnecting',
    )
    const assignments = configure.match(/config\.delegateClass\s*=/gu) ?? []
    expect(assignments).toHaveLength(1)
    expect(configure).toMatch(
      /if\s+connectingSceneSession\.role\s*==\s*\.windowApplication\s*\{\s*config\.delegateClass\s*=\s*SceneDelegate\.self\s*\}/u,
    )
  })

  it('SceneDelegate builds no window for any other role', () => {
    const connect = body(swift('SceneDelegate.swift'), 'willConnectTo session')
    const guardAt = connect.search(
      /guard\s+session\.role\s*==\s*\.windowApplication\b/u,
    )
    expect(guardAt).toBeGreaterThanOrEqual(0)
    expect(guardAt).toBeLessThan(connect.indexOf('UIWindow('))
    expect(guardAt).toBeLessThan(connect.indexOf('ViewController()'))
  })
})

// ============================================================
// The Karaoke room's lyrics on a connected TV: the native wiring
// ============================================================
//
// A proof of concept (ios/App/App/LyricsWindow/TVLyrics.swift). The rules
// that are easy to lose and fail silently: the plugin answers the names the
// JavaScript side calls and sends the event it listens to; the TV gets a
// window only on an external display's scene and only with the switch on,
// which starts off, so a store build mirrors; the lyrics and the clock reach
// the TV as they reach the window; the window goes when the switch does, so
// the TV mirrors again; and Xcode compiles the file at all. Nothing in CI
// connects a TV, so all of it is read off the sources, as the lyrics
// window's wiring is (ios-lyrics-window.test.ts).

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (path: string): string =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')

/** A Swift source with its comments dropped, so prose cannot satisfy a rule. */
const swiftSource = (path: string): string =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/\/\/.*$/gmu, '')

const WINDOW = '../ios/App/App/LyricsWindow/'
const PLUGIN = swiftSource(`${WINDOW}LyricsWindowPlugin.swift`)
const TV = swiftSource(`${WINDOW}TVLyrics.swift`)
const RENDERER = swiftSource(`${WINDOW}LyricsWindowRenderer.swift`)
const PROJECT = read('../ios/App/App.xcodeproj/project.pbxproj')
const JS_SIDE = read(
  '../../../packages/mobile-runtime/src/picture-in-picture.ts',
)

/** The body of the first Swift function named `name`. */
function swiftFunction(source: string, name: string): string {
  const at = source.search(new RegExp(`func ${name}\\(`, 'u'))
  if (at < 0) throw new Error(`no func ${name}`)
  const open = source.indexOf('{', at)
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    if (source[i] === '}') depth -= 1
    if (depth === 0) return source.slice(open + 1, i)
  }
  throw new Error(`unbalanced braces in func ${name}`)
}

describe('the plugin', () => {
  it.each(['setTvLyrics', 'getTvLyrics'])(
    'answers %s, which the JavaScript side calls',
    (method) => {
      expect(PLUGIN).toContain(
        `CAPPluginMethod(name: "${method}", returnType: CAPPluginReturnPromise)`,
      )
      expect(PLUGIN).toContain(`@objc func ${method}(_ call: CAPPluginCall)`)
      expect(JS_SIDE).toContain(`.${method}(`)
    },
  )

  it('sends tvLyricsChange, which the JavaScript side listens to', () => {
    expect(PLUGIN).toMatch(
      /notifyListeners\("tvLyricsChange", data: \[\s*"connected":/u,
    )
    expect(JS_SIDE).toContain("'tvLyricsChange'")
    for (const field of ['connected', 'showing']) {
      expect(PLUGIN).toContain(`"${field}":`)
      expect(JS_SIDE).toContain(`state.${field}`)
    }
  })

  it('reads the switch under the name the JavaScript side sends', () => {
    expect(PLUGIN).toContain('call.getBool("enabled")')
    expect(JS_SIDE).toContain('setTvLyrics({ enabled: on })')
  })

  it('hands the TV the lyrics and the clock it hands the window', () => {
    expect(PLUGIN).toMatch(
      /self\.window\?\.setScript\(script\)\s*self\.tv\?\.setScript\(script\)/u,
    )
    expect(PLUGIN).toMatch(
      /self\.window\?\.setScript\(nil\)\s*self\.tv\?\.setScript\(nil\)/u,
    )
    expect(PLUGIN).toContain(
      'self?.tv?.setClock(playing: playing, position: position, rate: rate, duration: duration)',
    )
  })
})

describe('the TV', () => {
  it('takes an external display’s scene and no other', () => {
    expect(swiftFunction(TV, 'isTV')).toContain(
      'scene.session.role == .windowExternalDisplayNonInteractive',
    )
    expect(swiftFunction(TV, 'connect')).toMatch(/guard Self\.isTV\(scene\)/u)
  })

  it('puts a window up only with the switch on, which starts off', () => {
    expect(TV).toContain(
      'private(set) var enabled = UserDefaults.standard.bool(forKey: TVLyrics.enabledKey)',
    )
    expect(swiftFunction(TV, 'connect')).toMatch(/if enabled \{\s*show\(\)/u)
    expect(TV.match(/UIWindow\(windowScene:/gu) ?? []).toHaveLength(1)
    expect(swiftFunction(TV, 'show')).toContain('UIWindow(windowScene: scene)')
  })

  it('takes the window down with the switch, so the TV mirrors again', () => {
    expect(swiftFunction(TV, 'setEnabled')).toMatch(
      /if on \{\s*show\(\)\s*\} else \{\s*hide\(\)/u,
    )
    expect(swiftFunction(TV, 'hide')).toMatch(
      /window\.isHidden = true\s*self\.window = nil/u,
    )
    expect(swiftFunction(TV, 'disconnect')).toContain('hide()')
  })

  it('draws with the lyrics window’s renderer, at the TV’s size', () => {
    expect(TV).toContain(
      'LyricsWindowRenderer(width: Self.pixelWidth, height: Self.pixelHeight)',
    )
    expect(RENDERER).toContain(
      'init(width: Int = LyricsWindowRenderer.windowWidth, height: Int = LyricsWindowRenderer.windowHeight)',
    )
  })

  it('leaves picture in picture alone', () => {
    expect(TV).not.toMatch(/PictureInPicture/u)
  })
})

describe('the Xcode project', () => {
  const sources =
    /Begin PBXSourcesBuildPhase section[\s\S]*?End PBXSourcesBuildPhase section/u.exec(
      PROJECT,
    )?.[0]
  const group =
    /\/\* LyricsWindow \*\/ = \{\s*isa = PBXGroup;[\s\S]*?path = LyricsWindow;/u.exec(
      PROJECT,
    )?.[0]

  it('compiles TVLyrics.swift into the app, from the window’s folder', () => {
    expect(PROJECT).toContain(
      '/* TVLyrics.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = TVLyrics.swift; sourceTree = "<group>"; };',
    )
    expect(sources).toContain('/* TVLyrics.swift in Sources */')
    expect(group).toContain('/* TVLyrics.swift */')
  })
})

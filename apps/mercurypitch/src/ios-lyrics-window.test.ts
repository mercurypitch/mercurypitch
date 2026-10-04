// ============================================================
// The Karaoke room's lyrics window on iOS: the native wiring
// ============================================================
//
// The window is the app's own Capacitor plugin (ios/App/App/LyricsWindow/),
// not an npm package: nothing registers it unless ViewController does, and
// Xcode compiles none of it unless the project lists it. Each of those is a
// line that is easy to lose and fails silently: the room would ask for a
// window and get `Unimplemented`. Its names are strings on both sides of the
// bridge, so no compiler checks them either. And one rule is App Review's
// (docs/plans/mobile-native/ios-lyrics-window.md): the window is never
// started from code, only armed for iOS to open. Nothing in CI runs on a
// phone, so all of it is read off the sources, as the Android window's
// wiring is (android-picture-in-picture.test.ts).

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

const APP = '../ios/App/App/'
const WINDOW = `${APP}LyricsWindow/`
const SWIFT = {
  plugin: swiftSource(`${WINDOW}LyricsWindowPlugin.swift`),
  window: swiftSource(`${WINDOW}LyricsWindow.swift`),
  script: swiftSource(`${WINDOW}LyricsWindowScript.swift`),
  renderer: swiftSource(`${WINDOW}LyricsWindowRenderer.swift`),
  viewController: swiftSource(`${APP}ViewController.swift`),
  sceneDelegate: swiftSource(`${APP}SceneDelegate.swift`),
}
const STORYBOARD = read(`${APP}Base.lproj/Main.storyboard`)
const PROJECT = read('../ios/App/App.xcodeproj/project.pbxproj')
const JS_SIDE = read(
  '../../../packages/mobile-runtime/src/picture-in-picture.ts',
)
const SCRIPT_TS = read('../../../src/lib/lyric-window-script.ts')

describe('the plugin', () => {
  it('is registered by the app’s own bridge, which both ways in make', () => {
    expect(SWIFT.viewController).toMatch(
      /class ViewController: CAPBridgeViewController\s*\{\s*override func capacitorDidLoad\(\)\s*\{\s*bridge\?\.registerPluginInstance\(LyricsWindowPlugin\(\)\)/u,
    )
    expect(SWIFT.sceneDelegate).toContain(
      'window?.rootViewController = ViewController()',
    )
    expect(STORYBOARD).toContain(
      'customClass="ViewController" customModule="App" customModuleProvider="target"',
    )
  })

  it('goes by the name the JavaScript side asks for, Android’s too', () => {
    expect(SWIFT.plugin).toContain('public let jsName = "PictureInPicture"')
    expect(JS_SIDE).toContain(
      "registerPlugin<PictureInPicturePlugin>('PictureInPicture')",
    )
  })

  it.each(['setAutoEnter', 'setLyrics', 'setClock'])(
    'answers %s, which the JavaScript side calls',
    (method) => {
      expect(SWIFT.plugin).toContain(
        `CAPPluginMethod(name: "${method}", returnType: CAPPluginReturnPromise)`,
      )
      expect(SWIFT.plugin).toContain(
        `@objc func ${method}(_ call: CAPPluginCall)`,
      )
      expect(JS_SIDE).toContain(`.${method}(`)
    },
  )

  it.each([
    ['pictureInPictureChange', 'inPictureInPicture'],
    ['pictureInPictureAction', 'action'],
    ['pictureInPictureLog', 'message'],
    ['audioSessionLog', 'message'],
  ])('sends %s, which the JavaScript side listens to', (event, field) => {
    expect(SWIFT.plugin).toContain(
      `notifyListeners("${event}", data: ["${field}":`,
    )
    expect(JS_SIDE).toContain(`'${event}'`)
  })

  it('reads the clock under the names the JavaScript side sends', () => {
    for (const field of ['playing', 'position', 'rate', 'duration']) {
      expect(SWIFT.plugin).toMatch(
        new RegExp(`call\\.get\\w+\\("${field}"\\)`, 'u'),
      )
    }
    expect(SWIFT.plugin).toContain('call.getString("json")')
  })
})

describe('the script', () => {
  it('is decoded under the names the page builds it with', () => {
    for (const field of ['title', 'duration', 'segments']) {
      expect(SCRIPT_TS).toMatch(new RegExp(`readonly ${field}:`, 'u'))
      expect(SWIFT.script).toMatch(new RegExp(`let ${field}:`, 'u'))
    }
    for (const field of ['at', 'current', 'next', 'words']) {
      expect(SCRIPT_TS).toMatch(new RegExp(`readonly ${field}:`, 'u'))
      expect(SWIFT.script).toMatch(new RegExp(`let ${field}:`, 'u'))
    }
  })
})

describe('App Review', () => {
  const allSwift = Object.values(SWIFT).join('\n')

  it('closes the window once the app is active again, not only as it returns', () => {
    // iOS can ignore a stop asked for before the app is active (build 533).
    expect(SWIFT.window).toContain('UIApplication.willEnterForegroundNotification')
    expect(SWIFT.window).toContain('UIApplication.didBecomeActiveNotification')
  })

  it('never starts the window from code, only arms it for iOS to open', () => {
    expect(allSwift).not.toMatch(/\.startPictureInPicture\(/u)
    expect(SWIFT.window).toContain(
      'controller.canStartPictureInPictureAutomaticallyFromInline = armed',
    )
  })

  it('uses no private key to change the window’s buttons', () => {
    expect(allSwift).not.toContain('controlsStyle')
    expect(allSwift).not.toMatch(/setValue\([^)]*forKey/u)
  })

  it('gives iOS a finite song, never an endless one', () => {
    expect(SWIFT.window).not.toContain('positiveInfinity')
    expect(SWIFT.window).toContain('.requiresLinearPlayback = true')
  })
})

describe('the Xcode project', () => {
  const sources =
    /Begin PBXSourcesBuildPhase section[\s\S]*?End PBXSourcesBuildPhase section/u.exec(
      PROJECT,
    )?.[0]

  it.each([
    'ViewController.swift',
    'LyricsWindowPlugin.swift',
    'LyricsWindow.swift',
    'LyricsWindowScript.swift',
    'LyricsWindowRenderer.swift',
  ])('compiles %s into the app', (file) => {
    expect(PROJECT).toContain(
      `/* ${file} */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ${file}; sourceTree = "<group>"; };`,
    )
    expect(sources).toContain(`/* ${file} in Sources */`)
  })

  it('finds the window’s files in their own folder', () => {
    expect(PROJECT).toMatch(
      /\/\* LyricsWindow \*\/ = \{\s*isa = PBXGroup;[\s\S]*?path = LyricsWindow;/u,
    )
  })
})

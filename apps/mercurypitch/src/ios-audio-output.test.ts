// ============================================================
// The phone's sound output on iOS: the native wiring
// ============================================================
//
// AudioOutputPlugin.swift is the app's own plugin, so nothing registers it
// unless ViewController does and Xcode compiles none of it unless the project
// lists it. Its names are strings on both sides of the bridge. And it must
// stay a reader: the app's session is never changed at runtime under
// WebKit's audio (docs/agent/MISTAKES.md, #923). Nothing in CI runs on a
// phone, so all of it is read off the sources, as the lyrics window's wiring
// is (ios-lyrics-window.test.ts).

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
const PLUGIN = swiftSource(`${APP}AudioOutputPlugin.swift`)
const VIEW_CONTROLLER = swiftSource(`${APP}ViewController.swift`)
const KIT = swiftSource(
  '../../../packages/ios-audio-session/Sources/AudioSessionKit/AudioSession.swift',
)
const PROJECT = read('../ios/App/App.xcodeproj/project.pbxproj')
const JS_SIDE = read('../../../packages/mobile-runtime/src/audio-output.ts')

/** The kit's snapshot function, alone. */
const SNAPSHOT =
  /public static func snapshot\(\)[\s\S]*?\n {4}\}\n/u.exec(KIT)?.[0] ?? ''

describe('the plugin', () => {
  it('is registered by the app’s own bridge', () => {
    expect(VIEW_CONTROLLER).toContain(
      'bridge?.registerPluginInstance(AudioOutputPlugin())',
    )
  })

  it('goes by the name the JavaScript side asks for', () => {
    expect(PLUGIN).toContain('public let jsName = "AudioOutput"')
    expect(JS_SIDE).toContain(
      "registerPlugin<AudioOutputPlugin>('AudioOutput')",
    )
  })

  it('answers read, which the JavaScript side calls', () => {
    expect(PLUGIN).toContain(
      'CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise)',
    )
    expect(PLUGIN).toContain('@objc func read(_ call: CAPPluginCall)')
    expect(JS_SIDE).toContain('.read()')
  })

  it('sends every change under the event the JavaScript side listens to', () => {
    expect(PLUGIN).toContain('notifyListeners("audioOutputChange", data: data)')
    expect(JS_SIDE).toContain("'audioOutputChange'")
  })

  it('hears the volume keys and the route', () => {
    expect(PLUGIN).toContain('.observe(\\.outputVolume')
    expect(PLUGIN).toContain('AVAudioSession.routeChangeNotification')
    expect(PLUGIN).toContain('AVAudioSession.interruptionNotification')
  })

  it('reports under the names the JavaScript side reads', () => {
    for (const key of ['outputVolume', 'outputs']) {
      expect(SNAPSHOT).toContain(`"${key}":`)
      expect(JS_SIDE).toContain(`data.${key}`)
    }
    expect(SNAPSHOT).toContain('["type": description.portType.rawValue')
    expect(JS_SIDE).toMatch(/const \{ type, name \} = entry/u)
  })
})

describe('reading, never changing', () => {
  const setters = [
    'setCategory',
    'setActive',
    'setMode',
    'overrideOutputAudioPort',
    'setPreferred',
  ]

  it.each(setters)('the plugin never calls %s', (setter) => {
    expect(PLUGIN).not.toContain(setter)
  })

  it.each(setters)('the kit’s snapshot never calls %s', (setter) => {
    expect(SNAPSHOT).not.toBe('')
    expect(SNAPSHOT).not.toContain(setter)
  })
})

describe('the Xcode project', () => {
  const sources =
    /Begin PBXSourcesBuildPhase section[\s\S]*?End PBXSourcesBuildPhase section/u.exec(
      PROJECT,
    )?.[0]

  it('compiles AudioOutputPlugin.swift into the app', () => {
    expect(PROJECT).toContain(
      '/* AudioOutputPlugin.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AudioOutputPlugin.swift; sourceTree = "<group>"; };',
    )
    expect(sources).toContain('/* AudioOutputPlugin.swift in Sources */')
  })

  it('links the kit the plugin reads the session through', () => {
    expect(PLUGIN).toContain('import AudioSessionKit')
    expect(PROJECT).toContain('/* AudioSessionKit in Frameworks */')
  })
})

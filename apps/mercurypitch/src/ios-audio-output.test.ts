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

  // The latency offset follows the route for as long as the app runs, so a
  // new route, and the app back in front, go out under an event of their own.
  it('sends a new route under an event of its own, which the JavaScript side listens to', () => {
    expect(PLUGIN).toMatch(
      /if reason == "route" \|\| reason == "app in front" \{\s*notifyListeners\("audioRouteChange", data: data\)/u,
    )
    expect(PLUGIN).toContain('changed("route", extra)')
    expect(PLUGIN).toContain(
      '(UIApplication.didBecomeActiveNotification, "app in front")',
    )
    expect(JS_SIDE).toContain("'audioRouteChange'")
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

// The app's session stopped following the volume keys the moment a room
// opened (build 880): the system volume comes from a volume view as well,
// and the interruptions and the route's reasons go into every report.
describe('the second volume, and what the session went through', () => {
  it('reads the system volume off a hidden volume view in a window', () => {
    expect(PLUGIN).toContain('import MediaPlayer')
    expect(PLUGIN).toContain('MPVolumeView(')
    expect(PLUGIN).toContain('view.isHidden = true')
    expect(PLUGIN).toContain('host.addSubview(view)')
    expect(PLUGIN).toContain('$0 as? UISlider }.first?.value')
  })

  it('counts it only once it has been seen to move', () => {
    expect(PLUGIN).toContain('systemVolumeMoved = true')
    expect(PLUGIN).toContain('data["systemVolumeLive"] = systemVolumeMoved')
  })

  it('sends it under the names the JavaScript side reads', () => {
    for (const key of [
      'systemVolume',
      'systemVolumeLive',
      'systemVolumeSettled',
    ]) {
      expect(PLUGIN).toContain(`data["${key}"]`)
      expect(JS_SIDE).toContain(`data.${key}`)
    }
  })

  // Two zeros are one stale reading twice while the view is still filling
  // its slider, so the session is believed only once the view has settled.
  it('says when the volume view has been in its window long enough to fill', () => {
    expect(PLUGIN).toContain(
      'data["systemVolumeSettled"] = systemVolumeSettled()',
    )
    expect(PLUGIN).toContain(
      'Date().timeIntervalSince(since) >= Self.systemVolumeSettle',
    )
  })

  // The slider was looked at four times a second for as long as the app
  // ran. It is looked at until the view has settled in its window and been
  // read once, and after that only while a screen listens for changes.
  describe('looks at the slider only while it is needed', () => {
    /** One Swift function of the plugin, alone. */
    const fn = (signature: string): string => {
      const start = PLUGIN.indexOf(signature)
      if (start < 0) return ''
      const end = PLUGIN.indexOf('\n    }\n', start)
      return PLUGIN.slice(start, end < 0 ? undefined : end)
    }

    it('starts and stops its timer in one place each', () => {
      expect(PLUGIN.match(/DispatchSource\.makeTimerSource/gu)).toHaveLength(1)
      expect(fn('private func startLooking()')).toContain(
        'DispatchSource.makeTimerSource',
      )
      expect(fn('private func startLooking()')).toContain(
        'guard systemVolumeTimer == nil',
      )
      expect(fn('private func stopLooking()')).toContain(
        'systemVolumeTimer?.cancel()',
      )
      expect(fn('private func stopLooking()')).toContain(
        'systemVolumeTimer = nil',
      )
    })

    it('needs it while a screen listens, and until the view has settled and been read', () => {
      const needs = fn('private func needsLooking()')
      expect(needs).toContain('hasListeners("audioOutputChange")')
      expect(needs).toContain('!systemVolumeSettled()')
      expect(needs).toContain('lastSystemVolume == nil')
      const decide = fn('private func lookWhileNeeded()')
      expect(decide).toContain('if needsLooking()')
      expect(decide).toContain('startLooking()')
      expect(decide).toContain('stopLooking()')
    })

    // The route's own listener stays for the whole session: it must not keep
    // the slider looked at four times a second.
    it('needs it for no page that hears the route alone', () => {
      expect(fn('private func needsLooking()')).not.toBe('')
      expect(fn('private func needsLooking()')).not.toContain(
        'audioRouteChange',
      )
    })

    it('decides again on every tick, so it stops on its own once nobody listens', () => {
      expect(fn('private func startLooking()')).toMatch(
        /self\?\.lookAtSystemVolume\(\)\s+self\?\.lookWhileNeeded\(\)/u,
      )
    })

    // Capacitor calls these on the plugin's own queue; the timer and what
    // it reads live on the main queue.
    it.each(['addListener', 'removeListener', 'removeAllListeners'])(
      'decides again when the page calls %s',
      (method) => {
        const body = fn(`override public func ${method}(_ call: CAPPluginCall)`)
        expect(body).toContain(`super.${method}(call)`)
        expect(body).toMatch(
          /DispatchQueue\.main\.async \{ \[weak self\] in\s+self\?\.lookWhileNeeded\(\)/u,
        )
      },
    )

    it('starts looking as the volume view goes up', () => {
      expect(fn('private func putUpVolumeView()')).toContain('startLooking()')
      expect(fn('private func putUpVolumeView()')).not.toContain(
        'makeTimerSource',
      )
    })
  })

  it('keeps the interruptions and how the app last made its session active', () => {
    expect(PLUGIN).toContain('AVAudioSessionInterruptionTypeKey')
    expect(PLUGIN).toContain('AVAudioSessionInterruptionReasonKey')
    expect(PLUGIN).toContain('data["interrupted"] = interrupted')
    expect(PLUGIN).toContain('data["lastInterruption"]')
    expect(PLUGIN).toContain('data["activation"] = AudioSession.activation')
    expect(KIT).toContain('public private(set) static var activation')
  })

  // iOS 14.5 deprecated the suspension key as "No longer supported", so it
  // reads false: the app's state as an interruption arrives is what tells a
  // suspension from a call.
  it('says the app’s state as an interruption arrives, and not the suspension key iOS no longer sends', () => {
    expect(PLUGIN).not.toContain(
      'info[AVAudioSessionInterruptionWasSuspendedKey]',
    )
    expect(PLUGIN).not.toContain('wasSuspended')
    expect(PLUGIN).toContain(
      'let extra: [String: Any] = ["appState": Self.appState()]',
    )
    expect(PLUGIN).toContain('UIApplication.shared.applicationState')
    expect(PLUGIN).toContain('changed("interruption", extra)')
  })

  it('says why the route moved', () => {
    expect(PLUGIN).toContain('AVAudioSessionRouteChangeReasonKey')
    expect(PLUGIN).toContain('extra["routeReason"]')
  })
})

describe('reading, never changing', () => {
  it('never moves the volume slider, which would set the phone’s volume', () => {
    expect(PLUGIN).not.toMatch(/\.value\s*=[^=]/u)
    expect(PLUGIN).not.toContain('setValue')
  })

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

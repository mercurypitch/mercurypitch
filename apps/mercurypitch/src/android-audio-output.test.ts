// ============================================================
// The phone's sound output on Android: the native wiring
// ============================================================
//
// AudioOutputPlugin.java is the app's own plugin, so nothing registers it
// unless MainActivity does, and its names are strings on both sides of the
// bridge. It must stay a reader: the page's sound is the singer's to set.
// Nothing in CI runs on a phone, so the wiring is read off the sources, as
// android-picture-in-picture.test.ts does for the lyrics window.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (path: string): string =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')

/** A Java source with its comments dropped, so prose cannot satisfy a rule. */
const javaSource = (path: string): string =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/\/\/.*$/gmu, '')

const JAVA = '../android/app/src/main/java/com/irchiinnuss/mercurypitch/'
const ACTIVITY = javaSource(`${JAVA}MainActivity.java`)
const PLUGIN = javaSource(`${JAVA}AudioOutputPlugin.java`)
const JS_SIDE = read('../../../packages/mobile-runtime/src/audio-output.ts')

const pluginName = /@CapacitorPlugin\(\s*name\s*=\s*"([^"]+)"/u.exec(
  PLUGIN,
)?.[1]

describe('the plugin', () => {
  it('is registered before the bridge starts', () => {
    const onCreate =
      /void onCreate\(Bundle savedInstanceState\)\s*\{([\s\S]*?)super\.onCreate\(savedInstanceState\);/u.exec(
        ACTIVITY,
      )?.[1]
    expect(onCreate).toContain('registerPlugin(AudioOutputPlugin.class);')
  })

  it('goes by the name the JavaScript side asks for', () => {
    expect(pluginName).toBe('AudioOutput')
    expect(JS_SIDE).toContain(
      `registerPlugin<AudioOutputPlugin>('${pluginName}')`,
    )
  })

  it('answers read, which the JavaScript side calls', () => {
    expect(PLUGIN).toMatch(
      /@PluginMethod\s+public void read\(PluginCall call\)/u,
    )
    expect(JS_SIDE).toContain('.read()')
  })

  it('sends every change under the event the JavaScript side listens to', () => {
    const event = /EVENT_CHANGE\s*=\s*"([^"]+)"/u.exec(PLUGIN)?.[1]
    expect(event).toBe('audioOutputChange')
    expect(JS_SIDE).toContain(`'${event}'`)
    expect(PLUGIN).toContain('notifyListeners(EVENT_CHANGE, data)')
  })

  // The latency offset follows the route for as long as the app runs.
  it('sends a device coming or going under an event of its own as well', () => {
    const event = /EVENT_ROUTE\s*=\s*"([^"]+)"/u.exec(PLUGIN)?.[1]
    expect(event).toBe('audioRouteChange')
    expect(JS_SIDE).toContain(`'${event}'`)
    expect(PLUGIN).toMatch(
      /if \("route"\.equals\(reason\)\) \{\s*notifyListeners\(EVENT_ROUTE, data\);/u,
    )
    expect(PLUGIN.match(/changed\("route"\)/gu)).toHaveLength(2)
  })

  it('reports under the names the JavaScript side reads', () => {
    for (const key of [
      'outputVolume',
      'volumeStep',
      'volumeSteps',
      'outputs',
    ]) {
      expect(PLUGIN).toContain(`data.put("${key}",`)
      expect(JS_SIDE).toContain(`data.${key}`)
    }
    expect(PLUGIN).toContain('port.put("type",')
    expect(PLUGIN).toContain('port.put("name",')
  })

  it('hears the volume keys and devices coming and going', () => {
    expect(PLUGIN).toContain(
      'registerContentObserver(Settings.System.CONTENT_URI',
    )
    expect(PLUGIN).toContain('registerAudioDeviceCallback(')
  })

  it.each([
    'setStreamVolume',
    'adjustStreamVolume',
    'adjustVolume',
    'setMode',
    'setSpeakerphoneOn',
    'setCommunicationDevice',
    'requestAudioFocus',
  ])('never calls %s: it only reads', (setter) => {
    expect(PLUGIN).not.toContain(setter)
  })
})

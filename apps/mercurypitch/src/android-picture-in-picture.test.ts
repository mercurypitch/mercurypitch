// ============================================================
// The Karaoke room's lyrics window on Android: the native wiring
// ============================================================
//
// The window is the app's own Capacitor plugin (PictureInPicturePlugin.java),
// not an npm package, so nothing registers it unless MainActivity does, and
// it hears nothing unless MainActivity passes on the two moments it needs.
// Each of those is a line that compiles fine when it is missing: the room
// would ask for a window and get `Unimplemented`, or open one and never
// draw its compact view. Nothing in CI runs on a phone, so the wiring is
// read off the sources, as android-main-activity.test.ts does for sign-in.

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
const PLUGIN = javaSource(`${JAVA}PictureInPicturePlugin.java`)
const MANIFEST = read('../android/app/src/main/AndroidManifest.xml').replace(
  /<!--[\s\S]*?-->/gu,
  '',
)
const JS_SIDE = read(
  '../../../packages/mobile-runtime/src/picture-in-picture.ts',
)

const pluginName = /@CapacitorPlugin\(\s*name\s*=\s*"([^"]+)"/u.exec(
  PLUGIN,
)?.[1]

describe('the plugin', () => {
  it('is registered before the bridge starts', () => {
    expect(ACTIVITY).toMatch(
      /void onCreate\(Bundle savedInstanceState\)\s*\{\s*registerPlugin\(PictureInPicturePlugin\.class\);\s*super\.onCreate\(savedInstanceState\);/u,
    )
  })

  it('goes by the name the activity and the JavaScript side ask for', () => {
    // Strings on both sides, so no compiler checks them.
    expect(pluginName).toBe('PictureInPicture')
    expect(ACTIVITY).toContain(`getPlugin("${pluginName}")`)
    expect(JS_SIDE).toContain(
      `registerPlugin<PictureInPicturePlugin>('${pluginName}')`,
    )
  })

  it('reports the window under the event name the JavaScript side listens to', () => {
    const event = /EVENT_CHANGE\s*=\s*"([^"]+)"/u.exec(PLUGIN)?.[1]
    expect(event).toBeDefined()
    expect(JS_SIDE).toContain(`'${event}'`)
    expect(PLUGIN).toContain(
      'data.put("inPictureInPicture", inPictureInPicture)',
    )
  })
})

describe('MainActivity', () => {
  it('enters by hand on leaving, below Android 12', () => {
    expect(ACTIVITY).toMatch(
      /void onUserLeaveHint\(\)\s*\{\s*super\.onUserLeaveHint\(\);[\s\S]*?\.enterOnLeave\(\);/u,
    )
  })

  it('passes the window coming and going on to the plugin', () => {
    expect(ACTIVITY).toMatch(
      /void onPictureInPictureModeChanged\(boolean isInPictureInPictureMode, Configuration newConfig\)\s*\{\s*super\.onPictureInPictureModeChanged\(isInPictureInPictureMode, newConfig\);[\s\S]*?\.modeChanged\(isInPictureInPictureMode\);/u,
    )
  })
})

describe('the manifest', () => {
  const activity = /<activity\b[^>]*android:name="\.MainActivity"[^>]*>/u.exec(
    MANIFEST,
  )?.[0]

  it('lets MainActivity into the window', () => {
    expect(activity).toContain('android:supportsPictureInPicture="true"')
  })

  it('keeps the activity, and the song, through the resize', () => {
    // Without these a size change recreates the activity, and the WebView
    // reloads the app mid-song.
    const handled =
      /android:configChanges="([^"]+)"/u.exec(activity ?? '')?.[1].split('|') ??
      []
    expect(handled).toEqual(
      expect.arrayContaining([
        'screenSize',
        'smallestScreenSize',
        'screenLayout',
        'orientation',
      ]),
    )
  })
})

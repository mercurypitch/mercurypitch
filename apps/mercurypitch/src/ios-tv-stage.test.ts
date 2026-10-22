// ============================================================
// The Karaoke room's stage on a connected TV: the native wiring
// ============================================================
//
// A proof of concept (ios/App/App/LyricsWindow/TVStage.swift). The rules
// that are easy to lose and fail silently: the plugin answers the names the
// JavaScript side calls and sends the event it listens to; the TV gets a
// window only on an external display's scene and only with the switch on,
// which starts off, so a store build mirrors; the window holds a plain web
// view with no bridge of its own and no plugins, showing the stage page from
// the app's bundle through the bridge's own scheme handler, and none where
// the bundle has no page or it does not load, so the TV mirrors; a message the
// room sends reaches the page, and the newest song and frame wait for a page
// still loading; a TV shows the lyrics or the stage, never both; and Xcode
// compiles the file at all. Nothing in CI connects a TV, so all of it is
// read off the sources, as the lyrics on a TV are (ios-tv-lyrics.test.ts).

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
const STAGE = swiftSource(`${WINDOW}TVStage.swift`)
const PROJECT = read('../ios/App/App.xcodeproj/project.pbxproj')
const JS_SIDE = read(
  '../../../packages/mobile-runtime/src/picture-in-picture.ts',
)
const PAGE = read('../stage.html')
const PAGE_SCRIPT = read('./stage/main.ts')

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
  it.each(['setTvStage', 'getTvStage', 'pushTvStage'])(
    'answers %s, which the JavaScript side calls',
    (method) => {
      expect(PLUGIN).toContain(
        `CAPPluginMethod(name: "${method}", returnType: CAPPluginReturnPromise)`,
      )
      expect(PLUGIN).toContain(`@objc func ${method}(_ call: CAPPluginCall)`)
      expect(JS_SIDE).toContain(`.${method}(`)
    },
  )

  it('sends tvStageChange, which the JavaScript side listens to', () => {
    expect(PLUGIN).toMatch(
      /notifyListeners\("tvStageChange", data: \[\s*"connected":/u,
    )
    expect(JS_SIDE).toContain("addListener('tvStageChange'")
  })

  it('reads a message under the names the JavaScript side sends', () => {
    const push = swiftFunction(PLUGIN, 'pushTvStage')
    expect(push).toContain('call.getString("json")')
    expect(push).toContain('call.getString("kind")')
    expect(push).toContain('self?.stage?.push(json, kind: kind)')
    expect(JS_SIDE).toMatch(/pushTvStage\(\{\s*kind: message\.kind,\s*json:/u)
  })

  it('turns the other switch off, so a TV shows one or the other', () => {
    expect(swiftFunction(PLUGIN, 'setTvStage')).toMatch(
      /if enabled \{\s*self\?\.tv\?\.setEnabled\(false\)\s*\}\s*self\?\.stage\?\.setEnabled\(enabled\)/u,
    )
    expect(swiftFunction(PLUGIN, 'setTvLyrics')).toMatch(
      /if enabled \{\s*self\?\.stage\?\.setEnabled\(false\)\s*\}\s*self\?\.tv\?\.setEnabled\(enabled\)/u,
    )
    expect(swiftFunction(PLUGIN, 'load')).toMatch(
      /if stage\.enabled && tv\.enabled \{\s*tv\.setEnabled\(false\)/u,
    )
  })

  it('serves the stage page from the bundle with the bridge’s own handler', () => {
    const page = swiftFunction(PLUGIN, 'stagePage')
    expect(page).toContain('bridge.config.localURL.scheme')
    expect(page).toContain(
      'bridge.webView?.configuration.urlSchemeHandler(forURLScheme: scheme)',
    )
    expect(page).toContain('appendingPathComponent("stage.html")')
  })

  it('finds no page where the bundle has none, as a store build has not', () => {
    const page = swiftFunction(PLUGIN, 'stagePage')
    expect(page).toMatch(
      /let file = bridge\.config\.appLocation\.appendingPathComponent\("stage\.html"\)\s*guard FileManager\.default\.fileExists\(atPath: file\.path\) else \{\s*return nil/u,
    )
  })
})

describe('the TV', () => {
  it('takes an external display’s scene and no other', () => {
    expect(swiftFunction(STAGE, 'isTV')).toContain(
      'scene.session.role == .windowExternalDisplayNonInteractive',
    )
    expect(swiftFunction(STAGE, 'connect')).toMatch(
      /guard Self\.isTV\(scene\)/u,
    )
  })

  it('puts a window up only with the switch on, which starts off', () => {
    expect(STAGE).toContain(
      'private(set) var enabled = UserDefaults.standard.bool(forKey: TVStage.enabledKey)',
    )
    expect(STAGE).toContain('static let enabledKey = "mp.tvStage.enabled"')
    expect(swiftFunction(STAGE, 'connect')).toMatch(/if enabled \{\s*show\(\)/u)
    expect(STAGE.match(/UIWindow\(windowScene:/gu) ?? []).toHaveLength(1)
  })

  it('takes the window down with the switch, so the TV mirrors again', () => {
    expect(swiftFunction(STAGE, 'setEnabled')).toMatch(
      /if on \{\s*show\(\)\s*\} else \{\s*hide\(\)/u,
    )
    expect(swiftFunction(STAGE, 'hide')).toMatch(
      /window\.isHidden = true\s*self\.window = nil/u,
    )
    expect(swiftFunction(STAGE, 'disconnect')).toContain('hide()')
  })

  it('gives the TV back to the mirror when the page does not load', () => {
    expect(swiftFunction(STAGE, 'show')).toMatch(
      /guard let page = findPage\(\) else \{[^}]*return\s*\}/u,
    )
    const failed = swiftFunction(STAGE, 'pageFailed')
    expect(failed).toContain('code != NSURLErrorCancelled')
    expect(failed).toMatch(/hide\(\)\s*tell\(\)/u)
  })

  it('shows a plain web view: no bridge of its own, no plugins', () => {
    const show = swiftFunction(STAGE, 'show')
    expect(show).toContain('WKWebViewConfiguration()')
    expect(show).toContain(
      'configuration.setURLSchemeHandler(page.handler, forURLScheme: page.scheme)',
    )
    expect(show).toContain('web.load(URLRequest(url: page.url))')
    expect(STAGE).not.toMatch(
      /CAPBridge|registerPluginInstance|import Capacitor/u,
    )
  })

  it('hands each message to the page, and keeps the newest for a page still loading', () => {
    expect(swiftFunction(STAGE, 'deliver')).toContain(
      'window.__mpStage.receive(message)',
    )
    expect(swiftFunction(STAGE, 'deliver')).toMatch(
      /guard loaded, let webView/u,
    )
    expect(swiftFunction(STAGE, 'pageLoaded')).toMatch(
      /if let lastSong \{\s*deliver\(lastSong\)\s*\}\s*if let lastFrame \{\s*deliver\(lastFrame\)/u,
    )
    expect(PAGE_SCRIPT).toContain('window.__mpStage = {')
  })
})

describe('the stage page', () => {
  it('loads its own script and nothing of the app', () => {
    const markup = PAGE.replace(/<!--[\s\S]*?-->/gu, '')
    expect(markup).toContain('<script type="module" src="/src/stage/main.ts">')
    expect(markup.match(/<script|<link/gu) ?? []).toHaveLength(1)
    expect(markup).not.toMatch(/main\.tsx|capacitor/iu)
  })

  it('reaches only the stage’s own modules', () => {
    const imports = [...PAGE_SCRIPT.matchAll(/from '([^']+)'/gu)].map(
      (match) => match[1],
    )
    expect(imports.length).toBeGreaterThan(0)
    for (const path of imports) expect(path).toMatch(/^@\/lib\/tv-stage\//u)
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

  it('compiles TVStage.swift into the app, from the window’s folder', () => {
    expect(PROJECT).toContain(
      '/* TVStage.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = TVStage.swift; sourceTree = "<group>"; };',
    )
    expect(sources).toContain('/* TVStage.swift in Sources */')
    expect(group).toContain('/* TVStage.swift */')
  })
})

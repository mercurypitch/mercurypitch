// ============================================================
// Native games profile tests — preserve store inputs and reject mismatched web output
// ============================================================

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { gamesInfoPlist, parseOptions, requiredGameAssets, stageGamesProfile, verifySyncedGamesProfile, } from './native-games.ts'

const temporary: string[] = []
const publicDirectory = fileURLToPath(new URL('../public/', import.meta.url))

function fixture(): string {
  const directory = mkdtempSync(resolve(tmpdir(), 'beside-cue-native-'))
  temporary.push(directory)
  return directory
}

function put(directory: string, path: string, value = 'fixture'): void {
  const target = resolve(directory, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, value)
}

afterEach(() => {
  for (const directory of temporary.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

describe('explicit native games profile', () => {
  it('keeps every declared static source asset materialized in public', () => {
    expect(requiredGameAssets.length).toBeGreaterThan(0)
    for (const asset of requiredGameAssets.filter(
      (candidate) =>
        candidate.startsWith('games/') || candidate.startsWith('models/'),
    )) {
      const source = resolve(publicDirectory, asset)
      expect(
        existsSync(source),
        `${asset} is missing from public sources`,
      ).toBe(true)
      const stats = statSync(source)
      expect(stats.isFile(), `${asset} must be a file`).toBe(true)
      expect(stats.size, `${asset} must not be empty`).toBeGreaterThan(0)
      expect(
        readFileSync(source)
          .subarray(0, 64)
          .toString('utf8')
          .startsWith('version https://git-lfs.github.com/spec/v1'),
        `${asset} must contain materialized bytes rather than a Git LFS pointer`,
      ).toBe(false)
    }
  })

  it('requires the platform and refuses contradictory or unsupported actions', () => {
    expect(() => parseOptions([])).toThrow('Choose --platform')
    expect(() => parseOptions(['--platform', 'web'])).toThrow(
      'must be android or ios',
    )
    expect(() => parseOptions(['--platform', 'ios', '--assemble'])).toThrow(
      'Android-only',
    )
    expect(() =>
      parseOptions(['--platform', 'android', '--prepare-only', '--build']),
    ).toThrow('cannot build')
    expect(() => parseOptions(['--platform', 'android', '--unknown'])).toThrow(
      'Unknown',
    )
    expect(parseOptions(['--', '--platform', 'android', '--assemble'])).toEqual(
      { platform: 'android', assemble: true, build: false, prepareOnly: false },
    )
  })

  it('adds the iOS purpose at the root, preserving nested dictionaries and canonical source', () => {
    const directory = fixture()
    const canonical = readFileSync(resolve('ios/App/App/Info.plist'), 'utf8')
    put(directory, 'ios/App/App/Info.plist', canonical)
    stageGamesProfile(directory, 'ios', true)
    const generated = readFileSync(
      resolve(directory, 'ios/App/build/games/Info.plist'),
      'utf8',
    )
    expect(generated).toContain('<key>NSMicrophoneUsageDescription</key>')
    expect(generated).toMatch(
      /<key>NSMicrophoneUsageDescription<\/key>\s*<string>[^<]+<\/string>\s*<\/dict>\s*<\/plist>/u,
    )
    expect(
      readFileSync(resolve(directory, 'ios/App/App/Info.plist'), 'utf8'),
    ).toBe(canonical)
    expect(existsSync(resolve(directory, 'dist'))).toBe(false)
    expect(() => gamesInfoPlist(generated)).toThrow('Canonical store plist')
    expect(() => gamesInfoPlist('<plist><array></array></plist>')).toThrow(
      'root dictionary',
    )
  })

  it('rejects store/incomplete output before stamping anything or generating a plist', () => {
    const directory = fixture()
    put(directory, 'dist/index.html', '<html>Store bundle</html>')
    expect(() => stageGamesProfile(directory, 'android', false)).toThrow(
      'models/swiftf0.onnx',
    )
    expect(() => stageGamesProfile(directory, 'ios', false)).toThrow(
      'models/swiftf0.onnx',
    )
    expect(
      existsSync(resolve(directory, 'dist/native-games-profile.json')),
    ).toBe(false)
    expect(
      existsSync(resolve(directory, 'ios/App/build/games/Info.plist')),
    ).toBe(false)
  })

  it('stamps only a complete games bundle and refreshes provenance after a changed build', () => {
    const directory = fixture()
    for (const asset of requiredGameAssets) put(directory, `dist/${asset}`)
    stageGamesProfile(directory, 'android', false)
    const first = JSON.parse(
      readFileSync(
        resolve(directory, 'dist/native-games-profile.json'),
        'utf8',
      ),
    )
    expect(first).toMatchObject({
      schema: 3,
      profile: 'games',
      platform: 'android',
      assets: requiredGameAssets,
    })
    expect(first.indexSha256).toMatch(/^[a-f0-9]{64}$/u)
    expect(Object.keys(first.assetSha256)).toEqual([...requiredGameAssets])
    for (const asset of requiredGameAssets)
      expect(first.assetSha256[asset]).toMatch(/^[a-f0-9]{64}$/u)
    put(directory, 'dist/index.html', 'new build')
    stageGamesProfile(directory, 'android', false)
    const second = JSON.parse(
      readFileSync(
        resolve(directory, 'dist/native-games-profile.json'),
        'utf8',
      ),
    )
    expect(second.indexSha256).not.toBe(first.indexSha256)
    expect(second.assetSha256['index.html']).not.toBe(
      first.assetSha256['index.html'],
    )
  })

  it('rejects an empty model download even when every required path exists', () => {
    const directory = fixture()
    for (const asset of requiredGameAssets) put(directory, `dist/${asset}`)
    put(directory, 'dist/models/swiftf0.onnx', '')
    expect(() => stageGamesProfile(directory, 'android', false)).toThrow(
      'models/swiftf0.onnx',
    )
    expect(
      existsSync(resolve(directory, 'dist/native-games-profile.json')),
    ).toBe(false)
  })

  it('rejects a Git LFS pointer before stamping a native profile', () => {
    const directory = fixture()
    for (const asset of requiredGameAssets) put(directory, `dist/${asset}`)
    put(
      directory,
      'dist/games/adventure-v6/opaline-echo-amphora.glb',
      'version https://git-lfs.github.com/spec/v1\n' +
        'oid sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\n' +
        'size 123456\n',
    )

    expect(() => stageGamesProfile(directory, 'android', false)).toThrow(
      'Git LFS pointer for games/adventure-v6/opaline-echo-amphora.glb',
    )
    expect(
      existsSync(resolve(directory, 'dist/native-games-profile.json')),
    ).toBe(false)
  })

  it('verifies every declared byte after Capacitor copies the native profile', () => {
    const directory = fixture()
    for (const asset of requiredGameAssets) put(directory, `dist/${asset}`)
    stageGamesProfile(directory, 'android', false)
    const nativePublic = resolve(
      directory,
      'android/app/src/main/assets/public',
    )
    cpSync(resolve(directory, 'dist'), nativePublic, { recursive: true })

    expect(() => verifySyncedGamesProfile(directory, 'android')).not.toThrow()
    put(nativePublic, 'games/adventure-v6/opaline-echo-amphora.glb', 'corrupx')
    expect(() => verifySyncedGamesProfile(directory, 'android')).toThrow(
      'differs at games/adventure-v6/opaline-echo-amphora.glb',
    )
    cpSync(resolve(directory, 'dist'), nativePublic, { recursive: true })
    rmSync(resolve(nativePublic, 'games/adventure-v6/opaline-echo-amphora.glb'))
    expect(() => verifySyncedGamesProfile(directory, 'android')).toThrow(
      'opaline-echo-amphora.glb',
    )
  })

  it('rejects a copied marker for the other native platform', () => {
    const directory = fixture()
    for (const asset of requiredGameAssets) put(directory, `dist/${asset}`)
    stageGamesProfile(directory, 'android', false)
    cpSync(
      resolve(directory, 'dist'),
      resolve(directory, 'ios/App/App/public'),
      {
        recursive: true,
      },
    )

    expect(() => verifySyncedGamesProfile(directory, 'ios')).toThrow(
      'does not match its bundle',
    )
  })

  it('keeps canonical store permissions off and scopes the generated plist selector to the app target', () => {
    const store = readFileSync(
      resolve('android/app/src/main/AndroidManifest.xml'),
      'utf8',
    ).replace(/<!--[\s\S]*?-->/gu, '')
    const games = readFileSync(
      resolve('android/app/src/games/AndroidManifest.xml'),
      'utf8',
    )
    for (const permission of [
      'android.permission.RECORD_AUDIO',
      'android.permission.MODIFY_AUDIO_SETTINGS',
    ]) {
      expect(store).not.toContain(permission)
      expect(games).toContain(`android:name="${permission}"`)
    }
    expect(games).toContain(
      'android:name="android.hardware.microphone" android:required="false"',
    )
    const gradle = readFileSync(resolve('android/app/build.gradle'), 'utf8')
    expect(gradle).toContain('profile.schema != 3')
    expect(gradle).toContain('profile.assetSha256[asset]')
    expect(
      readFileSync(resolve('ios/App/App/Info.plist'), 'utf8'),
    ).not.toContain('NSMicrophoneUsageDescription')
    const project = readFileSync(
      resolve('ios/App/App.xcodeproj/project.pbxproj'),
      'utf8',
    )
    const selected = project
      .split('buildSettings = {')
      .slice(1)
      .filter((block) =>
        block.split('};')[0].includes('BESIDE_CUE_INFO_PLIST_PATH'),
      )
    expect(selected).toHaveLength(2)
    for (const block of selected) {
      const settings = block.split('};')[0]
      expect(settings).toContain(
        'PRODUCT_BUNDLE_IDENTIFIER = com.irchiinnuss.besidecue;',
      )
      expect(settings).toContain('BESIDE_CUE_INFO_PLIST_PATH = App/Info.plist;')
      expect(settings).toContain(
        'INFOPLIST_FILE = "$(BESIDE_CUE_INFO_PLIST_PATH)";',
      )
    }
  })
})

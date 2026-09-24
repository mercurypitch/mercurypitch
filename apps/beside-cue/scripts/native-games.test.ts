// ============================================================
// Native games profile tests — preserve store inputs and reject mismatched web output
// ============================================================

import { glassGameAssetPath } from '@irchiinnuss/glass-game/assets'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { gamesInfoPlist, nativeGamesChecksumFile, parseOptions, requiredGameAssets, stageGamesProfile, verifySyncedGamesProfile, } from './native-games.ts'

const temporary: string[] = []
const opalineAsset = `games/${glassGameAssetPath('opaline-v6')}`
const publicDirectory = fileURLToPath(new URL('../public/', import.meta.url))
const iosGuard = resolve('ios/App/scripts/validate-native-games-profile.sh')

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

function runIosGuard(directory: string, plist: string) {
  return spawnSync('/bin/sh', [iosGuard], {
    encoding: 'utf8',
    env: {
      ...process.env,
      BESIDE_CUE_INFO_PLIST_PATH: plist,
      INFOPLIST_FILE: plist,
      SRCROOT: resolve(directory, 'ios/App'),
    },
  })
}

afterEach(() => {
  for (const directory of temporary.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

describe('explicit native games profile', () => {
  it('includes each referenced glTF buffer and image in the shared offline package', () => {
    const declared = new Set<string>(requiredGameAssets)
    const models = requiredGameAssets.filter((asset) => asset.endsWith('.gltf'))
    expect(models.length).toBeGreaterThan(0)
    for (const model of models) {
      const document = JSON.parse(
        readFileSync(resolve(publicDirectory, model), 'utf8'),
      ) as {
        buffers?: { uri?: string }[]
        images?: { uri?: string }[]
      }
      for (const resource of [
        ...(document.buffers ?? []),
        ...(document.images ?? []),
      ]) {
        if (resource.uri === undefined) continue
        expect(resource.uri).not.toMatch(/[:\\\\]|^\//u)
        const dependency = posix.join(posix.dirname(model), resource.uri)
        expect(dependency.startsWith('games/')).toBe(true)
        expect(
          declared.has(dependency),
          `${model} needs ${dependency} offline`,
        ).toBe(true)
      }
    }
  })

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
      `dist/${opalineAsset}`,
      'version https://git-lfs.github.com/spec/v1\n' +
        'oid sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\n' +
        'size 123456\n',
    )

    expect(() => stageGamesProfile(directory, 'android', false)).toThrow(
      `Git LFS pointer for ${opalineAsset}`,
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
    put(nativePublic, opalineAsset, 'corrupx')
    expect(() => verifySyncedGamesProfile(directory, 'android')).toThrow(
      `differs at ${opalineAsset}`,
    )
    cpSync(resolve(directory, 'dist'), nativePublic, { recursive: true })
    rmSync(resolve(nativePublic, opalineAsset))
    expect(() => verifySyncedGamesProfile(directory, 'android')).toThrow(
      opalineAsset,
    )
    cpSync(resolve(directory, 'dist'), nativePublic, { recursive: true })
    rmSync(resolve(nativePublic, nativeGamesChecksumFile))
    expect(() => verifySyncedGamesProfile(directory, 'android')).toThrow(
      'checksum manifest',
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

  it('blocks a stale games sync from a default iOS store build', () => {
    const directory = fixture()
    const canonical = readFileSync(resolve('ios/App/App/Info.plist'), 'utf8')
    put(directory, 'ios/App/App/Info.plist', canonical)
    put(directory, 'ios/App/App/public/index.html', 'store')

    const clean = runIosGuard(directory, 'App/Info.plist')
    expect(clean.status, clean.stderr).toBe(0)

    for (const asset of requiredGameAssets) put(directory, `dist/${asset}`)
    stageGamesProfile(directory, 'ios', false)
    cpSync(
      resolve(directory, 'dist'),
      resolve(directory, 'ios/App/App/public'),
      { recursive: true },
    )

    const stale = runIosGuard(directory, 'App/Info.plist')
    expect(stale.status).not.toBe(0)
    expect(stale.stderr).toContain('Store profile contains games assets')
    expect(stale.stderr).toContain('run cap sync ios')
  })

  it('accepts only an intact iOS games sync with the generated plist', () => {
    const directory = fixture()
    const canonical = readFileSync(resolve('ios/App/App/Info.plist'), 'utf8')
    put(directory, 'ios/App/App/Info.plist', canonical)
    for (const asset of requiredGameAssets) put(directory, `dist/${asset}`)
    stageGamesProfile(directory, 'ios', false)
    cpSync(
      resolve(directory, 'dist'),
      resolve(directory, 'ios/App/App/public'),
      { recursive: true },
    )

    const valid = runIosGuard(directory, 'build/games/Info.plist')
    expect(valid.status, valid.stderr).toBe(0)

    put(directory, `ios/App/App/public/${opalineAsset}`, 'corrupt')
    const corrupt = runIosGuard(directory, 'build/games/Info.plist')
    expect(corrupt.status).not.toBe(0)
    expect(corrupt.stderr).toContain(
      'Games profile assets do not match the stamped checksums',
    )

    expect(
      readFileSync(
        resolve(directory, 'ios/App/App/public', nativeGamesChecksumFile),
        'utf8',
      ),
    ).toContain(opalineAsset)
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
    expect(project).toContain('Validate Native Games Profile')
    expect(project).toContain(
      '$SRCROOT/scripts/validate-native-games-profile.sh',
    )
    const targetPhases = project.split('buildPhases = (')[1]?.split(');')[0]
    expect(targetPhases).toContain('Validate Native Games Profile')
    expect(targetPhases?.indexOf('Validate Native Games Profile')).toBeLessThan(
      targetPhases?.indexOf('Resources') ?? -1,
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

  it('wires the complete games profile into non-tag distribution builds', () => {
    const repository = fileURLToPath(new URL('../../../', import.meta.url))
    const caller = readFileSync(
      resolve(repository, '.github/workflows/beside-cue-mobile.yml'),
      'utf8',
    )
    const reusable = readFileSync(
      resolve(repository, '.github/workflows/capacitor-app.yml'),
      'utf8',
    )

    expect(caller).toContain("tags: ['bc-v*']")
    expect(caller).toContain('packages/glass-game/**')
    expect(caller).toContain('native-test-profile-script: native:games')
    expect(caller).toContain(
      'native-test-android-gradle-property: besideCueGames=1',
    )
    expect(caller).toContain(
      'native-test-ios-build-setting: BESIDE_CUE_INFO_PLIST_PATH=build/games/Info.plist',
    )
    expect(caller).toContain('size-fail-mb: 150')
    expect(caller).toContain('native-test-size-warn-mb: 300')
    expect(caller).toContain('native-test-size-fail-mb: 340')
    for (const path of [
      'apps/beside-cue/public/games/**',
      'apps/beside-cue/public/models/**',
      'apps/beside-cue/public/ort/**',
    ])
      expect(caller).toContain(path)

    expect(reusable.match(/USE_NATIVE_TEST_PROFILE:/gu)).toHaveLength(3)
    expect(reusable).toContain(
      "!startsWith(github.ref, format('refs/tags/{0}', inputs.tag-prefix)) && inputs.native-test-profile-script != ''",
    )
    expect(
      reusable.match(
        /"\$NATIVE_TEST_PROFILE_SCRIPT" -- --platform (?:android|ios) --build/gu,
      ),
    ).toHaveLength(4)
    expect(
      reusable.match(
        /profile_args\+=\("-P\$NATIVE_TEST_ANDROID_GRADLE_PROPERTY"\)/gu,
      ),
    ).toHaveLength(2)
    expect(
      reusable.match(/profile_args\+=\("\$NATIVE_TEST_IOS_BUILD_SETTING"\)/gu),
    ).toHaveLength(2)
    expect(reusable).toContain('Upload signed native testing artifacts')
    expect(reusable).toContain(
      "if: env.USE_NATIVE_TEST_PROFILE == 'true' && env.HAS_UPLOAD_KEY == 'true'",
    )
    expect(reusable).toContain(
      "UPLOAD: ${{ github.event_name != 'pull_request' && (inputs.testflight-upload-from == 'main-and-tags' || github.ref_type == 'tag') }}",
    )
  })
})

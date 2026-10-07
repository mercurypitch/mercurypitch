// ============================================================
// Native games profile tests — preserve store inputs and reject mismatched web output
// ============================================================

import { GLASS_GAME_NATIVE_MOBILE_ASSET_PAIRS, GLASS_GAME_REQUIRED_FILES, glassGameAssetPath, } from '@irchiinnuss/glass-game/assets'
import { SINGING_CURRENT_WALL_PROFILES } from '@irchiinnuss/glass-game/current-wall-profiles'
import { RUNNER_MATERIAL_FINISH_TEXTURE_IDS } from '@irchiinnuss/glass-game/material-finishes'
import { spawnSync } from 'node:child_process'
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NATIVE_DESKTOP_ONLY_GAME_ASSETS, NATIVE_EXCLUDED_GAME_ASSETS, NATIVE_RETIRED_GAME_ASSETS, NATIVE_SOURCE_NORMAL_GAME_ASSETS, } from './game-assets.ts'
import { gamesInfoPlist, nativeGamesChecksumFile, parseOptions, requiredGameAssets, stageGamesProfile, verifySyncedGamesProfile, } from './native-games.ts'

const temporary: string[] = []
const opalineAsset = `games/${glassGameAssetPath('opaline-v6')}`
const R3_NATIVE_GAME_ASSETS = [
  'games/adventure-v2/platform-kit.glb',
  'games/adventure-v2/garden-kit.glb',
  'games/adventure-v5/painting-garden.webp',
] as const
// Readiness dependencies are independent of the packaging exclusion policy.
const RUNNER_READY_GAME_ASSETS = [
  'merc',
  'floor-marble',
  'floating-museum-cloudscape-v3',
  'living-crystal-platform-v2',
  'museum-kit-v2',
  'museum-garden-v2',
  'museum-arcade-v3',
  'museum-canopy-v3',
  'runner-crystal-bulwark-v1',
  'runner-rose-hurdle-v1',
  ...RUNNER_MATERIAL_FINISH_TEXTURE_IDS,
  ...Object.values(SINGING_CURRENT_WALL_PROFILES).map(({ bundle }) => bundle),
].map((id) => `games/${glassGameAssetPath(id)}`)
const CURRENT_DELIVERY_GAME_ASSETS = GLASS_GAME_REQUIRED_FILES.filter(
  (asset) =>
    (asset.startsWith('singing-current-walls-v1/') && asset.endsWith('.glb')) ||
    (asset.startsWith('runner-obstacles-v1/') && asset.endsWith('.glb')) ||
    (asset.startsWith('shatter-sounds-v1/') && asset.endsWith('.mp3')) ||
    (asset.startsWith('adventure-v2/textures/') &&
      asset.endsWith('-normal.webp')),
).map((asset) => `games/${asset}`)
const publicDirectory = fileURLToPath(new URL('../public/', import.meta.url))
const repository = fileURLToPath(new URL('../../../', import.meta.url))
const iosGuard = resolve('ios/App/scripts/validate-native-games-profile.sh')
const optionalProfileRunner = resolve(
  repository,
  '.github/scripts/run-with-optional-profile-argument.sh',
)

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
  vi.unstubAllEnvs()
  for (const directory of temporary.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

describe('explicit native games profile', () => {
  it('declares every in-app runner readiness dependency for offline delivery', () => {
    for (const asset of RUNNER_READY_GAME_ASSETS)
      expect(
        requiredGameAssets.includes(asset),
        `${asset} must be available before runner ready`,
      ).toBe(true)
  })

  it.each(['android', 'ios'] as const)(
    'retains and verifies runner dependencies through the %s native sync',
    (platform) => {
      const directory = fixture()
      for (const asset of requiredGameAssets) put(directory, `dist/${asset}`)
      for (const asset of RUNNER_READY_GAME_ASSETS)
        put(directory, `dist/${asset}`, `${asset} runner`)
      if (platform === 'ios')
        put(
          directory,
          'ios/App/App/Info.plist',
          readFileSync(resolve('ios/App/App/Info.plist'), 'utf8'),
        )
      stageGamesProfile(directory, platform, false)
      const nativePublic = resolve(
        directory,
        platform === 'android'
          ? 'android/app/src/main/assets/public'
          : 'ios/App/App/public',
      )
      cpSync(resolve(directory, 'dist'), nativePublic, { recursive: true })
      expect(() => verifySyncedGamesProfile(directory, platform)).not.toThrow()
      const checksums = readFileSync(
        resolve(nativePublic, nativeGamesChecksumFile),
        'utf8',
      )
      for (const asset of RUNNER_READY_GAME_ASSETS) {
        expect(checksums.includes(`  ${asset}\n`), asset).toBe(true)
        expect(readFileSync(resolve(nativePublic, asset), 'utf8')).toBe(
          `${asset} runner`,
        )
      }
      const arcade = `games/${glassGameAssetPath('museum-arcade-v3')}`
      rmSync(resolve(nativePublic, arcade))
      expect(() => verifySyncedGamesProfile(directory, platform)).toThrow(
        arcade,
      )
    },
  )

  it('subtracts exactly native-ineligible bytes and keeps each mobile alternative', () => {
    const native = new Set(requiredGameAssets)
    const webOnly = GLASS_GAME_REQUIRED_FILES.map(
      (asset) => `games/${asset}`,
    ).filter((asset) => !native.has(asset))

    const declaredWeb = new Set(
      GLASS_GAME_REQUIRED_FILES.map((asset) => `games/${asset}`),
    )
    expect([...webOnly].sort()).toEqual(
      NATIVE_EXCLUDED_GAME_ASSETS.filter((asset) =>
        declaredWeb.has(asset),
      ).sort(),
    )
    for (const asset of NATIVE_RETIRED_GAME_ASSETS) {
      expect(declaredWeb.has(asset)).toBe(false)
      expect(native.has(asset)).toBe(false)
    }
    for (const id of [
      'cloudway-platform-kit-v1',
      'floating-museum-architecture-kit-v6',
      'floating-museum-twin-finish-kit-v4',
    ])
      expect(native.has(`games/${glassGameAssetPath(id)}`)).toBe(true)
    for (const asset of R3_NATIVE_GAME_ASSETS)
      expect(native.has(asset), `${asset} must remain native`).toBe(true)
    expect(NATIVE_DESKTOP_ONLY_GAME_ASSETS).toEqual(
      GLASS_GAME_NATIVE_MOBILE_ASSET_PAIRS.map(
        ({ desktop }) => `games/${desktop}`,
      ),
    )
    for (const { desktop, mobile } of GLASS_GAME_NATIVE_MOBILE_ASSET_PAIRS) {
      expect(native.has(`games/${desktop}`)).toBe(false)
      expect(native.has(`games/${mobile}`)).toBe(true)
    }
    expect(native.has(`games/${glassGameAssetPath('merc')}`)).toBe(true)
    expect(
      CURRENT_DELIVERY_GAME_ASSETS.filter((asset) => asset.endsWith('.glb')),
    ).toHaveLength(12)
    expect(
      CURRENT_DELIVERY_GAME_ASSETS.filter((asset) => asset.endsWith('.mp3')),
    ).toHaveLength(14)
    expect(
      CURRENT_DELIVERY_GAME_ASSETS.filter((asset) => asset.endsWith('.webp')),
    ).toHaveLength(4)
    for (const asset of CURRENT_DELIVERY_GAME_ASSETS)
      expect(native.has(asset), `${asset} must remain native`).toBe(true)
    expect(NATIVE_SOURCE_NORMAL_GAME_ASSETS).toHaveLength(4)
    for (const asset of NATIVE_SOURCE_NORMAL_GAME_ASSETS)
      expect(
        native.has(asset),
        `${asset} is a production source, not native delivery`,
      ).toBe(false)
  })

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
    vi.stubEnv('GITHUB_REF', 'refs/heads/feat/native-diagnostics')
    stageGamesProfile(directory, 'ios', true)
    const generated = readFileSync(
      resolve(directory, 'ios/App/build/games/Info.plist'),
      'utf8',
    )
    expect(generated).toContain('<key>NSMicrophoneUsageDescription</key>')
    expect(generated).toContain(
      '<key>BesideCueGameDiagnosticsEnabled</key>\n\t<true/>',
    )
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

  it('keeps native diagnostics absent in store inputs and release-tag games profiles', () => {
    const directory = fixture()
    const canonical = readFileSync(resolve('ios/App/App/Info.plist'), 'utf8')
    expect(canonical).not.toContain('BesideCueGameDiagnosticsEnabled')
    expect(gamesInfoPlist(canonical)).not.toContain(
      'BesideCueGameDiagnosticsEnabled',
    )
    put(directory, 'ios/App/App/Info.plist', canonical)
    vi.stubEnv('GITHUB_REF', 'refs/tags/beside-cue-v1.0.0')
    vi.stubEnv('VITE_PORTABLE_CONSOLE', 'true')
    stageGamesProfile(directory, 'ios', true)
    expect(
      readFileSync(
        resolve(directory, 'ios/App/build/games/Info.plist'),
        'utf8',
      ),
    ).not.toContain('BesideCueGameDiagnosticsEnabled')
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

  it('prunes a prebuilt web preview without removing in-app game assets', () => {
    const directory = fixture()
    for (const asset of requiredGameAssets) put(directory, `dist/${asset}`)
    for (const asset of NATIVE_EXCLUDED_GAME_ASSETS)
      put(directory, `dist/${asset}`, 'web-only dressing')
    put(directory, 'dist/glass-game/index.html', '<main>Museum preview</main>')
    put(directory, 'dist/games/glass3d/glass.glb', 'cabinet game asset')
    put(directory, 'dist/games/future-v1/retained.bin', 'future source')
    put(
      directory,
      'dist/games/adventure-v2/textures/future-normal.png',
      'future normal',
    )

    stageGamesProfile(directory, 'android', false)

    expect(existsSync(resolve(directory, 'dist/glass-game'))).toBe(false)
    for (const asset of NATIVE_EXCLUDED_GAME_ASSETS)
      expect(existsSync(resolve(directory, 'dist', asset))).toBe(false)
    expect(
      readFileSync(resolve(directory, 'dist/games/glass3d/glass.glb'), 'utf8'),
    ).toBe('cabinet game asset')
    expect(
      readFileSync(
        resolve(directory, 'dist/games/future-v1/retained.bin'),
        'utf8',
      ),
    ).toBe('future source')
    expect(
      readFileSync(
        resolve(
          directory,
          'dist/games/adventure-v2/textures/future-normal.png',
        ),
        'utf8',
      ),
    ).toBe('future normal')
    for (const asset of CURRENT_DELIVERY_GAME_ASSETS)
      expect(readFileSync(resolve(directory, 'dist', asset), 'utf8')).toBe(
        'fixture',
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
    for (const asset of CURRENT_DELIVERY_GAME_ASSETS)
      put(directory, `dist/${asset}`, `${asset} delivery`)
    stageGamesProfile(directory, 'android', false)
    const nativePublic = resolve(
      directory,
      'android/app/src/main/assets/public',
    )
    cpSync(resolve(directory, 'dist'), nativePublic, { recursive: true })

    expect(() => verifySyncedGamesProfile(directory, 'android')).not.toThrow()
    const checksums = readFileSync(
      resolve(nativePublic, nativeGamesChecksumFile),
      'utf8',
    )
    for (const asset of NATIVE_SOURCE_NORMAL_GAME_ASSETS)
      expect(checksums).not.toContain(asset)
    for (const asset of CURRENT_DELIVERY_GAME_ASSETS) {
      expect(checksums).toContain(`  ${asset}\n`)
      expect(readFileSync(resolve(nativePublic, asset), 'utf8')).toBe(
        `${asset} delivery`,
      )
      put(nativePublic, asset, 'corrupt delivery')
      expect(() => verifySyncedGamesProfile(directory, 'android')).toThrow(
        `differs at ${asset}`,
      )
      put(nativePublic, asset, `${asset} delivery`)
    }
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
    expect(reusable).not.toContain('profile_args')
    expect(
      reusable.match(/run-with-optional-profile-argument\.sh/gu),
    ).toHaveLength(4)
    const releaseBuild = reusable
      .split('name: Build release bundle and APK')[1]
      ?.split('\n      - name:')[0]
    expect(releaseBuild).toContain('-Dorg.gradle.jvmargs=-Xmx3072m')
    expect(releaseBuild).toContain(
      'bundleRelease assembleRelease --no-daemon --stacktrace',
    )
    expect(reusable.match(/-Dorg\.gradle\.jvmargs=-Xmx3072m/gu)).toHaveLength(1)
    expect(reusable).toContain('Upload signed native testing APK')
    const apkUpload = reusable
      .split('name: Upload signed native testing APK')[1]
      ?.split('\n      - name:')[0]
    expect(apkUpload).toContain('android-native-testing-apk')
    expect(apkUpload).toContain('outputs/apk/release/app-release*.apk')
    expect(apkUpload).not.toContain('.aab')
    const bundleUpload = reusable
      .split('name: Upload signed native testing Play bundle')[1]
      ?.split('\n      - name:')[0]
    expect(bundleUpload).toContain('outputs/bundle/release/app-release*.aab')
    expect(bundleUpload).not.toContain('.apk')
    expect(reusable).toContain('steps.native-testing-apk.outputs.artifact-url')
    expect(reusable).toContain(
      "if: env.USE_NATIVE_TEST_PROFILE == 'true' && env.HAS_UPLOAD_KEY == 'true'",
    )
    expect(reusable).toContain(
      "UPLOAD: ${{ github.event_name != 'pull_request' && (inputs.testflight-upload-from == 'main-and-tags' || github.ref_type == 'tag') }}",
    )
  })

  it('omits an empty profile argument and inserts a populated one', () => {
    const directory = fixture()
    const recorder = resolve(directory, 'record-arguments.sh')
    writeFileSync(recorder, '#!/bin/sh\nprintf "<%s>\\n" "$@"\n')
    chmodSync(recorder, 0o755)

    const empty = spawnSync(
      '/bin/bash',
      [optionalProfileRunner, '', recorder, 'build', '--quiet'],
      { encoding: 'utf8' },
    )
    expect(empty.status, empty.stderr).toBe(0)
    expect(empty.stdout).toBe('<build>\n<--quiet>\n')

    const populated = spawnSync(
      '/bin/bash',
      [
        optionalProfileRunner,
        'BESIDE_CUE_INFO_PLIST_PATH=build/games/Info.plist',
        recorder,
        'build',
        '--quiet',
      ],
      { encoding: 'utf8' },
    )
    expect(populated.status, populated.stderr).toBe(0)
    expect(populated.stdout).toBe(
      '<BESIDE_CUE_INFO_PLIST_PATH=build/games/Info.plist>\n<build>\n<--quiet>\n',
    )
  })
})

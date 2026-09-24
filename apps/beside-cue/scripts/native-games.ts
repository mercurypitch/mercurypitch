// ============================================================
// Native games — explicitly pair the games web bundle with microphone access
// ============================================================

import { GLASS_GAME_REQUIRED_FILES } from '@irchiinnuss/glass-game/assets'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export type NativePlatform = 'android' | 'ios'
export interface NativeGamesOptions {
  platform: NativePlatform
  build: boolean
  assemble: boolean
  prepareOnly: boolean
}

export const requiredGameAssets = [
  'index.html',
  'models/swiftf0.onnx',
  'ort/ort-wasm-simd-threaded.mjs',
  'ort/ort-wasm-simd-threaded.wasm',
  ...GLASS_GAME_REQUIRED_FILES.map((asset) => `games/${asset}`),
] as const

export const nativeGamesChecksumFile = 'native-games-profile.sha256'

const gitLfsPointerHeader = 'version https://git-lfs.github.com/spec/v1'

interface GamesBundleDigest {
  indexSha256: string
  assetSha256: Readonly<Record<string, string>>
}

function gamesChecksumManifest(bundle: GamesBundleDigest): string {
  return `${requiredGameAssets
    .map((asset) => `${bundle.assetSha256[asset]}  ${asset}`)
    .join('\n')}\n`
}

export function parseOptions(args: string[]): NativeGamesOptions {
  const options: NativeGamesOptions = {
    platform: 'android',
    build: false,
    assemble: false,
    prepareOnly: false,
  }
  let selected = false
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--') continue
    if (arg === '--platform') {
      const platform = args[++i]
      if (platform !== 'android' && platform !== 'ios')
        throw new Error('--platform must be android or ios')
      options.platform = platform
      selected = true
    } else if (arg === '--build') options.build = true
    else if (arg === '--assemble') options.assemble = true
    else if (arg === '--prepare-only') options.prepareOnly = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  if (!selected) throw new Error('Choose --platform android or --platform ios')
  if (options.prepareOnly && (options.build || options.assemble))
    throw new Error('--prepare-only cannot build, sync, or assemble')
  if (options.assemble && options.platform !== 'android')
    throw new Error('--assemble is Android-only; use Xcode on macOS for iOS')
  return options
}

/** Add only the microphone purpose string to a copy of the canonical plist. */
export function gamesInfoPlist(canonical: string): string {
  if (canonical.includes('NSMicrophoneUsageDescription'))
    throw new Error(
      'Canonical store plist unexpectedly contains microphone access',
    )
  const rootEnd = canonical.lastIndexOf('</dict>')
  if (rootEnd < 0 || !/^\s*<\/plist>\s*$/u.test(canonical.slice(rootEnd + 7)))
    throw new Error('Expected an XML plist with a root dictionary')
  return `${canonical.slice(0, rootEnd)}\t<key>NSMicrophoneUsageDescription</key>\n\t<string>Use your voice to play the optional mini-games. Audio is processed on this device.</string>\n${canonical.slice(rootEnd)}`
}

/** Reject incomplete/store/LFS-pointer output before Capacitor can overwrite native assets. */
export function verifyGamesBundle(directory: string): GamesBundleDigest {
  const assetSha256: Record<string, string> = {}
  for (const asset of requiredGameAssets) {
    const target = resolve(directory, asset)
    if (
      !existsSync(target) ||
      !statSync(target).isFile() ||
      statSync(target).size === 0
    )
      throw new Error(
        `Games web bundle is missing ${asset}; build with VITE_BESIDE_CUE_GAMES=1 first`,
      )
    const contents = readFileSync(target)
    if (
      contents.subarray(0, gitLfsPointerHeader.length).toString('utf8') ===
      gitLfsPointerHeader
    )
      throw new Error(
        `Games web bundle contains a Git LFS pointer for ${asset}; hydrate runtime assets before building`,
      )
    assetSha256[asset] = createHash('sha256').update(contents).digest('hex')
  }
  return {
    indexSha256: assetSha256['index.html'] ?? '',
    assetSha256,
  }
}

export function stageGamesProfile(
  appDirectory: string,
  platform: NativePlatform,
  prepareOnly: boolean,
): void {
  // Validate the web bundle before producing any sync marker or generated plist.
  const output = resolve(appDirectory, 'dist')
  const bundle = prepareOnly ? undefined : verifyGamesBundle(output)
  if (platform === 'ios') {
    const target = resolve(appDirectory, 'ios/App/build/games/Info.plist')
    const source = readFileSync(
      resolve(appDirectory, 'ios/App/App/Info.plist'),
      'utf8',
    )
    const plist = gamesInfoPlist(source)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, plist)
  }
  if (bundle !== undefined) {
    const checksums = gamesChecksumManifest(bundle)
    writeFileSync(resolve(output, nativeGamesChecksumFile), checksums)
    writeFileSync(
      resolve(output, 'native-games-profile.json'),
      `${JSON.stringify(
        {
          schema: 3,
          profile: 'games',
          platform,
          indexSha256: bundle?.indexSha256,
          assetSha256: bundle?.assetSha256,
          checksumSha256: createHash('sha256').update(checksums).digest('hex'),
          assets: requiredGameAssets,
        },
        null,
        2,
      )}\n`,
    )
  }
}

/** Prove Capacitor copied the complete, matching offline profile. */
export function verifySyncedGamesProfile(
  appDirectory: string,
  platform: NativePlatform,
): void {
  const output =
    platform === 'android'
      ? resolve(appDirectory, 'android/app/src/main/assets/public')
      : resolve(appDirectory, 'ios/App/App/public')
  const markerPath = resolve(output, 'native-games-profile.json')
  if (!existsSync(markerPath))
    throw new Error(`Synced ${platform} games profile is missing its marker`)
  const marker = JSON.parse(readFileSync(markerPath, 'utf8')) as {
    schema?: number
    profile?: string
    platform?: string
    indexSha256?: string
    assetSha256?: unknown
    checksumSha256?: string
    assets?: unknown
  }
  if (
    marker.schema !== 3 ||
    marker.profile !== 'games' ||
    marker.platform !== platform ||
    !Array.isArray(marker.assets) ||
    marker.assets.length !== requiredGameAssets.length ||
    marker.assets.some((asset, index) => asset !== requiredGameAssets[index]) ||
    typeof marker.assetSha256 !== 'object' ||
    marker.assetSha256 === null ||
    Array.isArray(marker.assetSha256) ||
    Object.keys(marker.assetSha256).length !== requiredGameAssets.length
  )
    throw new Error(
      `Synced ${platform} games profile does not match its bundle`,
    )

  const stampedSha256 = marker.assetSha256 as Record<string, unknown>
  const source = verifyGamesBundle(resolve(appDirectory, 'dist'))
  const synced = verifyGamesBundle(output)
  const sourceChecksums = gamesChecksumManifest(source)
  const checksumPath = resolve(appDirectory, 'dist', nativeGamesChecksumFile)
  const syncedChecksumPath = resolve(output, nativeGamesChecksumFile)
  if (
    !existsSync(checksumPath) ||
    readFileSync(checksumPath, 'utf8') !== sourceChecksums ||
    marker.checksumSha256 !==
      createHash('sha256').update(sourceChecksums).digest('hex')
  )
    throw new Error('Source games profile checksum manifest does not match')
  if (
    !existsSync(syncedChecksumPath) ||
    readFileSync(syncedChecksumPath, 'utf8') !== sourceChecksums
  )
    throw new Error(`Synced ${platform} games checksum manifest differs`)
  for (const asset of requiredGameAssets) {
    if (
      typeof stampedSha256[asset] !== 'string' ||
      stampedSha256[asset] !== source.assetSha256[asset]
    )
      throw new Error(`Source games profile changed at ${asset} after stamping`)
    if (synced.assetSha256[asset] !== source.assetSha256[asset])
      throw new Error(`Synced ${platform} games profile differs at ${asset}`)
  }
  if (
    marker.indexSha256 !== source.indexSha256 ||
    marker.indexSha256 !== synced.indexSha256
  )
    throw new Error(
      `Synced ${platform} games profile does not match its bundle`,
    )
}

function run(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeout: number,
): void {
  const result = spawnSync(command, args, {
    cwd,
    env,
    timeout,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(
      `${command} ${args.join(' ')} failed (${result.signal ?? result.status})`,
    )
}

export function main(args: string[]): void {
  if (args.includes('--help')) {
    console.log(`Explicit native games profile (default native/store builds stay games-off).
  pnpm native:games --platform android --prepare-only
  pnpm native:games --platform ios --prepare-only
  pnpm native:games --platform android [--build] [--assemble]
  pnpm native:games --platform ios [--build]
Without --build, verifies and consumes the existing games-enabled dist.
--prepare-only never builds, stamps dist, syncs Capacitor, or packages an app.
--assemble makes a local debug APK only; it never uploads or release-signs.
Android needs JDK 21 and ANDROID_HOME. iOS packaging requires macOS/Xcode.`)
    return
  }
  const options = parseOptions(args)
  const appDirectory = fileURLToPath(new URL('../', import.meta.url))
  const env = {
    ...process.env,
    VITE_BESIDE_CUE_GAMES: '1',
    VITE_BESIDE_CUE_NATIVE_PLATFORM: options.platform,
  }
  if (options.build)
    run('pnpm', ['exec', 'vite', 'build'], appDirectory, env, 240_000)
  stageGamesProfile(appDirectory, options.platform, options.prepareOnly)
  if (!options.prepareOnly)
    run(
      'pnpm',
      ['exec', 'cap', 'sync', options.platform],
      appDirectory,
      env,
      180_000,
    )
  if (!options.prepareOnly)
    verifySyncedGamesProfile(appDirectory, options.platform)
  if (options.assemble)
    run(
      './gradlew',
      ['-PbesideCueGames=1', ':app:assembleDebug', '--no-daemon'],
      resolve(appDirectory, 'android'),
      env,
      600_000,
    )
  if (options.platform === 'ios') {
    console.log(
      'Generated ios/App/build/games/Info.plist; canonical store plist is unchanged.',
    )
    console.log('After sync, run from ios/App on macOS:')
    console.log(
      'xcodebuild -project App.xcodeproj -scheme App -configuration Debug BESIDE_CUE_INFO_PLIST_PATH=build/games/Info.plist build',
    )
  } else {
    console.log(
      'Android games profile: ./gradlew -PbesideCueGames=1 :app:assembleDebug --no-daemon',
    )
    if (options.prepareOnly)
      console.log('No web build, Capacitor sync, or APK packaging was run.')
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

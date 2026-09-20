// ============================================================
// Native games — explicitly pair the games web bundle with microphone access
// ============================================================

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
  'games/glass3d/merc.glb',
  'games/adventure/manifest.json',
  'games/adventure/platform-kit.glb',
  'games/adventure/vessels.glb',
  'games/adventure/legend-slab.glb',
  'games/adventure/floor-marble.webp',
  'games/adventure/legend-johnny-cash.webp',
  'games/adventure/museum-sky.webp',
  'games/adventure-v2/manifest.json',
  'games/adventure-v2/platform-kit.glb',
  'games/adventure-v2/garden-kit.glb',
  'games/adventure-v2/vessels.glb',
  'games/adventure-v2/environment/golden-coast.hdr',
  ...[
    'warm-carrara',
    'verde-marble',
    'cream-limestone',
    'brushed-brass',
  ].flatMap((material) =>
    ['basecolor', 'normal', 'roughness'].map(
      (channel) => `games/adventure-v2/textures/${material}-${channel}.png`,
    ),
  ),
  'games/adventure-v3/manifest.json',
  'games/adventure-v3/fluted-carafe.glb',
  'games/adventure-v3/moon-amphora.glb',
  'games/adventure-v3/aurora-coupe.glb',
  'games/adventure-v3/cut-crystal-decanter.glb',
  'games/adventure-v3/gilded-column.glb',
  'games/adventure-v3/garden-arcade.glb',
  'games/adventure-v3/observatory-canopy.glb',
  'games/adventure-audio-v1/m01-loop.mp3',
  'games/adventure-audio-v1/m03-loop.mp3',
  'games/adventure-audio-v1/a01-loop.mp3',
  'games/adventure-audio-v1/a02-loop.mp3',
  'games/adventure-audio-v1/a03-loop.mp3',
  'games/adventure-voice-v1/manifest.json',
  'games/adventure-voice-v1/merc-d2-welcome.mp3',
  'games/adventure-voice-v1/merc-d2-path-open.mp3',
  'games/adventure-voice-v1/merc-d2-optional-break.mp3',
] as const

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

/** Reject incomplete/store output before Capacitor can overwrite native assets. */
export function verifyGamesBundle(directory: string): string {
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
  }
  return createHash('sha256')
    .update(readFileSync(resolve(directory, 'index.html')))
    .digest('hex')
}

export function stageGamesProfile(
  appDirectory: string,
  platform: NativePlatform,
  prepareOnly: boolean,
): void {
  // Validate the web bundle before producing any sync marker or generated plist.
  const output = resolve(appDirectory, 'dist')
  const indexSha256 = prepareOnly ? undefined : verifyGamesBundle(output)
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
  if (!prepareOnly) {
    writeFileSync(
      resolve(output, 'native-games-profile.json'),
      `${JSON.stringify({ schema: 1, profile: 'games', platform, indexSha256 }, null, 2)}\n`,
    )
  }
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

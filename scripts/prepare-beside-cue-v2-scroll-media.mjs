/**
 * Prepare the normalized V2 Scroll entrance/exit media from locked Omni sources.
 *
 * The source hashes are part of the contract: a visually similar regeneration is
 * not an interchangeable input. This script keys the saturated-magenta plate,
 * removes its magenta spill/shadow, registers the character over P02 on the
 * foreground floor plane, adds an alpha-following contact shadow, creates one
 * shared P03 endpoint, and builds fixed 96-frame silent delivery clips.
 */

import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const EXPECTED_HASHES = {
  present: 'b08cc31e98a1ceaf2eba7135c458d540719fce97a6ca7c40c6130752c3f0c2c2',
  recede: '995bd8354cbc085bd33396a2ec7c07617586dbc94880eb06ce94c67c6567964a',
  base: 'e259a2225b78b1a4883b92da5d0fb061a64fcdfdbbd4c80fb26950d4043d2546',
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const appDirectory = resolve(scriptDirectory, '../apps/beside-cue')
const defaultOutputDirectory = join(
  appDirectory,
  'public/onboarding/corky-v2-preview/scrolling',
)
const defaultProofDirectory = join(
  appDirectory,
  'media-source/onboarding/corky-v2-preview/scrolling',
)

const runtimeOutputNames = {
  present: 'b03-scrolling-present-v0_1.mp4',
  recede: 'b05-scrolling-recede-v0_1.mp4',
  p02: 'p02-table-ready-v0_1.webp',
  p03: 'p03-scrolling-settled-v0_1.webp',
}

const proofOutputNames = {
  contactSheet: 'qa-contact-sheet-present-top-recede-bottom-v0_1.webp',
}

const allOutputNames = { ...runtimeOutputNames, ...proofOutputNames }

// Match the accepted V1 staging relationship: Scroll crosses in front of the
// player on the shared floor plane, rather than floating in the quiet copy bay
// behind the scene. P02's Corky is smaller than V1's, so this preserves V1's
// relative Scroll/Corky scale while putting Scroll's feet in the foreground.
const scrollRegistration = {
  width: 452,
  height: 804,
  x: 14,
  y: 396,
}

const scrollShadow = {
  height: 32,
  y: 953,
}

const expectedP03DifferenceGeometry = '186x320+147+657'

function usage() {
  return [
    'Usage:',
    '  node scripts/prepare-beside-cue-v2-scroll-media.mjs \\',
    '    --present /absolute/path/to/approved-omni-present.mp4 \\',
    '    --recede /absolute/path/to/approved-omni-recede.mp4 \\',
    '    --base /absolute/path/to/p02-table-ready.png \\',
    '    [--output-dir /absolute/or/repo-relative/public-path] \\',
    '    [--proof-dir /absolute/or/repo-relative/non-public-path]',
  ].join('\n')
}

function parseArguments(argv) {
  const parsed = {}

  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]
    const value = argv[index + 1]

    if (!flag?.startsWith('--') || value === undefined) {
      throw new Error(usage())
    }

    parsed[flag.slice(2)] = value
  }

  for (const required of ['present', 'recede', 'base']) {
    if (!parsed[required]) {
      throw new Error(`Missing --${required}.\n\n${usage()}`)
    }
  }

  return {
    present: resolve(parsed.present),
    recede: resolve(parsed.recede),
    base: resolve(parsed.base),
    outputDirectory: resolve(parsed['output-dir'] ?? defaultOutputDirectory),
    proofDirectory: resolve(parsed['proof-dir'] ?? defaultProofDirectory),
  }
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function assertLockedSource(name, path) {
  const actualHash = sha256(path)
  const expectedHash = EXPECTED_HASHES[name]

  if (actualHash !== expectedHash) {
    throw new Error(
      `${name} source hash mismatch:\n  expected ${expectedHash}\n  actual   ${actualHash}\n  path     ${path}`,
    )
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  if (result.status !== 0) {
    throw new Error(
      [
        `${command} failed with status ${result.status}.`,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join('\n'),
    )
  }
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  if (result.status !== 0) {
    throw new Error(
      [
        `${command} failed with status ${result.status}.`,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join('\n'),
    )
  }

  return result.stdout.trim()
}

function ffmpeg(args) {
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args])
}

// The matte is based on chroma geometry rather than brightness. Magenta has
// both red and blue above green, while Scroll's cyan body and neutral face do
// not. This also removes darker generated magenta shadows that a simple
// single-color key leaves behind.
const normalizedScrollFilter = [
  'format=rgba',
  [
    "geq=r='r(X,Y)'",
    "g='g(X,Y)'",
    "b='b(X,Y)'",
    "a='clip((25-(min(r(X,Y),b(X,Y))-g(X,Y)))*5.6667,0,255)'",
  ].join(':'),
  `scale=${scrollRegistration.width}:${scrollRegistration.height}:flags=lanczos`,
].join(',')

const registeredScrollOverlay = `overlay=x=${scrollRegistration.x}:y=${scrollRegistration.y}`

const registeredShadowFilter = [
  `scale=${scrollRegistration.width}:${scrollShadow.height}:flags=lanczos`,
  'boxblur=6:2',
  'colorchannelmixer=rr=0:gg=0:bb=0:aa=0.16',
].join(',')

const registeredShadowOverlay = `overlay=x=${scrollRegistration.x}:y=${scrollShadow.y}`

const deliveryEncoding = [
  '-an',
  '-c:v',
  'libx264',
  '-preset',
  'slow',
  '-crf',
  '16',
  '-profile:v',
  'high',
  '-level:v',
  '3.1',
  '-pix_fmt',
  'yuv420p',
  '-r',
  '24',
  '-fps_mode',
  'cfr',
  '-frames:v',
  '96',
  '-g',
  '48',
  '-keyint_min',
  '48',
  '-sc_threshold',
  '0',
  '-threads',
  '1',
  '-x264-params',
  'colorprim=bt709:transfer=bt709:colormatrix=bt709',
  '-color_primaries',
  'bt709',
  '-color_trc',
  'bt709',
  '-colorspace',
  'bt709',
  '-movflags',
  '+faststart',
  '-map_metadata',
  '-1',
]

const paths = parseArguments(process.argv.slice(2))
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'beside-cue-v2-scroll-'))

try {
  assertLockedSource('present', paths.present)
  assertLockedSource('recede', paths.recede)
  assertLockedSource('base', paths.base)

  mkdirSync(paths.outputDirectory, { recursive: true })
  mkdirSync(paths.proofDirectory, { recursive: true })

  const temporary = Object.fromEntries(
    Object.entries(allOutputNames).map(([name, filename]) => [
      name,
      join(temporaryDirectory, filename),
    ]),
  )

  ffmpeg([
    '-i',
    paths.base,
    '-vf',
    'scale=720:1280:flags=lanczos,format=rgb24',
    '-frames:v',
    '1',
    '-c:v',
    'libwebp',
    '-lossless',
    '1',
    '-compression_level',
    '6',
    '-map_metadata',
    '-1',
    '-y',
    temporary.p02,
  ])

  // P03 is derived from frame 72 of the approved Present source. Every later
  // still/video handle consumes this exact normalized endpoint.
  ffmpeg([
    '-i',
    temporary.p02,
    '-i',
    paths.present,
    '-filter_complex',
    [
      '[0:v]format=rgba[base]',
      `[1:v]trim=start_frame=72:end_frame=73,setpts=PTS-STARTPTS,${normalizedScrollFilter},split=2[scroll][shadow_source]`,
      `[shadow_source]${registeredShadowFilter}[shadow]`,
      `[base][shadow]${registeredShadowOverlay}:format=auto[grounded_base]`,
      `[grounded_base][scroll]${registeredScrollOverlay}:format=auto,format=rgb24[out]`,
    ].join(';'),
    '-map',
    '[out]',
    '-frames:v',
    '1',
    '-c:v',
    'libwebp',
    '-lossless',
    '1',
    '-compression_level',
    '6',
    '-map_metadata',
    '-1',
    '-y',
    temporary.p03,
  ])

  const p03DifferenceGeometry = capture('magick', [
    temporary.p02,
    temporary.p03,
    '-compose',
    'difference',
    '-composite',
    '-threshold',
    '5%',
    '-trim',
    '-format',
    '%wx%h%O',
    'info:',
  ])

  if (p03DifferenceGeometry !== expectedP03DifferenceGeometry) {
    throw new Error(
      `P03 foreground registration drifted: expected ${expectedP03DifferenceGeometry}, got ${p03DifferenceGeometry}.`,
    )
  }

  const presentFilter = [
    '[0:v]loop=loop=-1:size=1:start=0,split=2[p02_hold_source][p02_motion_source]',
    '[p02_hold_source]trim=end_frame=12,setpts=N/(24*TB),format=rgb24[p02_hold]',
    '[p02_motion_source]trim=end_frame=60,setpts=N/(24*TB),format=rgba[p02_motion]',
    '[1:v]loop=loop=-1:size=1:start=0,trim=end_frame=24,setpts=N/(24*TB),format=rgb24[p03_hold]',
    `[2:v]trim=start_frame=0:end_frame=73,setpts=(PTS-STARTPTS)*59/72,fps=fps=24:round=near:start_time=0,trim=end_frame=60,setpts=N/(24*TB),${normalizedScrollFilter},split=2[scroll][shadow_source]`,
    `[shadow_source]${registeredShadowFilter}[shadow]`,
    `[p02_motion][shadow]${registeredShadowOverlay}:shortest=1:format=auto[grounded_motion]`,
    `[grounded_motion][scroll]${registeredScrollOverlay}:shortest=1:format=auto,trim=end_frame=60,setpts=N/(24*TB),format=rgb24[motion]`,
    '[p02_hold][motion][p03_hold]concat=n=3:v=1:a=0,trim=end_frame=96,setpts=N/(24*TB),format=yuv420p[out]',
  ].join(';')

  ffmpeg([
    '-i',
    temporary.p02,
    '-i',
    temporary.p03,
    '-i',
    paths.present,
    '-filter_complex',
    presentFilter,
    '-map',
    '[out]',
    ...deliveryEncoding,
    '-y',
    temporary.present,
  ])

  const recedeFilter = [
    '[0:v]loop=loop=-1:size=1:start=0,split=2[p02_motion_source][p02_hold_source]',
    '[p02_motion_source]trim=end_frame=34,setpts=N/(24*TB),format=rgba[p02_motion]',
    '[p02_hold_source]trim=end_frame=54,setpts=N/(24*TB),format=rgb24[p02_hold]',
    '[1:v]loop=loop=-1:size=1:start=0,split=2[p03_hold_source][p03_blend_source]',
    '[p03_hold_source]trim=end_frame=8,setpts=N/(24*TB),format=rgb24[p03_hold]',
    '[p03_blend_source]trim=end_frame=34,setpts=N/(24*TB),format=rgb24[p03_blend]',
    `[2:v]trim=start_frame=0:end_frame=48,setpts=(PTS-STARTPTS)*33/47,fps=fps=24:round=near:start_time=0,trim=end_frame=34,setpts=N/(24*TB),${normalizedScrollFilter},split=2[scroll][shadow_source]`,
    `[shadow_source]${registeredShadowFilter}[shadow]`,
    `[p02_motion][shadow]${registeredShadowOverlay}:shortest=1:format=auto[grounded_motion]`,
    `[grounded_motion][scroll]${registeredScrollOverlay}:shortest=1:format=auto,trim=end_frame=34,setpts=N/(24*TB),format=rgb24[raw_motion]`,
    "[p03_blend][raw_motion]blend=all_expr='if(lte(N,0),A,if(gte(N,3),B,A*(3-N)/3+B*N/3))':shortest=1,trim=end_frame=34,setpts=N/(24*TB),format=rgb24[motion]",
    '[p03_hold][motion][p02_hold]concat=n=3:v=1:a=0,trim=end_frame=96,setpts=N/(24*TB),format=yuv420p[out]',
  ].join(';')

  ffmpeg([
    '-i',
    temporary.p02,
    '-i',
    temporary.p03,
    '-i',
    paths.recede,
    '-filter_complex',
    recedeFilter,
    '-map',
    '[out]',
    ...deliveryEncoding,
    '-y',
    temporary.recede,
  ])

  ffmpeg([
    '-i',
    temporary.present,
    '-i',
    temporary.recede,
    '-filter_complex',
    [
      "[0:v]select='eq(n,0)+eq(n,24)+eq(n,48)+eq(n,72)',scale=180:320:flags=lanczos,tile=4x1:nb_frames=4[present]",
      "[1:v]select='eq(n,0)+eq(n,16)+eq(n,32)+eq(n,42)',scale=180:320:flags=lanczos,tile=4x1:nb_frames=4[recede]",
      '[present][recede]vstack=inputs=2,format=rgb24[out]',
    ].join(';'),
    '-map',
    '[out]',
    '-frames:v',
    '1',
    '-c:v',
    'libwebp',
    '-quality',
    '86',
    '-compression_level',
    '6',
    '-map_metadata',
    '-1',
    '-y',
    temporary.contactSheet,
  ])

  for (const [name, filename] of Object.entries(runtimeOutputNames)) {
    copyFileSync(temporary[name], join(paths.outputDirectory, filename))
  }

  for (const [name, filename] of Object.entries(proofOutputNames)) {
    copyFileSync(temporary[name], join(paths.proofDirectory, filename))
  }

  process.stdout.write(
    `${[
      ...Object.values(runtimeOutputNames).map((filename) =>
        join(paths.outputDirectory, filename),
      ),
      ...Object.values(proofOutputNames).map((filename) =>
        join(paths.proofDirectory, filename),
      ),
    ].join('\n')}\n`,
  )
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true })
}

// ============================================================
// Prepare founder-selected additive V2.5 onboarding picture for Beside Cue
// ============================================================

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_FILES = Object.freeze({
  greeting: Object.freeze({
    file: 'onboarding-video-edit-v2_5/assets/picture/b01-corky-greeting-direct-to-p02-v0_1.mp4',
    sha256: '6d80b681230551f2ec136645110fe4ab456bb94680aa235187c78448a18af70e',
    frames: 147,
    audioStreams: 0,
    requiresBt709: true,
  }),
  recordStart: Object.freeze({
    file: 'generated_video_outs/gemini/h06-google-flow-omni-flash-v0_1-silent.mp4',
    sha256: '4b5a609ed0f7d8a37e64ce7321a79f0705fe056cb815a931669b2c4bd0efa6bd',
    frames: 96,
    audioStreams: 0,
    requiresBt709: false,
  }),
  recordSpin: Object.freeze({
    file: 'generated_video_outs/gemini/b06-whole-vinyl-rigid-spin-google-flow-omni-1_1-flash-frames-raw-v0_1.mp4',
    sha256: '416efb3d048ba55c3af13054a4e4c873c82a9718c35e185e98c0679e1b1bf368',
    frames: 96,
    audioStreams: 1,
    requiresBt709: false,
  }),
})

const OUTPUT_NAMES = Object.freeze({
  greeting: 'picture/b01-corky-greeting-direct-to-p02-v0_1.mp4',
  recordStart: 'picture/b06-corky-starts-record-v0_1.mp4',
  recordSpin: 'picture/b06-whole-vinyl-spin-v0_1.mp4',
})

const VIDEO_ENCODING = Object.freeze([
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
])

const BT709_FRAME_TAGS =
  'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryDirectory = resolve(scriptDirectory, '..')
const appDirectory = join(repositoryDirectory, 'apps/beside-cue')
const defaultOutputDirectory = join(
  appDirectory,
  'public/onboarding/corky-v2.5',
)
const defaultProofDirectory = join(
  appDirectory,
  'media-source/onboarding/corky-v2.5',
)

function usage() {
  return [
    'Usage:',
    '  node scripts/prepare-beside-cue-v2-5-media.mjs \\',
    '    --b01-source /absolute/path/to/b01-corky-greeting-direct-to-p02-v0_1.mp4 \\',
    '    --h06-source /absolute/path/to/h06-google-flow-omni-flash-v0_1-silent.mp4 \\',
    '    --spin-source /absolute/path/to/b06-whole-vinyl-rigid-spin-google-flow-omni-1_1-flash-frames-raw-v0_1.mp4 \\',
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

  if (
    !parsed['b01-source'] ||
    !parsed['h06-source'] ||
    !parsed['spin-source']
  ) {
    throw new Error(usage())
  }

  return {
    sources: Object.freeze({
      greeting: resolve(parsed['b01-source']),
      recordStart: resolve(parsed['h06-source']),
      recordSpin: resolve(parsed['spin-source']),
    }),
    outputDirectory: resolve(parsed['output-dir'] ?? defaultOutputDirectory),
    proofDirectory: resolve(parsed['proof-dir'] ?? defaultProofDirectory),
  }
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) {
    throw new Error(
      [
        `${command} failed with status ${String(result.status)}.`,
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

function assertHash(label, path, expected) {
  const actual = sha256(path)
  if (actual !== expected) {
    throw new Error(
      `${label} hash mismatch: expected ${expected}, got ${actual}: ${path}`,
    )
  }
}

function readVideoProbe(path) {
  return JSON.parse(
    run('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'stream=codec_type,codec_name,profile,level,width,height,pix_fmt,r_frame_rate,avg_frame_rate,nb_frames,color_primaries,color_transfer,color_space',
      '-of',
      'json',
      path,
    ]),
  )
}

function assertSourceVideo(path, source) {
  const payload = readVideoProbe(path)
  const streams = payload.streams ?? []
  const videos = streams.filter((stream) => stream.codec_type === 'video')
  const audio = streams.filter((stream) => stream.codec_type === 'audio')
  const video = videos[0]
  const colorMatches =
    !source.requiresBt709 ||
    (video?.color_primaries === 'bt709' &&
      video.color_transfer === 'bt709' &&
      video.color_space === 'bt709')

  if (
    streams.length !== 1 + source.audioStreams ||
    videos.length !== 1 ||
    audio.length !== source.audioStreams ||
    video?.codec_name !== 'h264' ||
    video.width !== 720 ||
    video.height !== 1280 ||
    video.pix_fmt !== 'yuv420p' ||
    video.r_frame_rate !== '24/1' ||
    video.avg_frame_rate !== '24/1' ||
    Number(video.nb_frames) !== source.frames ||
    !colorMatches
  ) {
    throw new Error(
      `Source video contract failed: ${path}: ${JSON.stringify(payload)}`,
    )
  }
}

function assertDeliveryVideo(path, expectedFrames) {
  const payload = readVideoProbe(path)
  const streams = payload.streams ?? []
  const videos = streams.filter((stream) => stream.codec_type === 'video')
  const audio = streams.filter((stream) => stream.codec_type === 'audio')
  const video = videos[0]

  if (
    streams.length !== 1 ||
    videos.length !== 1 ||
    audio.length !== 0 ||
    video?.codec_name !== 'h264' ||
    video.profile !== 'High' ||
    video.level !== 31 ||
    video.width !== 720 ||
    video.height !== 1280 ||
    video.pix_fmt !== 'yuv420p' ||
    video.r_frame_rate !== '24/1' ||
    video.avg_frame_rate !== '24/1' ||
    Number(video.nb_frames) !== expectedFrames ||
    video.color_primaries !== 'bt709' ||
    video.color_transfer !== 'bt709' ||
    video.color_space !== 'bt709'
  ) {
    throw new Error(
      `Delivery video contract failed: ${path}: ${JSON.stringify(payload)}`,
    )
  }
}

function prepareGeneratedClip(source, expectedFrames, destination) {
  ffmpeg([
    '-i',
    source,
    '-map',
    '0:v:0',
    '-vf',
    `scale=720:1280:flags=lanczos,format=yuv420p,${BT709_FRAME_TAGS}`,
    '-frames:v',
    String(expectedFrames),
    ...VIDEO_ENCODING,
    '-y',
    destination,
  ])
}

function installFileAtomically(source, destination) {
  mkdirSync(dirname(destination), { recursive: true })
  const staged = `${destination}.staging`
  copyFileSync(source, staged)
  renameSync(staged, destination)
}

const paths = parseArguments(process.argv.slice(2))
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'beside-cue-v2-5-'))

try {
  for (const [key, source] of Object.entries(SOURCE_FILES)) {
    const sourceFile = paths.sources[key]
    assertHash(key, sourceFile, source.sha256)
    assertSourceVideo(sourceFile, source)
  }

  const temporary = Object.fromEntries(
    Object.entries(OUTPUT_NAMES).map(([key, name]) => [
      key,
      join(temporaryDirectory, name),
    ]),
  )
  for (const path of Object.values(temporary)) {
    mkdirSync(dirname(path), { recursive: true })
  }

  copyFileSync(paths.sources.greeting, temporary.greeting)
  prepareGeneratedClip(
    paths.sources.recordStart,
    SOURCE_FILES.recordStart.frames,
    temporary.recordStart,
  )
  prepareGeneratedClip(
    paths.sources.recordSpin,
    SOURCE_FILES.recordSpin.frames,
    temporary.recordSpin,
  )

  for (const [key, source] of Object.entries(SOURCE_FILES)) {
    assertDeliveryVideo(temporary[key], source.frames)
  }

  const outputRecords = Object.entries(OUTPUT_NAMES)
    .map(([key, path]) => ({
      path,
      sha256: sha256(temporary[key]),
      bytes: statSync(temporary[key]).size,
    }))
    .sort((left, right) => left.path.localeCompare(right.path))
  const inventory = outputRecords
    .map(({ path, sha256: digest }) => `${digest}  ${path}`)
    .join('\n')
  const temporaryInventory = join(temporaryDirectory, 'SHA256SUMS')
  writeFileSync(temporaryInventory, `${inventory}\n`, 'utf8')

  const contract = {
    schemaVersion: 1,
    generatedBy: 'scripts/prepare-beside-cue-v2-5-media.mjs',
    authorization:
      'Founder-selected additive V2.5 onboarding picture; test-device review remains required before release.',
    source: Object.fromEntries(
      Object.entries(SOURCE_FILES).map(([key, source]) => [
        key,
        {
          file: source.file,
          sha256: source.sha256,
          frames: source.frames,
          audioStreams: source.audioStreams,
        },
      ]),
    ),
    delivery: {
      greeting:
        'Bit-for-bit copy of the validated silent H.264 720x1280, 24fps CFR, 147-frame, BT.709 V2.5 edit.',
      generatedPicture:
        'H.264 High 3.1, yuv420p, 720x1280, 24fps CFR, CRF16, GOP48, BT.709, silent, faststart; one encoding thread.',
    },
    outputRecords,
  }
  const temporaryContract = join(temporaryDirectory, 'BUILD-CONTRACT.json')
  writeFileSync(
    temporaryContract,
    `${JSON.stringify(contract, null, 2)}\n`,
    'utf8',
  )

  for (const [key, name] of Object.entries(OUTPUT_NAMES)) {
    installFileAtomically(temporary[key], join(paths.outputDirectory, name))
  }
  installFileAtomically(
    temporaryInventory,
    join(paths.outputDirectory, 'SHA256SUMS'),
  )
  installFileAtomically(
    temporaryContract,
    join(paths.proofDirectory, 'BUILD-CONTRACT.json'),
  )

  console.log('V2_5_APP_MEDIA_PREPARE_PASS')
  console.log(`SHA256SUMS ${sha256(temporaryInventory)}`)
  console.log(`BUILD-CONTRACT.json ${sha256(temporaryContract)}`)
  for (const record of outputRecords) {
    console.log(`${record.sha256}  ${record.path}`)
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true })
}

// ============================================================
// Prepare founder-approved V2.4 onboarding media for the product build
// ============================================================

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_INVENTORY_SHA256 =
  '1ab7fafe5bafaaf0391dfe82e0842f9022bae236569beef2d89a16021cdfa4d3'

const CORKY_GREETING_SOURCE = Object.freeze({
  file: 'kling_iamcorky_initial.mp4',
  sha256: '3c10241e1090baac039d87c6713b0f79cb42e692c06960aae71e0bc5e6966e1f',
  frames: 121,
})

const SOURCE_FILES = Object.freeze({
  p00: {
    path: 'assets/diagnostics/plates/p00-set-empty-candidate-v0_1.png',
    sha256: '6b098656abe13f6675282b8f3ef94f8f85704e505d8efa5367928212783b7f8b',
  },
  p01: {
    path: 'assets/diagnostics/plates/p01-corky-rest-candidate-v0_4.png',
    sha256: 'c38d8b8411f88a3df2d3c5f2d6468bd44d385f3773a9ca51a63c713007036a43',
  },
  p02: {
    path: 'assets/diagnostics/plates/p02-table-ready-candidate-v0_17.png',
    sha256: '800a76049ad152224ead6591eaf1d8acdff3a7db9c308f7ec8f92102ce5c57c3',
  },
  introB02: {
    path: 'assets/diagnostics/transitions/b02-table-reveal-diagnostic-v0_1.mkv',
    sha256: '678e48b4ff277162e52ba0f766c8c565b1dc32e6670979af165fec8167ff0075',
  },
  scrollingPresentShadow: {
    path: 'assets/diagnostics/layers/scroll-present-shadow-alpha-v0_1.mkv',
    sha256: 'ab6a37cd6d4e7827fa0bf9269c224dc7c7f30eca24f65fdc38d4622134882465',
  },
  scrollingPresentForeground: {
    path: 'assets/diagnostics/layers/scroll-present-foreground-alpha-v0_1.mkv',
    sha256: '071ac7a081275693c2f19106c19fc763f1ac4f58717f0e3b48b76e40206c4e5d',
  },
  scrollingRecedeShadow: {
    path: 'assets/diagnostics/layers/scroll-recede-shadow-alpha-v0_1.mkv',
    sha256: 'b7e3e99a7b66a1bf75bac09bcde6796590851cce89f9cf0c1b65fb753740d260',
  },
  scrollingRecedeForeground: {
    path: 'assets/diagnostics/layers/scroll-recede-foreground-alpha-v0_1.mkv',
    sha256: '93c8ddce3c6a7e709c9c98455dc2c29572c7ba77677c55c5e936e456faf3e0d3',
  },
  snackingPresentShadow: {
    path: 'assets/diagnostics/layers/pulls/snacking/b03-snacking-present-shadow-alpha-v0_3.mkv',
    sha256: 'f43ae621261afbf459a9ae1abd5d9c98e0a56e141364c0de2ef554ded97a8d51',
  },
  snackingPresentForeground: {
    path: 'assets/diagnostics/layers/pulls/snacking/b03-snacking-present-foreground-alpha-v0_3.mkv',
    sha256: '4a737c2c97d68fd607f3062ea461836a8c4a2420adbb802f1b3aafd8bbe15d46',
  },
  snackingRecedeShadow: {
    path: 'assets/diagnostics/layers/pulls/snacking/b05-snacking-recede-shadow-alpha-v0_4.mkv',
    sha256: '711b0ed3ffa6e00108fc21ebacb49e10294dd7614ac6bd104e59b05af7f21c84',
  },
  snackingRecedeForeground: {
    path: 'assets/diagnostics/layers/pulls/snacking/b05-snacking-recede-foreground-alpha-v0_4.mkv',
    sha256: 'c00de736fd600f91874271b404aa469814ccf00d1f6be6589468ca6508125653',
  },
  avoidancePresentShadow: {
    path: 'assets/diagnostics/layers/pulls/avoidance/b03-avoidance-present-shadow-alpha-v0_1.mkv',
    sha256: 'a123675056e5177591b63fdd49b0d75db7dbfad057abd4ea1d3e34615374321c',
  },
  avoidancePresentForeground: {
    path: 'assets/diagnostics/layers/pulls/avoidance/b03-avoidance-present-foreground-alpha-v0_1.mkv',
    sha256: '74891bbd1cfa3ecd5a9451c9d6a5dce3c03403b1d40ac9e7645330c1656de9e8',
  },
  avoidanceRecedeShadow: {
    path: 'assets/diagnostics/layers/pulls/avoidance/b05-avoidance-recede-shadow-alpha-v0_1.mkv',
    sha256: 'f2000a7276d345e42d52c0a496e2968cf34baedc24f3c8a719b9d9ce09a31d4e',
  },
  avoidanceRecedeForeground: {
    path: 'assets/diagnostics/layers/pulls/avoidance/b05-avoidance-recede-foreground-alpha-v0_1.mkv',
    sha256: '8fcccb9a762c1047fe9a6df7417931dc26e22727a0fa72c57f69d2606021750c',
  },
})

const AUDIO_SOURCE_FILES = Object.freeze({
  score: {
    path: 'exports/h06-record-spin-breath-v0_1/audio/score-continuous-788f.wav',
    sha256: '8938f1e835be75e2af2057a8b56f749d24a06793c4234221ac27ec1037d7072e',
  },
  tableSlide: {
    path: 'assets/audio/sfx/selected/h03-paper-wall-slide-v0_1.wav',
    sha256: 'eed2d4d9774e4e6b6fcbc48fab6698ddbb6153c9b5fdcd4438711e77b4628f21',
  },
  platterStop: {
    path: 'assets/audio/sfx/selected/h07-button-click-platter-stop-v0_1.wav',
    sha256: '0664aa457b030b29700868fdd8a1a7b7d37978ed7feb0056d6a556e37f260628',
  },
})

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryDirectory = resolve(scriptDirectory, '..')
const appDirectory = join(repositoryDirectory, 'apps/beside-cue')
const defaultOutputDirectory = join(
  appDirectory,
  'public/onboarding/corky-v2.4',
)
const defaultProofDirectory = join(
  appDirectory,
  'media-source/onboarding/corky-v2.4',
)

const OUTPUT_NAMES = Object.freeze({
  corkyReveal: 'picture/b01-corky-greeting-v0_4.mp4',
  tableReveal: 'picture/b02-table-reveal-v0_1.mp4',
  p00: 'stills/p00-set-empty-v0_1.webp',
  p01: 'stills/p01-corky-rest-v0_4.webp',
  p02: 'stills/p02-table-ready-v0_17.webp',
  scrollingPresent: 'picture/b03-scrolling-present-v0_2.mp4',
  scrollingHold: 'stills/p03-scrolling-settled-v0_2.webp',
  scrollingRecede: 'picture/b05-scrolling-recede-v0_2.mp4',
  snackingPresent: 'picture/b03-snacking-present-v0_3.mp4',
  snackingHold: 'stills/p03-snacking-settled-v0_3.webp',
  snackingRecede: 'picture/b05-snacking-recede-v0_4.mp4',
  avoidancePresent: 'picture/b03-avoidance-present-v0_1.mp4',
  avoidanceHold: 'stills/p03-avoidance-settled-v0_1.webp',
  avoidanceRecede: 'picture/b05-avoidance-recede-v0_1.mp4',
  greeting: 'audio/dialogue/corky-greeting-v0_3.m4a',
  score: 'audio/score/besidecue-score-v0_9.m4a',
  introFoley: 'audio/foley/intro-table-slide-v0_1.m4a',
  platterStop: 'audio/foley/platter-stop-v0_1.m4a',
})

const STALE_OUTPUT_NAMES = Object.freeze([
  'picture/b01-b02-corky-table-intro-v0_1.mp4',
  'picture/b01-corky-reveal-v0_2.mp4',
  'picture/b01-corky-entrance-v0_3.mp4',
  'audio/dialogue/corky-greeting-v0_1.m4a',
  'audio/dialogue/corky-greeting-v0_2.m4a',
])

const PULLS = Object.freeze([
  Object.freeze({
    id: 'scrolling',
    presentShadow: 'scrollingPresentShadow',
    presentForeground: 'scrollingPresentForeground',
    recedeShadow: 'scrollingRecedeShadow',
    recedeForeground: 'scrollingRecedeForeground',
    presentOutput: 'scrollingPresent',
    holdOutput: 'scrollingHold',
    recedeOutput: 'scrollingRecede',
  }),
  Object.freeze({
    id: 'snacking',
    presentShadow: 'snackingPresentShadow',
    presentForeground: 'snackingPresentForeground',
    recedeShadow: 'snackingRecedeShadow',
    recedeForeground: 'snackingRecedeForeground',
    presentOutput: 'snackingPresent',
    holdOutput: 'snackingHold',
    recedeOutput: 'snackingRecede',
  }),
  Object.freeze({
    id: 'avoidance',
    presentShadow: 'avoidancePresentShadow',
    presentForeground: 'avoidancePresentForeground',
    recedeShadow: 'avoidanceRecedeShadow',
    recedeForeground: 'avoidanceRecedeForeground',
    presentOutput: 'avoidancePresent',
    holdOutput: 'avoidanceHold',
    recedeOutput: 'avoidanceRecede',
  }),
])

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

function usage() {
  return [
    'Usage:',
    '  node scripts/prepare-beside-cue-v2-4-media.mjs \\',
    '    --source-package /absolute/path/to/onboarding-video-edit-v2_4 \\',
    '    --legacy-audio-package /absolute/path/to/onboarding-video-edit-v0_1 \\',
    '    --corky-greeting-raw /absolute/path/to/kling_iamcorky_initial.mp4 \\',
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
    !parsed['source-package'] ||
    !parsed['legacy-audio-package'] ||
    !parsed['corky-greeting-raw']
  ) {
    throw new Error(usage())
  }
  return {
    sourcePackage: resolve(parsed['source-package']),
    legacyAudioPackage: resolve(parsed['legacy-audio-package']),
    corkyGreetingRaw: resolve(parsed['corky-greeting-raw']),
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

function sourcePath(paths, key) {
  const source = SOURCE_FILES[key]
  if (source === undefined) throw new Error(`Unknown source key: ${key}`)
  return join(paths.sourcePackage, source.path)
}

function audioSourcePath(paths, key) {
  const source = AUDIO_SOURCE_FILES[key]
  if (source === undefined) throw new Error(`Unknown audio source key: ${key}`)
  return join(paths.legacyAudioPackage, source.path)
}

function prepareStill(source, destination) {
  ffmpeg([
    '-i',
    source,
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
    destination,
  ])
}

function pullCompositeFilter({ stillFrame }) {
  const composite = [
    '[0:v]format=rgba[base]',
    '[1:v]format=rgba[shadow]',
    '[2:v]format=rgba[foreground]',
    '[base][shadow]overlay=eof_action=repeat:format=auto[grounded]',
    '[grounded][foreground]overlay=eof_action=repeat:format=auto[composite]',
  ]
  if (stillFrame === undefined) {
    composite.push(
      `[composite]scale=720:1280:flags=lanczos,format=rgb24,${BT709_FRAME_TAGS}[out]`,
    )
  } else {
    composite.push(
      `[composite]select='eq(n,${String(stillFrame)})',setpts=PTS-STARTPTS,scale=720:1280:flags=lanczos,format=rgb24[out]`,
    )
  }
  return composite.join(';')
}

function preparePullVideo(base, shadow, foreground, destination) {
  ffmpeg([
    '-loop',
    '1',
    '-framerate',
    '24',
    '-i',
    base,
    '-i',
    shadow,
    '-i',
    foreground,
    '-filter_complex',
    pullCompositeFilter({}),
    '-map',
    '[out]',
    '-frames:v',
    '96',
    ...VIDEO_ENCODING,
    '-y',
    destination,
  ])
}

function preparePullHold(base, shadow, foreground, destination) {
  ffmpeg([
    '-loop',
    '1',
    '-framerate',
    '24',
    '-i',
    base,
    '-i',
    shadow,
    '-i',
    foreground,
    '-filter_complex',
    pullCompositeFilter({ stillFrame: 95 }),
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
    destination,
  ])
}

function prepareIntroClip(source, endFrame, destination) {
  ffmpeg([
    '-i',
    source,
    '-vf',
    `trim=start_frame=0:end_frame=${String(endFrame)},setpts=PTS-STARTPTS,scale=720:1280:flags=lanczos,format=rgb24,${BT709_FRAME_TAGS}`,
    '-map',
    '0:v:0',
    '-frames:v',
    String(endFrame),
    ...VIDEO_ENCODING,
    '-y',
    destination,
  ])
}

function prepareCorkyGreeting(raw, panelTransition, p01, destination) {
  const frameWorkspace = join(dirname(destination), 'b01-frame-workspace')
  const rawFrames = join(frameWorkspace, 'raw')
  const wipeFrames = join(frameWorkspace, 'wipe')
  const deliveryFrames = join(frameWorkspace, 'delivery')
  mkdirSync(rawFrames, { recursive: true })
  mkdirSync(wipeFrames, { recursive: true })
  mkdirSync(deliveryFrames, { recursive: true })

  const numbered = (directory, prefix, frame, digits = 5) =>
    join(directory, `${prefix}${String(frame).padStart(digits, '0')}.png`)

  ffmpeg([
    '-i',
    raw,
    '-map',
    '0:v:0',
    '-vf',
    `trim=start_frame=0:end_frame=${String(CORKY_GREETING_SOURCE.frames)},setpts=PTS-STARTPTS,scale=720:1280:flags=lanczos,format=rgb24`,
    '-start_number',
    '0',
    '-frames:v',
    String(CORKY_GREETING_SOURCE.frames),
    '-fps_mode',
    'passthrough',
    '-map_metadata',
    '-1',
    '-y',
    join(rawFrames, 'frame-%03d.png'),
  ])

  const panelFrame = join(frameWorkspace, 'panel-f19.png')
  ffmpeg([
    '-i',
    panelTransition,
    '-vf',
    "select='eq(n,19)',scale=720:1280:flags=lanczos,format=rgb24",
    '-frames:v',
    '1',
    '-map_metadata',
    '-1',
    '-y',
    panelFrame,
  ])

  const p01Frame = join(frameWorkspace, 'p01.png')
  ffmpeg([
    '-i',
    p01,
    '-vf',
    'scale=720:1280:flags=lanczos,format=rgb24',
    '-frames:v',
    '1',
    '-map_metadata',
    '-1',
    '-y',
    p01Frame,
  ])

  const finalGreetingFrame = numbered(
    rawFrames,
    'frame-',
    CORKY_GREETING_SOURCE.frames - 1,
    3,
  )
  ffmpeg([
    '-loop',
    '1',
    '-framerate',
    '24',
    '-i',
    finalGreetingFrame,
    '-loop',
    '1',
    '-framerate',
    '24',
    '-i',
    panelFrame,
    '-filter_complex',
    "[0:v][1:v]overlay=x='-720+90*n':y=0:shortest=1:format=rgb,format=rgb24[out]",
    '-map',
    '[out]',
    '-start_number',
    '0',
    '-frames:v',
    '8',
    '-map_metadata',
    '-1',
    '-y',
    join(wipeFrames, 'in-%03d.png'),
  ])
  ffmpeg([
    '-loop',
    '1',
    '-framerate',
    '24',
    '-i',
    p01Frame,
    '-loop',
    '1',
    '-framerate',
    '24',
    '-i',
    panelFrame,
    '-filter_complex',
    "[0:v][1:v]overlay=x='90*n':y=0:shortest=1:format=rgb,format=rgb24[out]",
    '-map',
    '[out]',
    '-start_number',
    '0',
    '-frames:v',
    '8',
    '-map_metadata',
    '-1',
    '-y',
    join(wipeFrames, 'out-%03d.png'),
  ])

  let outputFrame = 0
  const append = (source) => {
    copyFileSync(source, numbered(deliveryFrames, 'frame-', outputFrame))
    outputFrame += 1
  }
  for (let frame = 0; frame < CORKY_GREETING_SOURCE.frames; frame += 1) {
    append(numbered(rawFrames, 'frame-', frame, 3))
  }
  for (let frame = 0; frame < 8; frame += 1) {
    append(numbered(wipeFrames, 'in-', frame, 3))
  }
  append(panelFrame)
  append(panelFrame)
  append(panelFrame)
  append(panelFrame)
  for (let frame = 0; frame < 8; frame += 1) {
    append(numbered(wipeFrames, 'out-', frame, 3))
  }
  for (let frame = 0; frame < 6; frame += 1) append(p01Frame)
  if (outputFrame !== 147) {
    throw new Error(
      `Corky greeting assembly produced ${String(outputFrame)} frames.`,
    )
  }

  ffmpeg([
    '-framerate',
    '24',
    '-start_number',
    '0',
    '-i',
    join(deliveryFrames, 'frame-%05d.png'),
    '-vf',
    `format=rgb24,${BT709_FRAME_TAGS}`,
    '-frames:v',
    '147',
    ...VIDEO_ENCODING,
    '-y',
    destination,
  ])
}

const AUDIO_ENCODING = Object.freeze([
  '-map',
  '0:a:0',
  '-vn',
  '-map_metadata',
  '-1',
  '-ar',
  '48000',
  '-ac',
  '2',
  '-c:a',
  'aac',
  '-b:a',
  '192k',
  '-movflags',
  '+faststart',
])

function prepareAudio(source, destination, filter) {
  ffmpeg([
    '-i',
    source,
    ...(filter === undefined ? [] : ['-af', filter]),
    ...AUDIO_ENCODING,
    '-y',
    destination,
  ])
}

function probeVideo(path, expectedFrames) {
  const payload = JSON.parse(
    run('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration:stream=codec_type,codec_name,width,height,pix_fmt,r_frame_rate,nb_frames,color_primaries,color_transfer,color_space',
      '-of',
      'json',
      path,
    ]),
  )
  const streams = payload.streams ?? []
  const videos = streams.filter((stream) => stream.codec_type === 'video')
  const audio = streams.filter((stream) => stream.codec_type === 'audio')
  const video = videos[0]
  if (
    videos.length !== 1 ||
    audio.length !== 0 ||
    video.codec_name !== 'h264' ||
    video.width !== 720 ||
    video.height !== 1280 ||
    video.pix_fmt !== 'yuv420p' ||
    video.r_frame_rate !== '24/1' ||
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

function probeCorkyGreetingSource(path) {
  const payload = JSON.parse(
    run('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration:stream=codec_type,codec_name,width,height,pix_fmt,r_frame_rate,avg_frame_rate,nb_frames,sample_rate,channels',
      '-of',
      'json',
      path,
    ]),
  )
  const streams = payload.streams ?? []
  const videos = streams.filter((stream) => stream.codec_type === 'video')
  const audio = streams.filter((stream) => stream.codec_type === 'audio')
  const video = videos[0]
  const track = audio[0]
  if (
    videos.length !== 1 ||
    audio.length !== 1 ||
    video.codec_name !== 'h264' ||
    video.width !== 2160 ||
    video.height !== 3840 ||
    video.pix_fmt !== 'yuv420p' ||
    video.r_frame_rate !== '24/1' ||
    video.avg_frame_rate !== '24/1' ||
    Number(video.nb_frames) !== CORKY_GREETING_SOURCE.frames ||
    track.codec_name !== 'aac' ||
    track.sample_rate !== '44100' ||
    track.channels !== 2 ||
    Math.abs(Number(payload.format?.duration) - 5.041667) > 0.001
  ) {
    throw new Error(
      `Corky greeting source contract failed: ${path}: ${JSON.stringify(payload)}`,
    )
  }
}

function probeStill(path) {
  const geometry = run('magick', [path, '-format', '%wx%h', 'info:'])
  if (geometry !== '720x1280') {
    throw new Error(`Delivery still geometry failed: ${path}: ${geometry}`)
  }
}

function probeAudio(path, expectedDurationSeconds) {
  const payload = JSON.parse(
    run('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration:stream=codec_type,codec_name,sample_rate,channels',
      '-of',
      'json',
      path,
    ]),
  )
  const streams = payload.streams ?? []
  const audio = streams.filter((stream) => stream.codec_type === 'audio')
  const video = streams.filter((stream) => stream.codec_type === 'video')
  const track = audio[0]
  if (
    audio.length !== 1 ||
    video.length !== 0 ||
    track.codec_name !== 'aac' ||
    track.sample_rate !== '48000' ||
    track.channels !== 2 ||
    (expectedDurationSeconds !== undefined &&
      Math.abs(Number(payload.format?.duration) - expectedDurationSeconds) >
        0.001)
  ) {
    throw new Error(
      `Delivery audio contract failed: ${path}: ${JSON.stringify(payload)}`,
    )
  }
}

const paths = parseArguments(process.argv.slice(2))
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'beside-cue-v2-4-'))

try {
  assertHash(
    'Selected Corky greeting',
    paths.corkyGreetingRaw,
    CORKY_GREETING_SOURCE.sha256,
  )
  probeCorkyGreetingSource(paths.corkyGreetingRaw)
  assertHash(
    'V2.4 inventory',
    join(paths.sourcePackage, 'SHA256SUMS-v2_4.txt'),
    SOURCE_INVENTORY_SHA256,
  )
  for (const [key, source] of Object.entries(SOURCE_FILES)) {
    assertHash(key, join(paths.sourcePackage, source.path), source.sha256)
  }
  for (const [key, source] of Object.entries(AUDIO_SOURCE_FILES)) {
    assertHash(key, join(paths.legacyAudioPackage, source.path), source.sha256)
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

  prepareCorkyGreeting(
    paths.corkyGreetingRaw,
    sourcePath(paths, 'introB02'),
    sourcePath(paths, 'p01'),
    temporary.corkyReveal,
  )
  prepareIntroClip(sourcePath(paths, 'introB02'), 48, temporary.tableReveal)
  prepareStill(sourcePath(paths, 'p00'), temporary.p00)
  prepareStill(sourcePath(paths, 'p01'), temporary.p01)
  prepareStill(sourcePath(paths, 'p02'), temporary.p02)

  for (const pull of PULLS) {
    const presentShadow = sourcePath(paths, pull.presentShadow)
    const presentForeground = sourcePath(paths, pull.presentForeground)
    const recedeShadow = sourcePath(paths, pull.recedeShadow)
    const recedeForeground = sourcePath(paths, pull.recedeForeground)
    preparePullVideo(
      sourcePath(paths, 'p02'),
      presentShadow,
      presentForeground,
      temporary[pull.presentOutput],
    )
    preparePullHold(
      sourcePath(paths, 'p02'),
      presentShadow,
      presentForeground,
      temporary[pull.holdOutput],
    )
    preparePullVideo(
      sourcePath(paths, 'p02'),
      recedeShadow,
      recedeForeground,
      temporary[pull.recedeOutput],
    )
  }

  prepareAudio(paths.corkyGreetingRaw, temporary.greeting)
  prepareAudio(audioSourcePath(paths, 'score'), temporary.score)
  prepareAudio(
    audioSourcePath(paths, 'tableSlide'),
    temporary.introFoley,
    'volume=0.24',
  )
  prepareAudio(
    audioSourcePath(paths, 'platterStop'),
    temporary.platterStop,
    'volume=0.32',
  )

  probeVideo(temporary.corkyReveal, 147)
  probeVideo(temporary.tableReveal, 48)
  for (const pull of PULLS) {
    probeVideo(temporary[pull.presentOutput], 96)
    probeVideo(temporary[pull.recedeOutput], 96)
    probeStill(temporary[pull.holdOutput])
  }
  for (const key of ['p00', 'p01', 'p02']) probeStill(temporary[key])
  probeAudio(temporary.greeting, 5.039)
  for (const key of ['score', 'introFoley', 'platterStop']) {
    probeAudio(temporary[key])
  }

  mkdirSync(paths.outputDirectory, { recursive: true })
  mkdirSync(paths.proofDirectory, { recursive: true })
  for (const [key, name] of Object.entries(OUTPUT_NAMES)) {
    mkdirSync(dirname(join(paths.outputDirectory, name)), { recursive: true })
    const staged = join(paths.outputDirectory, `${name}.staging`)
    copyFileSync(temporary[key], staged)
    renameSync(staged, join(paths.outputDirectory, name))
  }
  for (const name of STALE_OUTPUT_NAMES) {
    rmSync(join(paths.outputDirectory, name), { force: true })
  }

  const outputRecords = Object.entries(OUTPUT_NAMES)
    .map(([key, name]) => ({
      path: name,
      sha256: sha256(temporary[key]),
      bytes: statSync(temporary[key]).size,
    }))
    .sort((left, right) => left.path.localeCompare(right.path))
  const inventory = outputRecords
    .map(({ path, sha256: digest }) => `${digest}  ${path}`)
    .join('\n')
  const inventoryStaged = join(paths.outputDirectory, 'SHA256SUMS.staging')
  writeFileSync(inventoryStaged, `${inventory}\n`, 'utf8')
  renameSync(inventoryStaged, join(paths.outputDirectory, 'SHA256SUMS'))

  const contract = {
    schemaVersion: 1,
    generatedBy: 'scripts/prepare-beside-cue-v2-4-media.mjs',
    authorization:
      'Founder-selected V2.4 product onboarding with the accepted Kling Corky greeting; device review remains required before release.',
    source: {
      package: 'onboarding-video-edit-v2_4',
      inventorySha256: SOURCE_INVENTORY_SHA256,
      legacyAudioPackage: 'onboarding-video-edit-v0_1',
      corkyGreetingRaw: {
        file: CORKY_GREETING_SOURCE.file,
        sha256: CORKY_GREETING_SOURCE.sha256,
      },
    },
    delivery: {
      picture:
        'H.264 High 3.1, yuv420p, 720x1280, 24fps CFR, CRF16, GOP48, BT.709, silent, faststart',
      stills: 'lossless WebP, 720x1280',
      audio: 'AAC-LC, 48kHz, stereo, 192kbps',
    },
    outputRecords,
  }
  const contractPath = join(paths.proofDirectory, 'BUILD-CONTRACT.json')
  const contractStaged = `${contractPath}.staging`
  writeFileSync(
    contractStaged,
    `${JSON.stringify(contract, null, 2)}\n`,
    'utf8',
  )
  renameSync(contractStaged, contractPath)

  const inventoryDigest = sha256(join(paths.outputDirectory, 'SHA256SUMS'))
  const contractDigest = sha256(contractPath)
  const summary = Object.entries(OUTPUT_NAMES)
    .map(([key, name]) => `${sha256(temporary[key])}  ${name}`)
    .sort()
    .join('\n')
  console.log('V2_4_APP_MEDIA_PREPARE_PASS')
  console.log(`SHA256SUMS ${inventoryDigest}`)
  console.log(`BUILD-CONTRACT.json ${contractDigest}`)
  console.log(summary)
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true })
}

// Prepare the selected J2 greeting with the existing exact-P02 cream handoff.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync, } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APP = join(ROOT, 'apps/beside-cue')
const OUTPUT = 'picture/b01-corky-greeting-j2-direct-to-p02-v0_1.mp4'
const FPS = 24
const GREETING_FRAMES = 144
const WIPE_IN = 8
const OPAQUE = 4
const WIPE_OUT = 8
const TABLE_HANDLE = 6
const FRAMES = GREETING_FRAMES + WIPE_IN + OPAQUE + WIPE_OUT + TABLE_HANDLE
const SOURCES = Object.freeze({
  greeting: {
    file: 'g01-flow-2026-09-14/raw/g01-flow-omni-take-20260914102516-keeper.mp4',
    sha256: 'b46b92b03c1320c86c6816ff50360e54ba02addebce7d27a25bf6b1ec5ccc3cd',
  },
  transition: {
    file: 'onboarding-video-edit-v2_4/assets/diagnostics/transitions/b02-table-reveal-diagnostic-v0_1.mkv',
    sha256: '678e48b4ff277162e52ba0f766c8c565b1dc32e6670979af165fec8167ff0075',
  },
  table: {
    file: 'onboarding-video-edit-v2_4/assets/diagnostics/plates/p02-table-ready-candidate-v0_17.png',
    sha256: '800a76049ad152224ead6591eaf1d8acdff3a7db9c308f7ec8f92102ce5c57c3',
  },
})

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 120_000,
  })
  if (result.error || result.status !== 0) {
    throw new Error(
      `${command} failed: ${String(result.error ?? result.stderr)}`,
    )
  }
  return result.stdout.trim()
}

function ffmpeg(args) {
  return run('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-filter_threads',
    '1',
    '-filter_complex_threads',
    '1',
    ...args,
  ])
}

function digest(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function probe(path) {
  return JSON.parse(
    run('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', path]),
  ).streams
}

function frame(path, index) {
  return join(path, `frame-${String(index).padStart(3, '0')}.png`)
}

function install(source, destination) {
  mkdirSync(dirname(destination), { recursive: true })
  copyFileSync(source, `${destination}.staging`)
  renameSync(`${destination}.staging`, destination)
}

const args = process.argv.slice(2)
const options = {}
const accepted = new Set([
  '--greeting-source',
  '--transition-source',
  '--table-source',
  '--output-dir',
  '--proof-dir',
])
for (let index = 0; index < args.length; index += 2) {
  if (
    !accepted.has(args[index]) ||
    !args[index + 1] ||
    args[index + 1].startsWith('--')
  ) {
    throw new Error(
      'Expected --greeting-source, --transition-source, --table-source and optional --output-dir / --proof-dir paths.',
    )
  }
  options[args[index]] = resolve(args[index + 1])
}
for (const [key, source] of Object.entries(SOURCES)) {
  const path = options[`--${key}-source`]
  if (!path || digest(path) !== source.sha256)
    throw new Error(`Missing or unpinned ${key} source.`)
}
const rawVideo = probe(options['--greeting-source']).find(
  (stream) => stream.codec_type === 'video',
)
if (
  rawVideo?.width !== 720 ||
  rawVideo.height !== 1280 ||
  rawVideo.avg_frame_rate !== '24/1' ||
  Number(rawVideo.nb_frames) !== GREETING_FRAMES
) {
  throw new Error(
    'The selected greeting must retain all 144 frames at 720x1280 / 24fps.',
  )
}

const temporary = mkdtempSync(join(tmpdir(), 'beside-cue-j2-'))
try {
  const raw = join(temporary, 'raw')
  const incoming = join(temporary, 'incoming')
  const outgoing = join(temporary, 'outgoing')
  const delivery = join(temporary, 'delivery')
  for (const path of [raw, incoming, outgoing, delivery]) mkdirSync(path)
  const panel = join(temporary, 'panel.png')
  const table = join(temporary, 'table.png')
  ffmpeg([
    '-i',
    options['--greeting-source'],
    '-map',
    '0:v:0',
    '-vf',
    'format=rgb24',
    '-frames:v',
    String(GREETING_FRAMES),
    '-fps_mode',
    'passthrough',
    '-start_number',
    '0',
    '-threads',
    '1',
    join(raw, 'frame-%03d.png'),
  ])
  ffmpeg([
    '-i',
    options['--transition-source'],
    '-vf',
    "select='eq(n,19)',scale=720:1280:flags=lanczos,format=rgb24",
    '-frames:v',
    '1',
    '-threads',
    '1',
    panel,
  ])
  ffmpeg([
    '-i',
    options['--table-source'],
    '-vf',
    'scale=720:1280:flags=lanczos,format=rgb24',
    '-frames:v',
    '1',
    '-threads',
    '1',
    table,
  ])

  // Keep the previous 8/4/8-frame cream wipe and exact P02 endpoint. The
  // performance starts at frame zero; this appends a handoff, never pre-roll.
  for (const [background, expression, directory, count] of [
    [frame(raw, GREETING_FRAMES - 1), '-720+90*n', incoming, WIPE_IN],
    [table, '90*n', outgoing, WIPE_OUT],
  ]) {
    ffmpeg([
      '-loop',
      '1',
      '-framerate',
      String(FPS),
      '-i',
      background,
      '-loop',
      '1',
      '-framerate',
      String(FPS),
      '-i',
      panel,
      '-filter_complex',
      `[0:v][1:v]overlay=x='${expression}':y=0:shortest=1:format=rgb,format=rgb24[out]`,
      '-map',
      '[out]',
      '-frames:v',
      String(count),
      '-start_number',
      '0',
      '-threads',
      '1',
      join(directory, 'frame-%03d.png'),
    ])
  }
  let next = 0
  const append = (source) => copyFileSync(source, frame(delivery, next++))
  for (let index = 0; index < GREETING_FRAMES; index += 1)
    append(frame(raw, index))
  for (let index = 0; index < WIPE_IN; index += 1)
    append(frame(incoming, index))
  for (let index = 0; index < OPAQUE; index += 1) append(panel)
  for (let index = 0; index < WIPE_OUT; index += 1)
    append(frame(outgoing, index))
  for (let index = 0; index < TABLE_HANDLE; index += 1) append(table)

  const movie = join(temporary, 'greeting.mp4')
  ffmpeg([
    '-framerate',
    String(FPS),
    '-i',
    join(delivery, 'frame-%03d.png'),
    '-vf',
    'format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709',
    '-frames:v',
    String(FRAMES),
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
    String(FPS),
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
    movie,
  ])
  const streams = probe(movie)
  const video = streams[0]
  if (
    streams.length !== 1 ||
    video.codec_type !== 'video' ||
    video.codec_name !== 'h264' ||
    video.profile !== 'High' ||
    video.level !== 31 ||
    video.width !== 720 ||
    video.height !== 1280 ||
    video.pix_fmt !== 'yuv420p' ||
    video.avg_frame_rate !== '24/1' ||
    Number(video.nb_frames) !== FRAMES ||
    video.color_space !== 'bt709' ||
    video.color_primaries !== 'bt709' ||
    video.color_transfer !== 'bt709'
  ) {
    throw new Error(`Delivery contract failed: ${JSON.stringify(streams)}`)
  }
  const bytes = readFileSync(movie)
  if (bytes.indexOf('moov') > bytes.indexOf('mdat'))
    throw new Error('Delivery is not faststart.')
  ffmpeg(['-i', movie, '-f', 'null', '-'])
  const record = {
    path: OUTPUT,
    sha256: digest(movie),
    bytes: bytes.length,
    frames: FRAMES,
    durationSeconds: FRAMES / FPS,
  }
  const contract = {
    schemaVersion: 1,
    generatedBy: 'scripts/prepare-beside-cue-j2-greeting.mjs',
    builderSha256: digest(fileURLToPath(import.meta.url)),
    ffmpegVersion: run('ffmpeg', ['-version']).split('\n')[0],
    authorization:
      'Owner-selected one-offset J2 preview, 2026-09-14; no new generated media.',
    selectedPreviewSha256:
      '978954ab912ad99a1a2be9725ac9aaf80c16783dab3e36209746bb9904109abe',
    source: SOURCES,
    timeline: {
      fps: FPS,
      greetingFrames: GREETING_FRAMES,
      wipeInFrames: WIPE_IN,
      opaqueFrames: OPAQUE,
      wipeOutFrames: WIPE_OUT,
      tableHandleFrames: TABLE_HANDLE,
      dialogueOnsetSeconds: 0.85,
      preRollFrames: 0,
    },
    dialogue: {
      src: '/audio/voice/en/corky/en__corky__onboarding-greeting__v1_02.m4a',
      sha256:
        '96246c3ee6c42efff200b7dd7bbe6e022af610a84e7963ff9b2c0e612f580759',
      durationMs: 2660,
    },
    delivery:
      'One silent H.264 High 3.1 stream, 720x1280 yuv420p BT.709, 24fps CFR, CRF16, GOP48, faststart; one encoding thread. All donor frames retained without retiming; exact P02 source before encoding.',
    outputRecords: [record],
  }
  const inventory = join(temporary, 'SHA256SUMS')
  const proof = join(temporary, 'BUILD-CONTRACT.json')
  writeFileSync(inventory, `${record.sha256}  ${OUTPUT}\n`)
  writeFileSync(proof, `${JSON.stringify(contract, null, 2)}\n`)
  const outputDirectory =
    options['--output-dir'] ?? join(APP, 'public/onboarding/corky-v2.6')
  const proofDirectory =
    options['--proof-dir'] ?? join(APP, 'media-source/onboarding/corky-v2.6')
  install(movie, join(outputDirectory, OUTPUT))
  install(inventory, join(outputDirectory, 'SHA256SUMS'))
  install(proof, join(proofDirectory, 'BUILD-CONTRACT.json'))
  console.log(JSON.stringify(record, null, 2))
} finally {
  rmSync(temporary, { recursive: true, force: true })
}

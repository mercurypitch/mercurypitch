// Curate and verify the four Drum Night kit flavors.
//
// The default mode downloads only pinned, redistributable source recordings,
// renders the bundled SONiVOX bank, and emits content-hashed MP3 one-shots.
// It never publishes. `--publish-plan` writes a reviewable R2 object plan;
// `--check` verifies the committed outputs without network access.
//
//   node scripts/curate-drum-night-kits.mjs
//   node scripts/curate-drum-night-kits.mjs --check
//   node scripts/curate-drum-night-kits.mjs --recalibrate-existing
//   node scripts/curate-drum-night-kits.mjs --publish-plan

import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync, } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { calibrateDrumKitResources, drumKitCalibrationMetadata, projectCalibratedResources, } from './drum-kit-calibration.mjs'
import { serializeDrumKitCatalogProjections, serializeDrumKitGeneratedJson, } from './drum-kit-catalog-projections.mjs'
import { DRUM_KIT_OPUS_BITRATE, DRUM_KIT_OPUS_CHANNELS, DRUM_KIT_OPUS_MIME_TYPE, DRUM_KIT_OPUS_SAMPLE_RATE, encodeDrumKitOpusCatalog, verifyDrumKitOpusCatalog, } from './drum-kit-opus.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repo = resolve(scriptDir, '..')
const publicRoot = resolve(repo, 'public/drum-night/kits')
const generatedCatalogPath = resolve(
  repo,
  'src/features/drum-night/audio/drum-kit-resources.generated.json',
)
const generatedRuntimeProjectionPath = resolve(
  repo,
  'src/features/drum-night/audio/drum-kit-runtime.generated.json',
)
const generatedOpusProjectionPath = resolve(
  repo,
  'src/features/drum-night/audio/drum-kit-opus.generated.json',
)
const generatedCalibrationReportPath = resolve(
  repo,
  'src/features/drum-night/audio/drum-kit-calibration.generated.json',
)
const publishPlanPath = resolve(publicRoot, 'publish-plan.json')
const sonivoxPath = resolve(
  process.env.SONIVOX_SF3 ??
    join(repo, 'node_modules/@coderline/alphatab/dist/soundfont/sonivox.sf3'),
)
const sonivoxLicensePath = resolve(
  repo,
  'node_modules/@coderline/alphatab/dist/soundfont/LICENSE',
)
const VIRTUOSITY_COMMIT = 'd41b734e9ce5edce1be375c262b2644de4387061'
const TCHIMERA_COMMIT = 'fc8a6daa22a20708de962e915ddc1ae17bd2aa32'
const SONIVOX_SHA256 =
  'd39beb7cd349278455b44e7689e35e3c1f5ed9ef80118485846537929df8f7c0'
const KIT_VERSION = 'v1'
const CACHE_CONTROL = 'public, max-age=31536000, immutable'
const BITRATE = '112k'
const SAMPLE_RATE = 44_100
const CHANNELS = 2
const EXPECTED_FFMPEG_VERSION = 'n9.0.1'
const EXPECTED_FLUIDSYNTH_VERSION = '2.6.0'
const APACHE_LICENSE_BYTES = 11_358
const APACHE_LICENSE_SHA256 =
  'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30'
const HARD_ONSET_THRESHOLD_DB = -60
const TRANSIENT_FLOOR_DB = -55
const TRANSIENT_RELATIVE_DB = -35
const MAXIMUM_ONSET_MS = 5
const ONSET_PREROLL_MS = 2
const TRANSIENT_WINDOW_MS = 250
const MINIMUM_NOISE_WINDOW_MS = 20
const STATIC_PUBLIC_FILES = Object.freeze([
  'README.md',
  'classic-gm/APACHE-2.0.txt',
  'classic-gm/LICENSE.md',
  'live/LICENSE.md',
  'studio/LICENSE.md',
])

const args = new Set(process.argv.slice(2))
const checkOnly = args.has('--check')
const planOnly = args.has('--publish-plan')
const recalibrateOnly = args.has('--recalibrate-existing')
const unknownArgs = [...args].filter(
  (argument) =>
    argument !== '--check' &&
    argument !== '--publish-plan' &&
    argument !== '--recalibrate-existing',
)
if (
  unknownArgs.length > 0 ||
  [checkOnly, planOnly, recalibrateOnly].filter(Boolean).length > 1
) {
  throw new Error(
    'Usage: node scripts/curate-drum-night-kits.mjs [--check|--recalibrate-existing|--publish-plan]',
  )
}

function sha256(data) {
  return createHash('sha256').update(data).digest('hex')
}

function ensureDirectory(path) {
  mkdirSync(path, { recursive: true })
}

function run(command, commandArgs) {
  execFileSync(command, commandArgs, {
    cwd: repo,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function commandOutput(command, commandArgs) {
  return execFileSync(command, commandArgs, {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function detectToolchain() {
  const ffmpegOutput = commandOutput('ffmpeg', ['-version'])
  const ffmpeg = /^ffmpeg version (\S+)/.exec(ffmpegOutput)?.[1]
  const fluidsynthOutput = commandOutput('fluidsynth', ['--version'])
  const fluidsynth = /FluidSynth runtime version (\S+)/.exec(
    fluidsynthOutput,
  )?.[1]
  if (ffmpeg === undefined || fluidsynth === undefined) {
    throw new Error('Could not identify the Drum Night audio toolchain')
  }
  return { ffmpeg, fluidsynth }
}

function assertExpectedToolchain() {
  const toolchain = detectToolchain()
  if (
    toolchain.ffmpeg !== EXPECTED_FFMPEG_VERSION ||
    toolchain.fluidsynth !== EXPECTED_FLUIDSYNTH_VERSION
  ) {
    throw new Error(
      `Drum Night audio toolchain mismatch: expected ffmpeg ${EXPECTED_FFMPEG_VERSION} and FluidSynth ${EXPECTED_FLUIDSYNTH_VERSION}; received ffmpeg ${toolchain.ffmpeg} and FluidSynth ${toolchain.fluidsynth}`,
    )
  }
  return toolchain
}

function rawGithub(owner, repository, commit, path) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  return `https://raw.githubusercontent.com/${owner}/${repository}/${commit}/${encodedPath}`
}

function velocityLayers(lowSource, highSource) {
  return [
    { ...lowSource, velocityMin: 1, velocityMax: 80 },
    { ...highSource, velocityMin: 81, velocityMax: 127 },
  ]
}

function studioSource(path) {
  return {
    sourceKind: 'remote',
    sourceCommit: VIRTUOSITY_COMMIT,
    sourcePath: path,
    sourceUrl: rawGithub(
      'studiorack',
      'virtuosity-drums',
      VIRTUOSITY_COMMIT,
      path,
    ),
  }
}

function liveSource(path) {
  return {
    sourceKind: 'remote',
    sourceCommit: TCHIMERA_COMMIT,
    sourcePath: path,
    sourceUrl: rawGithub(
      'michaelwillis',
      'tchimera-drum-kit',
      TCHIMERA_COMMIT,
      path,
    ),
  }
}

function zones(kitId, articulation, gmKeys, layerSources, options = {}) {
  return layerSources.flatMap((layer, layerIndex) => {
    const sources = Array.isArray(layer.sources) ? layer.sources : [layer]
    return sources.map((source, roundRobinIndex) => ({
      kitId,
      articulation,
      gmKeys,
      velocityMin: layer.velocityMin,
      velocityMax: layer.velocityMax,
      roundRobin: roundRobinIndex + 1,
      layer: layerIndex + 1,
      chokeGroup: options.chokeGroup ?? null,
      chokes: options.chokes ?? [],
      ...source,
    }))
  })
}

function studioLayer(paths) {
  return { sources: paths.map((path) => studioSource(path)) }
}

function liveLayer(paths) {
  return { sources: paths.map((path) => liveSource(path)) }
}

const studioZones = [
  ...zones(
    'studio',
    'kick',
    [35, 36],
    velocityLayers(
      studioLayer([
        'Samples/kickmic/kick/kickmic_kick_snon_vl2_rr1.flac',
        'Samples/kickmic/kick/kickmic_kick_snon_vl2_rr2.flac',
      ]),
      studioLayer([
        'Samples/kickmic/kick/kickmic_kick_snon_vl3_rr1.flac',
        'Samples/kickmic/kick/kickmic_kick_snon_vl3_rr2.flac',
      ]),
    ),
  ),
  ...zones(
    'studio',
    'snare',
    [38, 40],
    velocityLayers(
      studioLayer([
        'Samples/snaremic/snare/snaremic_snare_center_vl10.flac',
        'Samples/snaremic/snare/snaremic_snare_offcenter_vl10.flac',
      ]),
      studioLayer([
        'Samples/snaremic/snare/snaremic_snare_center_vl28.flac',
        'Samples/snaremic/snare/snaremic_snare_offcenter_vl28.flac',
      ]),
    ),
  ),
  ...zones(
    'studio',
    'sidestick',
    [37],
    velocityLayers(
      studioLayer([
        'Samples/snaremic/snare/snaremic_snare_crossstick_vl4.flac',
      ]),
      studioLayer([
        'Samples/snaremic/snare/snaremic_snare_crossstick_vl13.flac',
      ]),
    ),
  ),
  ...zones(
    'studio',
    'hh-closed',
    [42],
    velocityLayers(
      studioLayer([
        'Samples/mid/hh/mid_hh_closed_vl2_rr1.flac',
        'Samples/mid/hh/mid_hh_closed_vl2_rr2.flac',
      ]),
      studioLayer([
        'Samples/mid/hh/mid_hh_closed_vl3_rr1.flac',
        'Samples/mid/hh/mid_hh_closed_vl3_rr2.flac',
      ]),
    ),
    { chokes: ['hi-hat-open'] },
  ),
  ...zones(
    'studio',
    'hh-pedal',
    [44],
    velocityLayers(
      studioLayer([
        'Samples/mid/hh/mid_hh_pedal_vl1_rr1.flac',
        'Samples/mid/hh/mid_hh_pedal_vl1_rr2.flac',
      ]),
      studioLayer([
        'Samples/mid/hh/mid_hh_pedal_vl3_rr1.flac',
        'Samples/mid/hh/mid_hh_pedal_vl3_rr2.flac',
      ]),
    ),
    { chokes: ['hi-hat-open'] },
  ),
  ...zones(
    'studio',
    'hh-open',
    [46],
    velocityLayers(
      studioLayer([
        'Samples/mid/hh/mid_hh_open_vl2_rr1.flac',
        'Samples/mid/hh/mid_hh_open_vl2_rr2.flac',
      ]),
      studioLayer([
        'Samples/mid/hh/mid_hh_open_vl3_rr1.flac',
        'Samples/mid/hh/mid_hh_open_vl3_rr2.flac',
      ]),
    ),
    { chokeGroup: 'hi-hat-open' },
  ),
  ...zones(
    'studio',
    'tom-high',
    [47, 48, 50],
    velocityLayers(
      studioLayer(['Samples/mid/htom/mid_htom_center_vl4.flac']),
      studioLayer(['Samples/mid/htom/mid_htom_center_vl14.flac']),
    ),
  ),
  ...zones(
    'studio',
    'tom-low',
    [41, 43, 45],
    velocityLayers(
      studioLayer(['Samples/mid/ltom/mid_ltom_center_vl4.flac']),
      studioLayer(['Samples/mid/ltom/mid_ltom_center_vl14.flac']),
    ),
  ),
  ...zones(
    'studio',
    'crash',
    [49, 52, 55, 57],
    velocityLayers(
      studioLayer([
        'Samples/mid/crash/mid_crash_crash_vl1_rr1.flac',
        'Samples/mid/crash/mid_crash_crash_vl1_rr2.flac',
      ]),
      studioLayer([
        'Samples/mid/crash/mid_crash_crash_vl3_rr1.flac',
        'Samples/mid/crash/mid_crash_crash_vl3_rr2.flac',
      ]),
    ),
  ),
  ...zones(
    'studio',
    'ride',
    [51, 53, 59],
    velocityLayers(
      studioLayer([
        'Samples/mid/ride/mid_ride_ride_vl1_rr1.flac',
        'Samples/mid/ride/mid_ride_ride_vl1_rr2.flac',
      ]),
      studioLayer([
        'Samples/mid/ride/mid_ride_ride_vl3_rr1.flac',
        'Samples/mid/ride/mid_ride_ride_vl3_rr2.flac',
      ]),
    ),
  ),
]

const liveZones = [
  ...zones(
    'live',
    'kick',
    [35, 36],
    velocityLayers(
      liveLayer([
        'samples/kick/kick_prem_damp_a_03.wav',
        'samples/kick/kick_prem_damp_b_03.wav',
      ]),
      liveLayer([
        'samples/kick/kick_prem_damp_a_09.wav',
        'samples/kick/kick_prem_damp_b_09.wav',
      ]),
    ),
  ),
  ...zones(
    'live',
    'snare',
    [38, 40],
    velocityLayers(
      liveLayer([
        'samples/snare/snare_supr64_a_04.wav',
        'samples/snare/snare_supr64_b_04.wav',
      ]),
      liveLayer([
        'samples/snare/snare_supr64_a_14.wav',
        'samples/snare/snare_supr64_b_14.wav',
      ]),
    ),
  ),
  ...zones(
    'live',
    'hh-closed',
    [42],
    velocityLayers(
      liveLayer([
        'samples/cymbals/black_cortex_hihat_clo_bow_a_03.wav',
        'samples/cymbals/black_cortex_hihat_clo_bow_b_03.wav',
      ]),
      liveLayer([
        'samples/cymbals/black_cortex_hihat_clo_bow_a_08.wav',
        'samples/cymbals/black_cortex_hihat_clo_bow_b_08.wav',
      ]),
    ),
    { chokes: ['hi-hat-open'] },
  ),
  ...zones(
    'live',
    'hh-pedal',
    [44],
    velocityLayers(
      liveLayer([
        'samples/cymbals/black_cortex_hihat_ped_a_03.wav',
        'samples/cymbals/black_cortex_hihat_ped_b_03.wav',
      ]),
      liveLayer([
        'samples/cymbals/black_cortex_hihat_ped_a_08.wav',
        'samples/cymbals/black_cortex_hihat_ped_b_08.wav',
      ]),
    ),
    { chokes: ['hi-hat-open'] },
  ),
  ...zones(
    'live',
    'hh-open',
    [46],
    velocityLayers(
      liveLayer([
        'samples/cymbals/black_cortex_hihat_op_1_bow_a_03.wav',
        'samples/cymbals/black_cortex_hihat_op_1_bow_b_03.wav',
      ]),
      liveLayer([
        'samples/cymbals/black_cortex_hihat_op_1_bow_a_09.wav',
        'samples/cymbals/black_cortex_hihat_op_1_bow_b_09.wav',
      ]),
    ),
    { chokeGroup: 'hi-hat-open' },
  ),
  ...zones(
    'live',
    'tom-high',
    [48, 50],
    velocityLayers(
      liveLayer([
        'samples/toms/black_cortex_tom_12_ctr_a_03.wav',
        'samples/toms/black_cortex_tom_12_ctr_b_03.wav',
      ]),
      liveLayer([
        'samples/toms/black_cortex_tom_12_ctr_a_09.wav',
        'samples/toms/black_cortex_tom_12_ctr_b_09.wav',
      ]),
    ),
  ),
  ...zones(
    'live',
    'tom-mid',
    [47],
    velocityLayers(
      liveLayer([
        'samples/toms/black_cortex_tom_13_ctr_a_03.wav',
        'samples/toms/black_cortex_tom_13_ctr_b_03.wav',
      ]),
      liveLayer([
        'samples/toms/black_cortex_tom_13_ctr_a_11.wav',
        'samples/toms/black_cortex_tom_13_ctr_b_11.wav',
      ]),
    ),
  ),
  ...zones(
    'live',
    'tom-low',
    [41, 43, 45],
    velocityLayers(
      liveLayer([
        'samples/toms/black_cortex_tom_14_ctr_a_03.wav',
        'samples/toms/black_cortex_tom_14_ctr_b_03.wav',
      ]),
      liveLayer([
        'samples/toms/black_cortex_tom_14_ctr_a_08.wav',
        'samples/toms/black_cortex_tom_14_ctr_b_08.wav',
      ]),
    ),
  ),
  ...zones(
    'live',
    'crash',
    [49, 52, 55, 57],
    velocityLayers(
      liveLayer([
        'samples/cymbals/crash_15_sabi_bow_a_02.wav',
        'samples/cymbals/crash_15_sabi_bow_b_02.wav',
      ]),
      liveLayer([
        'samples/cymbals/crash_15_sabi_bow_a_05.wav',
        'samples/cymbals/crash_15_sabi_bow_b_05.wav',
      ]),
    ),
  ),
  ...zones(
    'live',
    'ride',
    [51, 53, 59],
    velocityLayers(
      liveLayer([
        'samples/cymbals/ride_istanbul_agop_sigature_bow_a_03.wav',
        'samples/cymbals/ride_istanbul_agop_sigature_bow_b_03.wav',
      ]),
      liveLayer([
        'samples/cymbals/ride_istanbul_agop_sigature_bow_a_07.wav',
        'samples/cymbals/ride_istanbul_agop_sigature_bow_b_07.wav',
      ]),
    ),
  ),
]

const classicVoices = [
  ['kick', [35, 36], 36, 2],
  ['sidestick', [37], 37, 1.5],
  ['snare', [38, 40], 38, 2],
  ['clap', [39], 39, 2],
  ['tom-low', [41, 43, 45], 45, 2],
  ['hh-closed', [42], 42, 1.5],
  ['hh-pedal', [44], 44, 1.5],
  ['hh-open', [46], 46, 4],
  ['tom-mid', [47], 47, 2],
  ['tom-high', [48, 50], 50, 2],
  ['crash', [49, 52, 55, 57], 49, 7],
  ['ride', [51, 53, 59], 51, 7],
]

const classicZones = classicVoices.flatMap(
  ([articulation, gmKeys, midi, tailSeconds]) =>
    [
      { velocityMin: 1, velocityMax: 80, renderVelocity: 58 },
      { velocityMin: 81, velocityMax: 127, renderVelocity: 112 },
    ].map((layer, layerIndex) => ({
      kitId: 'classic-gm',
      articulation,
      gmKeys,
      layer: layerIndex + 1,
      roundRobin: 1,
      chokeGroup: articulation === 'hh-open' ? 'hi-hat-open' : null,
      chokes:
        articulation === 'hh-closed' || articulation === 'hh-pedal'
          ? ['hi-hat-open']
          : [],
      velocityMin: layer.velocityMin,
      velocityMax: layer.velocityMax,
      sourceKind: 'sonivox',
      sourceCommit: '@coderline/alphatab@1.8.3',
      sourcePath: 'dist/soundfont/sonivox.sf3',
      midi,
      renderVelocity: layer.renderVelocity,
      tailSeconds,
    })),
)

const allZones = Object.freeze([...classicZones, ...studioZones, ...liveZones])

function variableLength(value) {
  const bytes = [value & 0x7f]
  let remaining = value >>> 7
  while (remaining > 0) {
    bytes.unshift((remaining & 0x7f) | 0x80)
    remaining >>>= 7
  }
  return bytes
}

function midiFile(gmKey, velocity, tailSeconds) {
  const division = 480
  const ticksPerSecond = 960
  const tailTicks = Math.max(division, Math.round(tailSeconds * ticksPerSecond))
  const track = Uint8Array.from([
    0x00,
    0xff,
    0x51,
    0x03,
    0x07,
    0xa1,
    0x20,
    0x00,
    0x99,
    gmKey,
    velocity,
    ...variableLength(96),
    0x89,
    gmKey,
    0x00,
    ...variableLength(tailTicks),
    0xff,
    0x2f,
    0x00,
  ])
  const header = Uint8Array.from([
    0x4d,
    0x54,
    0x68,
    0x64,
    0x00,
    0x00,
    0x00,
    0x06,
    0x00,
    0x00,
    0x00,
    0x01,
    division >> 8,
    division & 0xff,
    0x4d,
    0x54,
    0x72,
    0x6b,
    (track.byteLength >>> 24) & 0xff,
    (track.byteLength >>> 16) & 0xff,
    (track.byteLength >>> 8) & 0xff,
    track.byteLength & 0xff,
  ])
  return Buffer.concat([header, track])
}

async function downloadSource(zone, cacheDirectory) {
  const cacheKey = sha256(`${zone.sourceCommit}:${zone.sourcePath}`)
  const extension =
    zone.sourcePath.endsWith('.flac') === true ? '.flac' : '.wav'
  const target = join(cacheDirectory, `${cacheKey}${extension}`)
  if (existsSync(target)) return target
  const response = await globalThis.fetch(zone.sourceUrl, {
    headers: { 'user-agent': 'MercuryPitch-drum-kit-curator/1' },
  })
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${zone.sourcePath} (${response.status} ${response.statusText})`,
    )
  }
  const data = Buffer.from(await response.arrayBuffer())
  if (data.byteLength < 512) {
    throw new Error(`Source sample is unexpectedly small: ${zone.sourcePath}`)
  }
  writeFileSync(target, data)
  return target
}

function renderSonivox(zone, workDirectory) {
  const midiPath = join(
    workDirectory,
    `sonivox-${zone.midi}-${zone.renderVelocity}.mid`,
  )
  const wavePath = join(
    workDirectory,
    `sonivox-${zone.midi}-${zone.renderVelocity}.wav`,
  )
  writeFileSync(
    midiPath,
    midiFile(zone.midi, zone.renderVelocity, zone.tailSeconds),
  )
  run('fluidsynth', [
    '-ni',
    '-C',
    'no',
    '-R',
    'no',
    '-g',
    '1',
    '-T',
    'wav',
    '-O',
    's16',
    '-F',
    wavePath,
    '-r',
    '48000',
    sonivoxPath,
    midiPath,
  ])
  return wavePath
}

function slugForZone(zone) {
  return `${zone.articulation}-l${zone.layer}-rr${zone.roundRobin}`
}

function dbToGain(decibels) {
  return 10 ** (decibels / 20)
}

function gainToDb(gain) {
  if (!Number.isFinite(gain) || gain <= 0) return Number.NEGATIVE_INFINITY
  return 20 * Math.log10(gain)
}

let analysisSequence = 0

function analyzeAudio(inputPath, workDirectory, label) {
  const pcmPath = join(
    workDirectory,
    `analysis-${++analysisSequence}-${label}.f32le`,
  )
  run('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    inputPath,
    '-map_metadata',
    '-1',
    '-vn',
    '-ar',
    String(SAMPLE_RATE),
    '-ac',
    String(CHANNELS),
    '-codec:a',
    'pcm_f32le',
    '-f',
    'f32le',
    pcmPath,
  ])
  const data = readFileSync(pcmPath)
  rmSync(pcmPath, { force: true })
  if (data.byteLength === 0 || data.byteLength % (4 * CHANNELS) !== 0) {
    throw new Error(`Invalid decoded PCM for ${label}`)
  }
  const copied = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  )
  const samples = new Float32Array(copied)
  const sampleFrames = samples.length / CHANNELS
  const samplesPerFrame = Math.max(1, Math.round(SAMPLE_RATE / 1_000))
  const millisecondsPerFrame = (samplesPerFrame / SAMPLE_RATE) * 1_000
  const frameCount = Math.ceil(sampleFrames / samplesPerFrame)
  const framePeaks = new Float32Array(frameCount)
  let fullPeak = 0
  for (let frame = 0; frame < frameCount; frame += 1) {
    const firstSample = frame * samplesPerFrame * CHANNELS
    const finalSample = Math.min(
      samples.length,
      (frame + 1) * samplesPerFrame * CHANNELS,
    )
    let framePeak = 0
    for (let index = firstSample; index < finalSample; index += 1) {
      const amplitude = Math.abs(samples[index])
      if (amplitude > framePeak) framePeak = amplitude
    }
    framePeaks[frame] = framePeak
    if (framePeak > fullPeak) fullPeak = framePeak
  }

  const firstWindowFrames = Math.min(
    framePeaks.length,
    Math.ceil(TRANSIENT_WINDOW_MS),
  )
  let firstWindowPeak = 0
  for (let frame = 0; frame < firstWindowFrames; frame += 1) {
    if (framePeaks[frame] > firstWindowPeak) {
      firstWindowPeak = framePeaks[frame]
    }
  }
  if (firstWindowPeak <= 0) {
    throw new Error(`No audible transient found in ${label}`)
  }

  const hardThreshold = dbToGain(HARD_ONSET_THRESHOLD_DB)
  let hardOnsetFrame = framePeaks.findIndex((peak) => peak > hardThreshold)
  if (hardOnsetFrame < 0) hardOnsetFrame = framePeaks.length

  const transientThreshold = Math.max(
    dbToGain(TRANSIENT_FLOOR_DB),
    firstWindowPeak * dbToGain(TRANSIENT_RELATIVE_DB),
  )
  let transientOnsetFrame = -1
  let consecutiveFrames = 0
  for (let frame = 0; frame < framePeaks.length; frame += 1) {
    if (framePeaks[frame] >= transientThreshold) consecutiveFrames += 1
    else consecutiveFrames = 0
    if (consecutiveFrames >= 2) {
      transientOnsetFrame = frame - 1
      break
    }
  }
  if (transientOnsetFrame < 0) {
    throw new Error(`No stable transient onset found in ${label}`)
  }
  let transientPeak = 0
  const transientEndFrame = Math.min(
    framePeaks.length,
    transientOnsetFrame + Math.ceil(TRANSIENT_WINDOW_MS),
  )
  for (let frame = transientOnsetFrame; frame < transientEndFrame; frame += 1) {
    if (framePeaks[frame] > transientPeak) transientPeak = framePeaks[frame]
  }
  const rmsDb = (firstSampleFrame, finalSampleFrame) => {
    const firstSample = Math.max(0, firstSampleFrame * CHANNELS)
    const finalSample = Math.min(samples.length, finalSampleFrame * CHANNELS)
    if (finalSample <= firstSample) return null
    let sumSquares = 0
    for (let index = firstSample; index < finalSample; index += 1) {
      sumSquares += samples[index] ** 2
    }
    const rms = Math.sqrt(sumSquares / (finalSample - firstSample))
    return rms > 0 ? gainToDb(rms) : null
  }
  const transientFirstSampleFrame = transientOnsetFrame * samplesPerFrame
  const transientFinalSampleFrame = Math.min(
    sampleFrames,
    transientEndFrame * samplesPerFrame,
  )
  const noiseFloorDb =
    transientFirstSampleFrame >=
    Math.ceil((MINIMUM_NOISE_WINDOW_MS / 1_000) * SAMPLE_RATE)
      ? rmsDb(0, transientFirstSampleFrame)
      : null
  return {
    hardOnsetMs: hardOnsetFrame * millisecondsPerFrame,
    transientOnsetMs: transientOnsetFrame * millisecondsPerFrame,
    transientPeakDb: gainToDb(transientPeak),
    fullPeakDb: gainToDb(fullPeak),
    transientPowerDb: rmsDb(
      transientFirstSampleFrame,
      transientFinalSampleFrame,
    ),
    noiseFloorDb,
  }
}

function assertOnsetContract(analysis, label) {
  if (
    analysis.hardOnsetMs > MAXIMUM_ONSET_MS ||
    analysis.transientOnsetMs > MAXIMUM_ONSET_MS
  ) {
    throw new Error(
      `Onset contract failed for ${label}: hard ${analysis.hardOnsetMs.toFixed(2)} ms, transient ${analysis.transientOnsetMs.toFixed(2)} ms`,
    )
  }
}

function encodeSample(inputPath, outputPath, trimStartMs) {
  run('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    inputPath,
    '-af',
    `atrim=start=${(trimStartMs / 1_000).toFixed(6)},asetpts=PTS-STARTPTS`,
    '-map_metadata',
    '-1',
    '-vn',
    '-ar',
    String(SAMPLE_RATE),
    '-ac',
    String(CHANNELS),
    '-codec:a',
    'libmp3lame',
    '-b:a',
    BITRATE,
    '-id3v2_version',
    '3',
    outputPath,
  ])
}

async function curateZone(zone, workDirectory, outputRoot) {
  const sourcePath =
    zone.sourceKind === 'sonivox'
      ? renderSonivox(zone, workDirectory)
      : await downloadSource(zone, workDirectory)
  const sourceData = readFileSync(sourcePath)
  const sourceSha256 =
    zone.sourceKind === 'sonivox' ? SONIVOX_SHA256 : sha256(sourceData)
  const temporaryOutput = join(
    workDirectory,
    `${zone.kitId}-${slugForZone(zone)}.mp3`,
  )
  const sourceAnalysis = analyzeAudio(
    sourcePath,
    workDirectory,
    `${zone.kitId}-${slugForZone(zone)}-source`,
  )
  let trimStartMs = Math.max(
    0,
    sourceAnalysis.transientOnsetMs - ONSET_PREROLL_MS,
  )
  let analysis = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    encodeSample(sourcePath, temporaryOutput, trimStartMs)
    analysis = analyzeAudio(
      temporaryOutput,
      workDirectory,
      `${zone.kitId}-${slugForZone(zone)}-encoded-${attempt + 1}`,
    )
    if (
      analysis.hardOnsetMs <= MAXIMUM_ONSET_MS &&
      analysis.transientOnsetMs <= MAXIMUM_ONSET_MS
    ) {
      break
    }
    trimStartMs += Math.max(
      0,
      Math.max(analysis.hardOnsetMs, analysis.transientOnsetMs) -
        ONSET_PREROLL_MS,
    )
  }
  assertOnsetContract(analysis, `${zone.kitId}:${slugForZone(zone)}`)
  const encoded = readFileSync(temporaryOutput)
  const encodedSha256 = sha256(encoded)
  const fileName = `${encodedSha256.slice(0, 16)}-${slugForZone(zone)}.mp3`
  const relativePath = `${zone.kitId}/${KIT_VERSION}/${fileName}`
  const destination = resolve(outputRoot, relativePath)
  ensureDirectory(dirname(destination))
  copyFileSync(temporaryOutput, destination)
  const rendering =
    zone.sourceKind === 'sonivox'
      ? `Rendered by FluidSynth ${EXPECTED_FLUIDSYNTH_VERSION} from GM channel 10 note ${zone.midi} at velocity ${zone.renderVelocity}, 48 kHz signed 16-bit WAV, gain 1, chorus off, and reverb off; decoded by FFmpeg ${EXPECTED_FFMPEG_VERSION}`
      : `Decoded by FFmpeg ${EXPECTED_FFMPEG_VERSION}`
  return {
    id: `${zone.kitId}:${slugForZone(zone)}`,
    kitId: zone.kitId,
    articulation: zone.articulation,
    gmKeys: zone.gmKeys,
    velocityMin: zone.velocityMin,
    velocityMax: zone.velocityMax,
    roundRobin: zone.roundRobin,
    chokeGroup: zone.chokeGroup,
    chokes: zone.chokes,
    path: relativePath,
    mimeType: 'audio/mpeg',
    encodedBytes: encoded.byteLength,
    sha256: encodedSha256,
    playbackGain: 1,
    source: {
      commit: zone.sourceCommit,
      path: zone.sourcePath,
      sha256: sourceSha256,
      transforms: `${rendering}; onset-aligned with ${trimStartMs.toFixed(3)} ms removed and ${ONSET_PREROLL_MS} ms transient pre-roll retained, resampled to ${SAMPLE_RATE} Hz stereo, and encoded as ${BITRATE} MP3. The decay tail is preserved and no dynamic normalization is baked into the audio.`,
    },
    analysis,
  }
}

function calibrateResources(resources) {
  return calibrateDrumKitResources(resources)
}

function sampleStatus(resources) {
  if (
    resources.some((resource) => resource.readiness === 'fallback') === true
  ) {
    return 'fallback'
  }
  if (resources.some((resource) => resource.readiness === 'reduced') === true) {
    return 'reduced'
  }
  return 'ready'
}

function generatedCatalog(resources) {
  const grouped = Object.groupBy(resources, (resource) => resource.kitId)
  return {
    schemaVersion: 2,
    generatedBy: 'scripts/curate-drum-night-kits.mjs',
    toolchain: {
      ffmpeg: EXPECTED_FFMPEG_VERSION,
      fluidsynth: EXPECTED_FLUIDSYNTH_VERSION,
      fluidsynthChorus: false,
      fluidsynthReverb: false,
      fluidsynthGain: 1,
      fluidsynthRenderSampleRate: 48_000,
      fluidsynthRenderFormat: 's16',
    },
    audio: {
      mimeType: 'audio/mpeg',
      sampleRate: SAMPLE_RATE,
      channels: CHANNELS,
      bitrate: BITRATE,
    },
    calibration: {
      hardOnsetThresholdDb: HARD_ONSET_THRESHOLD_DB,
      transientFloorDb: TRANSIENT_FLOOR_DB,
      transientRelativeDb: TRANSIENT_RELATIVE_DB,
      maximumOnsetMs: MAXIMUM_ONSET_MS,
      onsetPrerollMs: ONSET_PREROLL_MS,
      transientWindowMs: TRANSIENT_WINDOW_MS,
      minimumNoiseWindowMs: MINIMUM_NOISE_WINDOW_MS,
      ...drumKitCalibrationMetadata(),
    },
    kits: {
      'mercury-synth': {
        version: KIT_VERSION,
        sampleStatus: 'ready',
        publishedEncodedBytes: 0,
        resources: [],
      },
      'classic-gm': {
        version: KIT_VERSION,
        sampleStatus: sampleStatus(grouped['classic-gm'] ?? []),
        publishedEncodedBytes: (grouped['classic-gm'] ?? []).reduce(
          (sum, resource) => sum + resource.encodedBytes,
          0,
        ),
        resources: grouped['classic-gm'] ?? [],
      },
      studio: {
        version: KIT_VERSION,
        sampleStatus: sampleStatus(grouped.studio ?? []),
        publishedEncodedBytes: (grouped.studio ?? []).reduce(
          (sum, resource) => sum + resource.encodedBytes,
          0,
        ),
        resources: grouped.studio ?? [],
      },
      live: {
        version: KIT_VERSION,
        sampleStatus: sampleStatus(grouped.live ?? []),
        publishedEncodedBytes: (grouped.live ?? []).reduce(
          (sum, resource) => sum + resource.encodedBytes,
          0,
        ),
        resources: grouped.live ?? [],
      },
    },
  }
}

function applyCalibrationToCatalog(catalog, calibration) {
  const calibratedById = new Map(
    projectCalibratedResources(calibration.resources).map((resource) => [
      resource.id,
      resource,
    ]),
  )
  const kits = Object.fromEntries(
    Object.entries(catalog.kits).map(([kitId, kit]) => {
      if (kitId === 'mercury-synth') {
        return [kitId, { ...kit, sampleStatus: 'ready' }]
      }
      const resources = kit.resources.map((resource) => {
        const calibrated = calibratedById.get(resource.id)
        if (calibrated === undefined) {
          throw new Error(`Missing Drum Night calibration: ${resource.id}`)
        }
        const { power: _previousPower, ...withoutPower } = resource
        return {
          ...withoutPower,
          playbackGain: calibrated.playbackGain,
          readiness: calibrated.readiness,
          ...(calibrated.power === undefined
            ? {}
            : { power: calibrated.power }),
        }
      })
      return [
        kitId,
        {
          ...kit,
          sampleStatus: sampleStatus(
            calibration.resources.filter(
              (resource) => resource.kitId === kitId,
            ),
          ),
          resources,
        },
      ]
    }),
  )
  return {
    ...catalog,
    calibration: {
      hardOnsetThresholdDb: HARD_ONSET_THRESHOLD_DB,
      transientFloorDb: TRANSIENT_FLOOR_DB,
      transientRelativeDb: TRANSIENT_RELATIVE_DB,
      maximumOnsetMs: MAXIMUM_ONSET_MS,
      onsetPrerollMs: ONSET_PREROLL_MS,
      transientWindowMs: TRANSIENT_WINDOW_MS,
      minimumNoiseWindowMs: MINIMUM_NOISE_WINDOW_MS,
      ...drumKitCalibrationMetadata(),
    },
    kits,
  }
}

async function writeGeneratedMetadata(
  catalog,
  calibrationReport,
  sourceCatalogPath,
  runtimeProjectionPath,
  opusProjectionPath,
  calibrationReportPath,
  outputRoot,
) {
  const [serialized, serializedReport, projections] = await Promise.all([
    serializeDrumKitGeneratedJson(catalog),
    serializeDrumKitGeneratedJson(calibrationReport),
    serializeDrumKitCatalogProjections(catalog),
  ])
  ensureDirectory(dirname(sourceCatalogPath))
  ensureDirectory(dirname(calibrationReportPath))
  ensureDirectory(outputRoot)
  writeFileSync(sourceCatalogPath, serialized)
  writeFileSync(runtimeProjectionPath, projections.runtime)
  writeFileSync(opusProjectionPath, projections.opus)
  writeFileSync(calibrationReportPath, serializedReport)
  writeFileSync(resolve(outputRoot, 'catalog.json'), serialized)
}

function listFiles(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isSymbolicLink()) {
      throw new Error(
        `Symlinks are forbidden in Drum Night kit assets: ${path}`,
      )
    }
    if (entry.isDirectory()) return listFiles(path)
    if (!entry.isFile()) {
      throw new Error(`Unsupported Drum Night kit asset type: ${path}`)
    }
    return [path]
  })
}

function assertPublishableObjectKey(objectKey) {
  if (
    objectKey === 'catalog.json' ||
    objectKey === 'README.md' ||
    /^(classic-gm|studio|live)\/LICENSE\.md$/.test(objectKey) ||
    objectKey === 'classic-gm/APACHE-2.0.txt' ||
    objectKey === 'classic-gm/SONIVOX-NOTICE.txt' ||
    /^(classic-gm|studio|live)\/v[1-9]\d*\/[a-f0-9]{16}-[a-z0-9-]+\.(?:mp3|opus)$/.test(
      objectKey,
    )
  ) {
    return
  }
  throw new Error(`Unsafe Drum Night publish object: ${objectKey}`)
}

function publishPlanData(outputRoot) {
  const outputPlanPath = resolve(outputRoot, 'publish-plan.json')
  const objects = listFiles(outputRoot)
    .filter((path) => path !== outputPlanPath)
    .map((path) => {
      const data = readFileSync(path)
      const objectKey = relative(outputRoot, path).replaceAll('\\', '/')
      assertPublishableObjectKey(objectKey)
      const mimeType =
        path.endsWith('.mp3') === true
          ? 'audio/mpeg'
          : path.endsWith('.opus') === true
            ? DRUM_KIT_OPUS_MIME_TYPE
            : path.endsWith('.json') === true
              ? 'application/json'
              : path.endsWith('.txt') === true
                ? 'text/plain; charset=utf-8'
                : 'text/markdown; charset=utf-8'
      return {
        objectKey,
        localPath: relative(repo, resolve(publicRoot, objectKey)).replaceAll(
          '\\',
          '/',
        ),
        encodedBytes: data.byteLength,
        sha256: sha256(data),
        mimeType,
        cacheControl:
          path.endsWith('.mp3') === true || path.endsWith('.opus') === true
            ? CACHE_CONTROL
            : 'public, max-age=300',
      }
    })
    .sort((left, right) => left.objectKey.localeCompare(right.objectKey))
  const plan = {
    schemaVersion: 1,
    generatedBy: 'scripts/curate-drum-night-kits.mjs --publish-plan',
    executesUploads: false,
    configurableBaseExample: 'https://media.mercurypitch.com/drum-night/kits/',
    note: 'Review this object list, bucket, domain, CORS, and cache headers before translating it into any Cloudflare upload command.',
    totalBytes: objects.reduce((sum, object) => sum + object.encodedBytes, 0),
    objects,
  }
  return plan
}

function makePublishPlan(outputRoot) {
  const plan = publishPlanData(outputRoot)
  writeFileSync(
    resolve(outputRoot, 'publish-plan.json'),
    `${JSON.stringify(plan, null, 2)}\n`,
  )
  return plan
}

function copyStaticPublicFiles(outputRoot) {
  for (const relativePath of STATIC_PUBLIC_FILES) {
    const source = resolve(publicRoot, relativePath)
    const destination = resolve(outputRoot, relativePath)
    if (
      !source.startsWith(`${publicRoot}/`) ||
      !destination.startsWith(`${outputRoot}/`) ||
      !existsSync(source) ||
      !lstatSync(source).isFile() ||
      lstatSync(source).isSymbolicLink()
    ) {
      throw new Error(`Missing or unsafe static kit asset: ${relativePath}`)
    }
    ensureDirectory(dirname(destination))
    copyFileSync(source, destination)
  }
}

function installCuratedTree(stagedPublicRoot, stagedSourceFiles) {
  const backupPublicRoot = resolve(
    dirname(publicRoot),
    `.drum-kits-backup-${process.pid}`,
  )
  const sourceFiles = stagedSourceFiles.map(
    ({ stagedPath, destinationPath }) => ({
      stagedPath,
      destinationPath,
      backupPath: `${destinationPath}.backup-${process.pid}`,
      backedUp: false,
      installed: false,
    }),
  )
  if (existsSync(backupPublicRoot)) {
    throw new Error(
      `Refusing to overwrite transaction backup: ${backupPublicRoot}`,
    )
  }
  for (const file of sourceFiles) {
    if (!existsSync(file.stagedPath) || existsSync(file.backupPath)) {
      throw new Error(
        `Missing staged metadata or stale transaction backup: ${file.destinationPath}`,
      )
    }
  }
  let originalMoved = false
  let stagedInstalled = false
  try {
    renameSync(publicRoot, backupPublicRoot)
    originalMoved = true
    for (const file of sourceFiles) {
      if (!existsSync(file.destinationPath)) continue
      renameSync(file.destinationPath, file.backupPath)
      file.backedUp = true
    }
    renameSync(stagedPublicRoot, publicRoot)
    stagedInstalled = true
    for (const file of sourceFiles) {
      renameSync(file.stagedPath, file.destinationPath)
      file.installed = true
    }
  } catch (error) {
    for (const file of [...sourceFiles].reverse()) {
      if (file.installed === true && existsSync(file.destinationPath)) {
        renameSync(file.destinationPath, file.stagedPath)
      }
      if (file.backedUp === true && existsSync(file.backupPath)) {
        renameSync(file.backupPath, file.destinationPath)
      }
    }
    if (stagedInstalled && existsSync(publicRoot)) {
      renameSync(publicRoot, stagedPublicRoot)
    }
    if (originalMoved && existsSync(backupPublicRoot)) {
      renameSync(backupPublicRoot, publicRoot)
    }
    throw error
  }
  rmSync(backupPublicRoot, { recursive: true, force: true })
  for (const file of sourceFiles) {
    rmSync(file.backupPath, { force: true })
  }
}

function assertRequiredPublicFiles(outputRoot) {
  const requiredFiles = [
    ...STATIC_PUBLIC_FILES,
    'classic-gm/SONIVOX-NOTICE.txt',
  ]
  for (const relativePath of requiredFiles) {
    const path = resolve(outputRoot, relativePath)
    if (
      path.startsWith(`${outputRoot}/`) !== true ||
      !existsSync(path) ||
      !lstatSync(path).isFile() ||
      lstatSync(path).isSymbolicLink()
    ) {
      throw new Error(`Missing or unsafe required kit asset: ${relativePath}`)
    }
  }
  const shippedNotice = readFileSync(
    resolve(outputRoot, 'classic-gm/SONIVOX-NOTICE.txt'),
  )
  if (
    !existsSync(sonivoxLicensePath) ||
    !shippedNotice.equals(readFileSync(sonivoxLicensePath))
  ) {
    throw new Error('The shipped SONiVOX package notice is not byte-identical')
  }
}

function assertResourceProvenance(resource, zone) {
  const rendering =
    zone.sourceKind === 'sonivox'
      ? `Rendered by FluidSynth ${EXPECTED_FLUIDSYNTH_VERSION} from GM channel 10 note ${zone.midi} at velocity ${zone.renderVelocity}, 48 kHz signed 16-bit WAV, gain 1, chorus off, and reverb off; decoded by FFmpeg ${EXPECTED_FFMPEG_VERSION}`
      : `Decoded by FFmpeg ${EXPECTED_FFMPEG_VERSION}`
  const transformPrefix = `${rendering}; onset-aligned with `
  const transformSuffix = ` ms removed and ${ONSET_PREROLL_MS} ms transient pre-roll retained, resampled to ${SAMPLE_RATE} Hz stereo, and encoded as ${BITRATE} MP3. The decay tail is preserved and no dynamic normalization is baked into the audio.`
  const trimMatch = /onset-aligned with (\d+\.\d{3}) ms removed/.exec(
    resource.source.transforms,
  )
  if (
    resource.kitId !== zone.kitId ||
    resource.articulation !== zone.articulation ||
    JSON.stringify(resource.gmKeys) !== JSON.stringify(zone.gmKeys) ||
    resource.velocityMin !== zone.velocityMin ||
    resource.velocityMax !== zone.velocityMax ||
    resource.roundRobin !== zone.roundRobin ||
    resource.chokeGroup !== zone.chokeGroup ||
    JSON.stringify(resource.chokes) !== JSON.stringify(zone.chokes) ||
    resource.source.commit !== zone.sourceCommit ||
    resource.source.path !== zone.sourcePath ||
    /^[a-f0-9]{64}$/.test(resource.source.sha256) !== true ||
    (zone.sourceKind === 'sonivox' &&
      resource.source.sha256 !== SONIVOX_SHA256) ||
    resource.source.transforms.startsWith(transformPrefix) !== true ||
    resource.source.transforms.endsWith(transformSuffix) !== true ||
    trimMatch === null ||
    !Number.isFinite(Number(trimMatch[1])) ||
    Number(trimMatch[1]) < 0
  ) {
    throw new Error(`Pinned source provenance drifted: ${resource.id}`)
  }
}

async function verifyGeneratedProjections(
  catalog,
  runtimeProjectionPath,
  opusProjectionPath,
) {
  const projections = await serializeDrumKitCatalogProjections(catalog)
  if (
    !existsSync(runtimeProjectionPath) ||
    readFileSync(runtimeProjectionPath, 'utf8') !== projections.runtime
  ) {
    throw new Error('Generated Drum Night runtime projection drifted')
  }
  if (
    !existsSync(opusProjectionPath) ||
    readFileSync(opusProjectionPath, 'utf8') !== projections.opus
  ) {
    throw new Error('Generated Drum Night Opus projection drifted')
  }
}

function analyzeCatalogResources(catalog, outputRoot) {
  let totalBytes = 0
  const analyzedResources = []
  const expectedZones = new Map(
    allZones.map((zone) => [`${zone.kitId}:${slugForZone(zone)}`, zone]),
  )
  const verifiedResourceIds = new Set()
  const verificationDirectory = mkdtempSync(
    join(tmpdir(), 'mercurypitch-drum-kit-check-'),
  )
  try {
    for (const [kitId, kit] of Object.entries(catalog.kits)) {
      let kitBytes = 0
      for (const resource of kit.resources) {
        const expectedZone = expectedZones.get(resource.id)
        if (
          expectedZone === undefined ||
          verifiedResourceIds.has(resource.id)
        ) {
          throw new Error(
            `Unexpected or duplicate kit resource: ${resource.id}`,
          )
        }
        assertResourceProvenance(resource, expectedZone)
        verifiedResourceIds.add(resource.id)
        const path = resolve(outputRoot, resource.path)
        const expectedPrefix = `${kitId}/${kit.version}/`
        if (
          !path.startsWith(`${outputRoot}/`) ||
          resource.path.startsWith(expectedPrefix) !== true ||
          !existsSync(path) ||
          !lstatSync(path).isFile() ||
          lstatSync(path).isSymbolicLink()
        ) {
          throw new Error(
            `Missing or unsafe drum kit resource: ${resource.path}`,
          )
        }
        const data = readFileSync(path)
        if (data.byteLength !== resource.encodedBytes) {
          throw new Error(`Size mismatch: ${resource.path}`)
        }
        const resourceHash = sha256(data)
        if (resourceHash !== resource.sha256) {
          throw new Error(`SHA-256 mismatch: ${resource.path}`)
        }
        const fileName = resource.path.slice(resource.path.lastIndexOf('/') + 1)
        if (fileName.startsWith(`${resourceHash.slice(0, 16)}-`) !== true) {
          throw new Error(`Content hash filename mismatch: ${resource.path}`)
        }
        if (data.byteLength > 2 * 1024 * 1024) {
          throw new Error(`Per-resource budget exceeded: ${resource.path}`)
        }
        const mp3Analysis = analyzeAudio(
          path,
          verificationDirectory,
          `${resource.id.replaceAll(':', '-')}-mp3`,
        )
        const opusFormat = resource.formats?.opus
        const opusPath = resolve(outputRoot, opusFormat?.path ?? '')
        if (
          typeof opusFormat?.path !== 'string' ||
          opusFormat.path.endsWith('.opus') !== true ||
          !opusPath.startsWith(`${outputRoot}/`) ||
          !existsSync(opusPath) ||
          !lstatSync(opusPath).isFile() ||
          lstatSync(opusPath).isSymbolicLink()
        ) {
          throw new Error(`Missing or unsafe Opus resource: ${resource.id}`)
        }
        const opusAnalysis = analyzeAudio(
          opusPath,
          verificationDirectory,
          `${resource.id.replaceAll(':', '-')}-opus`,
        )
        const codecDelta = Object.fromEntries(
          ['transientPeakDb', 'fullPeakDb', 'transientPowerDb'].map((field) => [
            field,
            opusAnalysis[field] - mp3Analysis[field],
          ]),
        )
        analyzedResources.push({
          ...resource,
          analysis: {
            ...mp3Analysis,
            codecs: {
              mp3: mp3Analysis,
              opus: opusAnalysis,
              opusMinusMp3: codecDelta,
            },
          },
        })
        kitBytes += data.byteLength
      }
      if (kitBytes !== kit.publishedEncodedBytes) {
        throw new Error(`Kit byte total does not match its manifest: ${kitId}`)
      }
      totalBytes += kitBytes
    }
    if (verifiedResourceIds.size !== expectedZones.size) {
      throw new Error(
        `Kit resource closure mismatch: expected ${expectedZones.size}, verified ${verifiedResourceIds.size}`,
      )
    }
    return { analyzedResources, totalBytes }
  } finally {
    rmSync(verificationDirectory, { recursive: true, force: true })
  }
}

function assertCatalogCalibrationMatches(catalog, calibration) {
  const expectedById = new Map(
    projectCalibratedResources(calibration.resources).map((resource) => [
      resource.id,
      resource,
    ]),
  )
  for (const [kitId, kit] of Object.entries(catalog.kits)) {
    if (kitId === 'mercury-synth') {
      if (kit.sampleStatus !== 'ready') {
        throw new Error('Mercury Synth sample status drifted')
      }
      continue
    }
    for (const resource of kit.resources) {
      const expected = expectedById.get(resource.id)
      if (
        expected === undefined ||
        resource.playbackGain !== expected.playbackGain ||
        resource.readiness !== expected.readiness ||
        (resource.power ?? null) !== (expected.power ?? null)
      ) {
        throw new Error(`Drum Night calibration drifted: ${resource.id}`)
      }
    }
    const expectedStatus = sampleStatus(
      calibration.resources.filter((resource) => resource.kitId === kitId),
    )
    if (kit.sampleStatus !== expectedStatus) {
      throw new Error(`Drum Night sample status drifted: ${kitId}`)
    }
  }
}

async function verifyCatalog({
  outputRoot = publicRoot,
  sourceCatalogPath = generatedCatalogPath,
  runtimeProjectionPath = generatedRuntimeProjectionPath,
  opusProjectionPath = generatedOpusProjectionPath,
  calibrationReportPath = generatedCalibrationReportPath,
  requirePublishPlan = true,
} = {}) {
  assertRequiredPublicFiles(outputRoot)
  const outputCatalogPath = resolve(outputRoot, 'catalog.json')
  const outputApacheLicensePath = resolve(
    outputRoot,
    'classic-gm/APACHE-2.0.txt',
  )
  if (!existsSync(outputApacheLicensePath)) {
    throw new Error('The canonical Apache 2.0 license text is missing')
  }
  const apacheLicense = readFileSync(outputApacheLicensePath)
  if (
    apacheLicense.byteLength !== APACHE_LICENSE_BYTES ||
    sha256(apacheLicense) !== APACHE_LICENSE_SHA256
  ) {
    throw new Error(
      `The Apache 2.0 license must be the canonical ${APACHE_LICENSE_BYTES}-byte ASF text (${APACHE_LICENSE_SHA256})`,
    )
  }
  if (!existsSync(sourceCatalogPath) || !existsSync(outputCatalogPath)) {
    throw new Error('Generated drum kit catalogs are missing')
  }
  const generated = readFileSync(sourceCatalogPath)
  const published = readFileSync(outputCatalogPath)
  if (!generated.equals(published)) {
    throw new Error('Source and public drum kit catalogs differ')
  }
  const catalog = JSON.parse(generated.toString('utf8'))
  const expectedCalibrationMetadata = {
    hardOnsetThresholdDb: HARD_ONSET_THRESHOLD_DB,
    transientFloorDb: TRANSIENT_FLOOR_DB,
    transientRelativeDb: TRANSIENT_RELATIVE_DB,
    maximumOnsetMs: MAXIMUM_ONSET_MS,
    onsetPrerollMs: ONSET_PREROLL_MS,
    transientWindowMs: TRANSIENT_WINDOW_MS,
    minimumNoiseWindowMs: MINIMUM_NOISE_WINDOW_MS,
    ...drumKitCalibrationMetadata(),
  }
  if (
    catalog.schemaVersion !== 2 ||
    catalog.toolchain?.ffmpeg !== EXPECTED_FFMPEG_VERSION ||
    catalog.toolchain?.fluidsynth !== EXPECTED_FLUIDSYNTH_VERSION ||
    catalog.toolchain?.fluidsynthChorus !== false ||
    catalog.toolchain?.fluidsynthReverb !== false ||
    catalog.toolchain?.fluidsynthGain !== 1 ||
    catalog.toolchain?.fluidsynthRenderSampleRate !== 48_000 ||
    catalog.toolchain?.fluidsynthRenderFormat !== 's16' ||
    catalog.audio?.sampleRate !== SAMPLE_RATE ||
    catalog.audio?.channels !== CHANNELS ||
    catalog.audio?.bitrate !== BITRATE ||
    catalog.audio?.formats?.mp3?.mimeType !== 'audio/mpeg' ||
    catalog.audio?.formats?.mp3?.sampleRate !== SAMPLE_RATE ||
    catalog.audio?.formats?.mp3?.channels !== CHANNELS ||
    catalog.audio?.formats?.mp3?.bitrate !== BITRATE ||
    catalog.audio?.formats?.opus?.mimeType !== DRUM_KIT_OPUS_MIME_TYPE ||
    catalog.audio?.formats?.opus?.sampleRate !== DRUM_KIT_OPUS_SAMPLE_RATE ||
    catalog.audio?.formats?.opus?.channels !== DRUM_KIT_OPUS_CHANNELS ||
    catalog.audio?.formats?.opus?.bitrate !== DRUM_KIT_OPUS_BITRATE ||
    catalog.audio?.formats?.opus?.vbr !== true ||
    catalog.audio?.formats?.opus?.application !== 'audio' ||
    catalog.audio?.formats?.opus?.frameDurationMs !== 20 ||
    JSON.stringify(catalog.calibration) !==
      JSON.stringify(expectedCalibrationMetadata)
  ) {
    throw new Error(
      'Drum Night catalog toolchain or calibration metadata drifted',
    )
  }
  await verifyGeneratedProjections(
    catalog,
    runtimeProjectionPath,
    opusProjectionPath,
  )

  const opusTotalsByKit = verifyDrumKitOpusCatalog(catalog, outputRoot)
  const { analyzedResources, totalBytes } = analyzeCatalogResources(
    catalog,
    outputRoot,
  )
  const calibration = calibrateResources(analyzedResources)
  assertCatalogCalibrationMatches(catalog, calibration)
  if (!existsSync(calibrationReportPath)) {
    throw new Error('Generated Drum Night calibration report is missing')
  }
  const expectedCalibrationReport = await serializeDrumKitGeneratedJson(
    calibration.report,
  )
  if (
    readFileSync(calibrationReportPath, 'utf8') !== expectedCalibrationReport
  ) {
    throw new Error('Generated Drum Night calibration report drifted')
  }

  const unreferencedAudio = listFiles(outputRoot).filter((path) => {
    if (path.endsWith('.mp3') !== true && path.endsWith('.opus') !== true) {
      return false
    }
    const relativePath = relative(outputRoot, path).replaceAll('\\', '/')
    return (
      Object.values(catalog.kits).some(
        (kit) =>
          kit.resources.some((resource) =>
            Object.values(resource.formats ?? {}).some(
              (format) => format?.path === relativePath,
            ),
          ) === true,
      ) === false
    )
  })
  if (unreferencedAudio.length > 0) {
    throw new Error(`Unreferenced kit assets: ${unreferencedAudio.join(', ')}`)
  }
  if (requirePublishPlan) {
    const outputPlanPath = resolve(outputRoot, 'publish-plan.json')
    if (!existsSync(outputPlanPath)) {
      throw new Error('Drum Night publish plan is missing')
    }
    const actualPlan = JSON.parse(readFileSync(outputPlanPath, 'utf8'))
    const expectedPlan = publishPlanData(outputRoot)
    if (JSON.stringify(actualPlan) !== JSON.stringify(expectedPlan)) {
      throw new Error(
        'Drum Night publish plan does not match exact asset closure',
      )
    }
  }
  return { catalog, opusTotalsByKit, totalBytes }
}

async function recalibrateExistingCatalog() {
  if (!existsSync(generatedCatalogPath)) {
    throw new Error('Generated Drum Night kit catalog is missing')
  }
  const currentCatalog = JSON.parse(readFileSync(generatedCatalogPath, 'utf8'))
  const { analyzedResources } = analyzeCatalogResources(
    currentCatalog,
    publicRoot,
  )
  const calibration = calibrateResources(analyzedResources)
  const catalog = applyCalibrationToCatalog(currentCatalog, calibration)
  await writeGeneratedMetadata(
    catalog,
    calibration.report,
    generatedCatalogPath,
    generatedRuntimeProjectionPath,
    generatedOpusProjectionPath,
    generatedCalibrationReportPath,
    publicRoot,
  )
  makePublishPlan(publicRoot)
  return verifyCatalog()
}

if (checkOnly) {
  assertExpectedToolchain()
  const result = await verifyCatalog()
  globalThis.console.log(
    `verified ${result.totalBytes} encoded bytes across four Drum Night kit manifests`,
  )
  process.exit(0)
}

if (planOnly) {
  assertExpectedToolchain()
  await verifyCatalog({ requirePublishPlan: false })
  const plan = makePublishPlan(publicRoot)
  await verifyCatalog()
  globalThis.console.log(
    `wrote ${relative(repo, publishPlanPath)} with ${plan.objects.length} inert upload records`,
  )
  process.exit(0)
}

if (recalibrateOnly) {
  assertExpectedToolchain()
  const result = await recalibrateExistingCatalog()
  globalThis.console.log(
    `recalibrated and verified ${result.totalBytes} encoded bytes without rewriting licensed audio`,
  )
  process.exit(0)
}

assertExpectedToolchain()
if (!existsSync(sonivoxPath)) {
  throw new Error(
    `Missing SONiVOX SF3 at ${sonivoxPath}; run pnpm install or set SONIVOX_SF3`,
  )
}
if (sha256(readFileSync(sonivoxPath)) !== SONIVOX_SHA256) {
  throw new Error('The SONiVOX SF3 does not match the audited package hash')
}
if (!existsSync(sonivoxLicensePath)) {
  throw new Error('The bundled SONiVOX notice is missing')
}

const workDirectory = mkdtempSync(join(tmpdir(), 'mercurypitch-drum-kits-'))
const stagingDirectory = mkdtempSync(
  join(dirname(publicRoot), '.drum-kits-stage-'),
)
const stagedPublicRoot = resolve(stagingDirectory, 'kits')
const stagedSourceCatalogPath = resolve(
  stagingDirectory,
  'drum-kit-resources.generated.json',
)
const stagedRuntimeProjectionPath = resolve(
  stagingDirectory,
  'drum-kit-runtime.generated.json',
)
const stagedOpusProjectionPath = resolve(
  stagingDirectory,
  'drum-kit-opus.generated.json',
)
const stagedCalibrationReportPath = resolve(
  stagingDirectory,
  'drum-kit-calibration.generated.json',
)
try {
  copyStaticPublicFiles(stagedPublicRoot)
  const resources = []
  for (let index = 0; index < allZones.length; index += 1) {
    const zone = allZones[index]
    globalThis.console.log(
      `[${index + 1}/${allZones.length}] ${zone.kitId} ${slugForZone(zone)}`,
    )
    resources.push(await curateZone(zone, workDirectory, stagedPublicRoot))
  }
  const initialCalibration = calibrateResources(resources)
  const encoded = encodeDrumKitOpusCatalog(
    generatedCatalog(projectCalibratedResources(initialCalibration.resources)),
    {
      inputRoot: stagedPublicRoot,
      outputRoot: stagedPublicRoot,
    },
  )
  const { analyzedResources } = analyzeCatalogResources(
    encoded.catalog,
    stagedPublicRoot,
  )
  const calibration = calibrateResources(analyzedResources)
  const catalog = applyCalibrationToCatalog(encoded.catalog, calibration)
  await writeGeneratedMetadata(
    catalog,
    calibration.report,
    stagedSourceCatalogPath,
    stagedRuntimeProjectionPath,
    stagedOpusProjectionPath,
    stagedCalibrationReportPath,
    stagedPublicRoot,
  )
  copyFileSync(
    sonivoxLicensePath,
    resolve(stagedPublicRoot, 'classic-gm/SONIVOX-NOTICE.txt'),
  )
  makePublishPlan(stagedPublicRoot)
  const result = await verifyCatalog({
    outputRoot: stagedPublicRoot,
    sourceCatalogPath: stagedSourceCatalogPath,
    runtimeProjectionPath: stagedRuntimeProjectionPath,
    opusProjectionPath: stagedOpusProjectionPath,
    calibrationReportPath: stagedCalibrationReportPath,
  })
  installCuratedTree(stagedPublicRoot, [
    {
      stagedPath: stagedSourceCatalogPath,
      destinationPath: generatedCatalogPath,
    },
    {
      stagedPath: stagedRuntimeProjectionPath,
      destinationPath: generatedRuntimeProjectionPath,
    },
    {
      stagedPath: stagedOpusProjectionPath,
      destinationPath: generatedOpusProjectionPath,
    },
    {
      stagedPath: stagedCalibrationReportPath,
      destinationPath: generatedCalibrationReportPath,
    },
  ])
  globalThis.console.log(
    `curated, transactionally installed, and verified ${calibration.resources.length} resources (${result.totalBytes} encoded bytes)`,
  )
} finally {
  rmSync(workDirectory, { recursive: true, force: true })
  rmSync(stagingDirectory, { recursive: true, force: true })
}

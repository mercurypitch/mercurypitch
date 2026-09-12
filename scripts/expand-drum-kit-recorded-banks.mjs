// Expand the approved recorded banks with faithful GM acoustic voices from the same pinned editions.
// Usage: node scripts/expand-drum-kit-recorded-banks.mjs <approved-audition-root>
// Writes private prepared masters and public recipes, not encoded app audio; run --update-recorded next.
import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { format } from 'prettier'
import { crocellReader, muldjordReader, powerLayers, sfzLayers, sha256, xmlAttributes, } from './drum-kit-expanded-sources.mjs'
import { assertRecordedKitNotices } from './drum-kit-recorded-banks.mjs'

const repo = resolve(fileURLToPath(new URL('..', import.meta.url)))
const [auditionRoot] = process.argv.slice(2)
if (!auditionRoot || process.argv.length !== 3)
  throw new Error('Provide the approved audition root')
assertRecordedKitNotices()
const RATE = 48_000
const EXPANSION = 'gm-acoustic-expansion-1'
// These are GM identities, NOT the custom note numbers in the upstream midimaps.
const additions = {
  muldjord: [
    ['KdrumR', 'kick', [35], 'KdrumR'],
    ['Tom3', 'tom-low', [43, 45], 'Tom3'],
    ['Tom2', 'tom-mid', [47], 'Tom2'],
    ['CrashR', 'crash', [57], null],
    ['China', 'crash', [52], null],
    ['RideL', 'ride', [59], null],
    ['RideRBell', 'ride', [53], null],
  ],
  crocell: [
    ['KDrumL', 'kick', [35], 'KDrumOutside'],
    ['SnareRim', 'sidestick', [37], 'SnareTop'],
    ['SnareRimShot', 'snare', [40], 'SnareTop'],
    ['FTom1', 'tom-low', [43, 45], 'FTom1'],
    ['Tom2', 'tom-mid', [47], 'Tom2'],
    ['HihatPedal', 'hh-pedal', [44], 'Hihat'],
    ['RideRBell', 'ride', [53], 'Ride'],
    ['ChinaR', 'crash', [52], null],
    ['SplashL', 'crash', [55], null],
    ['CrashR', 'crash', [57], null],
  ],
}

function renderMix(inputs) {
  const parts = inputs.map((input) => {
    const bytes = execFileSync(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        input.path,
        '-af',
        input.pan,
        '-ar',
        `${RATE}`,
        '-ac',
        '2',
        '-f',
        'f32le',
        'pipe:1',
      ],
      { timeout: 45_000, maxBuffer: 32_000_000 },
    )
    return {
      samples: new Float32Array(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
      ),
      gain: input.gain ?? 1,
    }
  })
  const audio = new Float32Array(
    Math.max(...parts.map((p) => p.samples.length)),
  )
  for (const part of parts)
    for (let i = 0; i < part.samples.length; i += 1)
      audio[i] += part.samples[i] * part.gain
  let peak = 0
  for (const v of audio) peak = Math.max(peak, Math.abs(v))
  if (!Number.isFinite(peak) || peak < 1e-7 || peak >= 1)
    throw new Error(`Silent/clipped prepared mix (${peak})`)
  let onset = 0
  while (onset < audio.length / 2 - 16) {
    let sum = 0
    for (let j = 0; j < 16; j += 1)
      sum += audio[(onset + j) * 2] ** 2 + audio[(onset + j) * 2 + 1] ** 2
    if (Math.sqrt(sum / 32) > peak * 0.001) break
    onset += 1
  }
  const crop = Math.max(0, onset - 144)
  const out = audio.slice(crop * 2)
  const fade = Math.min(240, out.length / 2)
  for (let i = 0; i < fade; i += 1) {
    const gain = 0.5 + 0.5 * Math.cos((Math.PI * (i + 1)) / fade)
    const frame = out.length / 2 - fade + i
    out[frame * 2] *= gain
    out[frame * 2 + 1] *= gain
  }
  const bytes = Buffer.alloc(44 + out.length * 4)
  bytes.write('RIFF')
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(3, 20)
  bytes.writeUInt16LE(2, 22)
  bytes.writeUInt32LE(RATE, 24)
  bytes.writeUInt32LE(RATE * 8, 28)
  bytes.writeUInt16LE(8, 32)
  bytes.writeUInt16LE(32, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(out.length * 4, 40)
  Buffer.from(out.buffer).copy(bytes, 44)
  return { bytes, peak, onset, crop, durationSec: out.length / 2 / RATE }
}

function prepare(
  kitId,
  instrument,
  articulation,
  gmKeys,
  strike,
  inputs,
  evidence,
) {
  const slug = `${articulation}-gm${gmKeys[0]}`
  const id = `${slug}-l${strike.layer}-rr${strike.roundRobin}`
  const preparedPath = `samples/${kitId}/expanded-${id}.wav`
  const mixed = renderMix(inputs)
  const path = resolve(auditionRoot, preparedPath)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, mixed.bytes)
  globalThis.console.log(
    `${kitId} ${instrument} ${id}: ${mixed.durationSec.toFixed(2)}s`,
  )
  return {
    id,
    resourceName: slug,
    gmKey: gmKeys[0],
    gmKeys,
    articulation,
    layer: strike.layer,
    roundRobin: strike.roundRobin,
    velocityMin: strike.lovel,
    velocityMax: strike.hivel,
    preparedPath,
    sha256: sha256(mixed.bytes),
    provenance: {
      expansion: EXPANSION,
      instrument,
      ...evidence,
      sampleRate: RATE,
      channels: 2,
      durationSec: mixed.durationSec,
      peakBeforeFade: mixed.peak,
      detectedOnsetFrames48k: mixed.onset,
      cropFrames48k: mixed.crop,
      fadeOutMs: 5,
      mix: inputs.map((input) => ({
        source: input.source,
        pan: input.pan,
        gain: input.gain ?? 1,
      })),
    },
  }
}

async function expandMuldjord() {
  const reader = await muldjordReader(auditionRoot)
  const prefix = 'DrumGizmo/MuldjordKit'
  const macrosFile = await reader.get(`${prefix}/Data/macro.txt`)
  const macros = Object.fromEntries(
    [
      ...readFileSync(macrosFile.path, 'utf8').matchAll(
        /#define\s+(\$\w+)\s+([^\s]+)/g,
      ),
    ].map((m) => [m[1], m[2]]),
  )
  const mixes = []
  for (const [instrument, articulation, gmKeys, close] of additions.muldjord) {
    const mapping = await reader.get(`${prefix}/Data/region/${instrument}.txt`)
    for (const strike of sfzLayers(
      readFileSync(mapping.path, 'utf8'),
      macros,
    )) {
      const inputs = []
      for (const mic of [...(close ? [close] : []), 'OHL', 'OHR']) {
        const source = await reader.get(
          `${prefix}/Samples/${instrument}/${strike.region_label}-${instrument}-${mic}.flac`,
        )
        inputs.push({
          ...source,
          pan:
            mic === 'OHL'
              ? 'pan=stereo|c0=c0|c1=0*c0'
              : mic === 'OHR'
                ? 'pan=stereo|c0=0*c0|c1=c0'
                : 'pan=stereo|c0=0.707106781*c0|c1=0.707106781*c0',
          gain: close && mic.startsWith('OH') ? 10 ** (-12 / 20) : 1,
        })
      }
      mixes.push(
        prepare('muldjord', instrument, articulation, gmKeys, strike, inputs, {
          mapping: mapping.source,
          macros: macrosFile.source,
          sourceSample: strike.region_label,
          originalOpcodes: strike,
          selection:
            'every-source-velocity-layer-first-two-distinct-sequence-strikes',
        }),
      )
    }
  }
  return mixes
}

async function expandCrocell() {
  const reader = crocellReader(auditionRoot)
  const mixes = []
  for (const [instrument, articulation, gmKeys, close] of additions.crocell) {
    const mapping = await reader.get(
      `CrocellKit/${instrument}/${instrument}.xml`,
    )
    const samples = [
      ...readFileSync(mapping.path, 'utf8').matchAll(
        /<sample\s+([^>]*)>([\s\S]*?)<\/sample>/g,
      ),
    ].map((m) => ({
      ...xmlAttributes(m[1]),
      audio: [...m[2].matchAll(/<audiofile\s+([^>]*)/g)].map((a) =>
        xmlAttributes(a[1]),
      ),
    }))
    // Native multi-mic power does not predict this close/OH mix for the pedal.
    // Measured 250ms mix peaks: soft 3/5 -45.9/-44.5 dBFS, medium 7/10
    // -32.3/-34.5, hard 6/9 -30.8/-30.2. Retain those real dynamic tiers;
    // a fixed +12 dB pedal bus makes its naturally quiet chick usable.
    const strikes =
      instrument === 'HihatPedal'
        ? [
            [3, 5],
            [7, 10],
            [6, 9],
          ].flatMap((ids, layer) =>
            ids.map((id, rr) => ({
              ...samples.find((s) => s.name === `HihatPedal-${id}`),
              lovel: [1, 63, 103][layer],
              hivel: [62, 102, 127][layer],
              layer: layer + 1,
              roundRobin: rr + 1,
            })),
          )
        : powerLayers(samples)
    for (const strike of strikes) {
      const channels = Object.fromEntries(
        strike.audio.map((a) => [a.channel, Number(a.filechannel) - 1]),
      )
      if (
        ['OHLeft', 'OHRight', ...(close ? [close] : [])].some(
          (key) => !Number.isInteger(channels[key]),
        )
      )
        throw new Error(`Unverified mic map: ${instrument}`)
      const selected = strike.audio.find((a) => a.channel === 'OHLeft')
      if (strike.audio.some((a) => a.file !== selected.file))
        throw new Error('Expected an aligned multichannel source')
      const name = `CrocellKit/${instrument}/${selected.file}`.replaceAll(
        '/./',
        '/',
      )
      const source = await reader.get(name)
      const oh = close ? 10 ** (-12 / 20) : 1
      const pan = `pan=stereo|c0=${oh}*c${channels.OHLeft}${close ? `+${Math.SQRT1_2}*c${channels[close]}` : ''}|c1=${oh}*c${channels.OHRight}${close ? `+${Math.SQRT1_2}*c${channels[close]}` : ''}`
      mixes.push(
        prepare(
          'crocell',
          instrument,
          articulation,
          gmKeys,
          strike,
          [
            {
              ...source,
              pan,
              gain: instrument === 'HihatPedal' ? 10 ** (12 / 20) : 1,
            },
          ],
          {
            mapping: mapping.source,
            sourceSample: strike.name,
            sourcePower: Number(strike.power),
            sourceChannels: channels,
            selection:
              instrument === 'HihatPedal'
                ? 'measured-pedal-mix-pairs-soft-3-5-medium-7-10-hard-6-9-fixed-bus-plus-12db'
                : 'adjacent-distinct-source-power-quantiles-20-55-90-percent',
          },
        ),
      )
    }
  }
  return mixes
}

for (const kitId of ['muldjord', 'crocell']) {
  const path = resolve(
    repo,
    'public/drum-night/kits',
    kitId,
    'selected-mixes.json',
  )
  const recipe = JSON.parse(readFileSync(path))
  const original = recipe.mixes.filter(
    (mix) => mix.provenance.expansion !== EXPANSION,
  )
  for (const mix of original) {
    if (
      sha256(readFileSync(resolve(auditionRoot, mix.preparedPath))) !==
      mix.sha256
    )
      throw new Error('Approved core mix changed')
    // Four recorded toms serve the six GM pitches; no pitch shifting or duplicate bytes.
    if (mix.gmKey === 48) mix.gmKeys = [48, 50]
    // Crocell has one ride bow. GM59 intentionally shares it, NOT its native note-59 crash.
    if (kitId === 'crocell' && mix.gmKey === 51) mix.gmKeys = [51, 59]
  }
  recipe.mixes = [
    ...original,
    ...(await (kitId === 'muldjord' ? expandMuldjord() : expandCrocell())),
  ]
  recipe.policy =
    'Approved core mixtures retained; expanded GM acoustic coverage from the same pinned edition. One fixed kit gain; recorded dynamics and distinct strikes, no second velocity gain or per-hit normalization. Crocell pedal has a fixed +12 dB offline instrument-bus gain and measured soft/medium/hard strike pairs. Four toms cover six GM pitches (43/45 and 48/50 share real instruments). Crocell 51/59 share its one ride bow. Unsupported native-map effects are not remapped to unrelated GM instruments.'
  recipe.expansion = {
    version: EXPANSION,
    unavailableGm:
      kitId === 'muldjord'
        ? ['37 sidestick', '40 alternate snare', '44 pedal hat', '55 splash']
        : [],
    nativeOnlyNotMapped:
      kitId === 'muldjord'
        ? [
            'SnareRest (rest noise, not a clap)',
            'RideLBell (second bell; GM53 uses the right bell)',
          ]
        : [
            'ChinaL (second china)',
            'SplashR (second splash)',
            'CrashRXtra (extra crash; not GM59 ride)',
            'CrashLStopped / CrashRStopped (recorded chokes)',
            'HihatSemiOpen / HihatClosedNoPedal / HihatPedalHit (extra openness / pedal splash)',
            'SnareRest (rest noise, not a clap)',
          ],
    note: 'These native-only techniques need an explicit articulation selector. Standard GM clap and auxiliary percussion remain synth/unmapped, never unrelated kit recordings.',
  }
  writeFileSync(path, await format(JSON.stringify(recipe), { parser: 'json' }))
  globalThis.console.log(
    `${kitId}: ${recipe.mixes.length} total recorded strikes`,
  )
}

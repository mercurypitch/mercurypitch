// Independent test receipt: exact fixture bytes go both to Studio and installed FFmpeg ebur128.
import { writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const repo = resolve(process.argv[2] ?? process.cwd())
if (!process.argv[3])
  throw new Error('Pass a registered output directory as the second argument.')
const out = resolve(process.argv[3])
const source = (path: string) => pathToFileURL(join(repo, path)).href
const { createStudioMeter } = await import(
  source('src/lib/studio/metering/stream-meter.ts')
)
const { adversarialPeak, meterTone } = await import(
  source('src/lib/studio/metering/meter.test-fixtures.ts')
)
const { encodeAudioBufferToPcmWav } = await import(
  source('src/lib/audio-buffer-wav.ts')
)
const { measureStudioWav } = await import(
  source('src/lib/studio/export/wav-measure.ts')
)

function wav(channels: Float32Array[], rate: number) {
  const bytes = Buffer.alloc(44 + channels[0].length * channels.length * 4)
  bytes.write('RIFF')
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(3, 20)
  bytes.writeUInt16LE(channels.length, 22)
  bytes.writeUInt32LE(rate, 24)
  bytes.writeUInt32LE(rate * channels.length * 4, 28)
  bytes.writeUInt16LE(channels.length * 4, 32)
  bytes.writeUInt16LE(32, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(bytes.length - 44, 40)
  for (let i = 0; i < channels[0].length; i++)
    for (let c = 0; c < channels.length; c++)
      bytes.writeFloatLE(channels[c][i], 44 + (i * channels.length + c) * 4)
  return bytes
}
const cases: { id: string; rate: number; channels: Float32Array[] }[] = []
for (const rate of [44100, 48000]) {
  for (const [frequency, amplitude, phase] of [
    [997, 0.1, 0],
    [rate / 4, 0.7, Math.PI / 4],
    [rate * 0.45, 0.7, 0.37],
    [60, 0.1, 0],
    [5000, 0.1, 0],
  ]) {
    const tone = meterTone(rate, 4, frequency, amplitude, phase)
    cases.push({ id: `${rate}-${frequency}`, rate, channels: [tone, tone] })
  }
  const tone = meterTone(rate, 4)
  const silent = new Float32Array(tone.length)
  cases.push({ id: `${rate}-one-channel`, rate, channels: [tone, silent] })
  const gated = new Float32Array(tone.length * 2)
  gated.set(tone)
  cases.push({ id: `${rate}-gated`, rate, channels: [gated, gated] })
}
const adversarial = adversarialPeak()
cases.push({
  id: 'adversarial',
  rate: 48000,
  channels: [adversarial, adversarial],
})
for (const rate of [44100, 48000]) {
  for (const fraction of [0.05, 0.1, 0.2, 0.25, 0.35, 0.4, 0.45, 0.475, 0.49]) {
    for (const phase of [0, Math.PI / 8, Math.PI / 4, Math.PI / 2]) {
      const tone = meterTone(rate, 0.1, rate * fraction, 0.7, phase)
      cases.push({
        id: `edge-${rate}-${fraction}-${phase.toFixed(3)}`,
        rate,
        channels: [tone, tone],
      })
    }
  }
}
const receipts = []
for (const fixture of cases) {
  const path = join(out, `meter-${fixture.id}.wav`)
  writeFileSync(path, wav(fixture.channels, fixture.rate))
  const meter = createStudioMeter({
    sampleRate: fixture.rate,
    channels: 2,
    maxFrames: fixture.channels[0].length,
    truePeak: true,
  })
  meter.push(fixture.channels)
  const own = meter.finish()
  let stderr = ''
  const { spawnSync } = await import('node:child_process')
  const result = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostats',
      '-i',
      path,
      '-af',
      'ebur128=peak=true',
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8' },
  )
  if (result.status !== 0) throw new Error(result.stderr)
  stderr = result.stderr
  writeFileSync(join(out, `meter-${fixture.id}-ffmpeg.txt`), stderr)
  const summary = stderr.slice(stderr.lastIndexOf('Summary:'))
  const integrated = Number(summary.match(/I:\s+(-?[\d.]+) LUFS/)?.[1])
  const peak = Number(summary.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1])
  receipts.push({
    fixture: fixture.id,
    sampleRate: fixture.rate,
    studio: own,
    ffmpeg: { integratedLufs: integrated, truePeakDb: peak },
    difference: {
      lufs: own.integratedLufs - integrated,
      truePeakDb: own.truePeakDb - peak,
    },
  })
}
const version = execFileSync('ffmpeg', ['-version'], {
  encoding: 'utf8',
}).split('\n')[0]
const finalWavs = []
for (const fixture of cases.filter(
  (item) =>
    item.rate === 48000 &&
    [
      '48000-12000',
      '48000-gated',
      'adversarial',
      'edge-48000-0.2-0.000',
    ].includes(item.id),
)) {
  const meter = createStudioMeter({
    sampleRate: 48000,
    channels: 2,
    maxFrames: fixture.channels[0].length,
    truePeak: true,
  })
  meter.push(fixture.channels)
  const gain = 10 ** ((-1.5 - 0.75 - meter.finish().truePeakDb) / 20)
  const channels = fixture.channels.map((channel) =>
    Float32Array.from(channel, (sample) => sample * gain),
  )
  const buffer = {
    sampleRate: 48000,
    numberOfChannels: 2,
    length: channels[0].length,
    getChannelData: (channel: number) => channels[channel],
  } as AudioBuffer
  const bytes = encodeAudioBufferToPcmWav(buffer)
  const path = join(out, `final-16bit-${fixture.id}.wav`)
  writeFileSync(path, Buffer.from(bytes))
  const own = await measureStudioWav(bytes, { createWorker: null })
  const { spawnSync } = await import('node:child_process')
  const result = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostats',
      '-i',
      path,
      '-af',
      'ebur128=peak=true',
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8' },
  )
  if (result.status !== 0) throw new Error(result.stderr)
  writeFileSync(
    join(out, `final-16bit-${fixture.id}-ffmpeg.txt`),
    result.stderr,
  )
  const summary = result.stderr.slice(result.stderr.lastIndexOf('Summary:'))
  const referencePeak = Number(summary.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1])
  if (referencePeak > -1.5)
    throw new Error(`Reference ceiling failure: ${fixture.id}`)
  finalWavs.push({
    fixture: fixture.id,
    studio: own,
    ffmpegTruePeakDb: referencePeak,
    ceilingDb: -1.5,
  })
}
writeFileSync(
  join(out, 'meter-reference-results.json'),
  JSON.stringify(
    { version, algorithm: 'hann64-8x-v1', fixtures: receipts, finalWavs },
    null,
    2,
  ) + '\n',
)
const worst = receipts
  .slice()
  .sort((a, b) => a.difference.truePeakDb - b.difference.truePeakDb)
console.log(
  JSON.stringify(
    {
      fixtures: receipts.length,
      worstUnderread: worst.slice(0, 5),
      worstOverread: worst.at(-1),
    },
    null,
    2,
  ),
)

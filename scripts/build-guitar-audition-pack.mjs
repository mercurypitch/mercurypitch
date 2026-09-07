// Guitar audition pack — private owner fixtures through production and experimental heads.
// Usage: node scripts/build-guitar-audition-pack.mjs --fixtures <json> --cabinet <json> --out <dir> [--gp <file> ...]
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import console from 'node:console'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { createServer, transformWithEsbuild } from 'vite'
import { hashBytes, measureLoudness, readJson, saveJson, writeMonoFloatWav, } from './audio-audition-files.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const variants = [
  'dry',
  'edge',
  'lead',
  'lead-ir',
  'prototype-ir',
  'articulate-ir',
  'tight-ir',
]
const baselineRef = 'dd3bb6298208d35e175d664036e636f7571bf3e9'

export async function buildGuitarAuditionPack(options) {
  const manifest = readJson(options.fixtures)
  const reference =
    options.reference === undefined ? null : readJson(options.reference)
  const cabinet = readJson(options.cabinet)
  if (reference !== null)
    assert.equal(
      cabinet.sha256,
      reference.cabinet.sha256,
      'Reference cabinet must match',
    )
  assert.equal(cabinet.licenceEvidence.redistributionPermitted, true)
  assert.match(cabinet.sha256, /^[a-f0-9]{64}$/)
  for (const candidate of manifest.candidates.slice(0, 2))
    assert.match(candidate.excerpt.sha256, /^[a-f0-9]{64}$/)
  const assets = new Map()

  function asset(path, expectedHash) {
    assert.ok(
      statSync(path).size <= 16 * 1024 * 1024,
      'Bounded local source required',
    )
    const bytes = readFileSync(path)
    assert.ok(bytes.length <= 16 * 1024 * 1024, 'Bounded local source required')
    const sha256 = hashBytes(bytes)
    if (expectedHash !== undefined)
      assert.equal(sha256, expectedHash, 'Audited source changed')
    const url = `/__audition_asset/${assets.size}`
    assets.set(url, bytes)
    return { url, sha256, path }
  }
  const ir = asset(cabinet.filePath, cabinet.sha256)
  const inputs = manifest.candidates.slice(0, 2).map((candidate) => ({
    id: candidate.id,
    kind: 'recording',
    ...asset(candidate.excerpt.path, candidate.excerpt.sha256),
    dryEvidence: candidate.dryEvidence,
  }))
  for (const [index, path] of (options.gp ?? []).entries())
    inputs.push({
      id: `score-${index + 1}`,
      kind: 'score',
      name: basename(path),
      ...asset(path),
    })
  assert.ok(inputs.length >= 2 && inputs.length <= 6)
  const out = resolve(options.out)
  assert.equal(
    existsSync(out),
    false,
    'Use a fresh output directory; existing evidence is never overwritten',
  )
  assert.equal(
    new Set(inputs.map((input) => input.id)).size,
    inputs.length,
    'Unique input IDs required',
  )
  for (const input of inputs)
    assert.match(
      input.id,
      /^[a-z0-9][a-z0-9-]{0,79}$/,
      'Input IDs must be safe directory slugs',
    )
  if (reference !== null) {
    for (const input of inputs) {
      const previous = reference.inputs.find(
        (candidate) => candidate.id === input.id,
      )
      assert.ok(previous !== undefined, 'Reference fixture missing')
      assert.equal(
        input.sha256,
        previous.sha256,
        'Reference input bytes changed',
      )
      if (input.kind === 'score') {
        assert.match(previous.sourcePcm.sha256, /^[a-f0-9]{64}$/)
        // Freeze the verified source, not the candidate output. Seeded synthesis
        // can still differ by floating-point roundoff across browser runs.
        input.frozenSource = asset(
          join(dirname(previous.renders.edge.path), 'source.wav'),
          previous.sourcePcm.sha256,
        )
      }
    }
  }
  mkdirSync(dirname(out), { recursive: true })
  mkdirSync(out)
  const baseRef = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim()
  const baselineSource = execFileSync(
    'git',
    ['show', `${baselineRef}:src/lib/guitar/guitar-electric-amp.ts`],
    { cwd: root, encoding: 'utf8' },
  )
  const baseline = await transformWithEsbuild(baselineSource, 'baseline.ts', {
    loader: 'ts',
  })
  const server = await createServer({
    root,
    configFile: false,
    server: { host: '127.0.0.1', port: 0 },
    resolve: { alias: { '@': join(root, 'src') } },
    optimizeDeps: {
      entries: [],
      noDiscovery: true,
      include: ['@coderline/alphatab'],
    },
  })
  let browser
  const report = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    baseRef,
    baselineRef,
    baselineSourceSha256: hashBytes(baselineSource),
    fixturesManifestSha256: hashBytes(readFileSync(options.fixtures)),
    referenceReportSha256:
      reference === null ? null : hashBytes(readFileSync(options.reference)),
    ffmpegVersion: execFileSync('ffmpeg', ['-version'], {
      encoding: 'utf8',
    }).split('\n')[0],
    sourceHashes: Object.fromEntries(
      [
        'src/lib/guitar/guitar-electric-amp.ts',
        'src/lib/guitar/guitar-synth.ts',
        'src/features/guitar-night/guitar-amp-settings.ts',
        'src/lib/tab/gp-import.ts',
        'src/lib/tab/gp-to-midi-song.ts',
        'src/lib/midi-tempo-clock.ts',
        'scripts/guitar-audition-browser.mjs',
        'scripts/build-guitar-audition-pack.mjs',
        'scripts/guitar-audition-head.mjs',
        'scripts/guitar-audition-probes.mjs',
        'scripts/audio-audition-files.mjs',
      ].map((path) => [path, hashBytes(readFileSync(join(root, path)))]),
    ),
    cabinet,
    inputs: [],
    method: {
      inputGainDb: 0,
      inputBoundaryFadeSeconds: [0.09, 0.24],
      inputBoundaryEnvelope:
        'Exponential opening from 0.0001; 36ms time-constant release with 240ms before source ends.',
      tailSeconds: 1.5,
      irTrimDb: -18,
      convolverNormalize: false,
      irReplacesFilterCabinet: true,
      outputMatch:
        'One linear post-render trim per source/variant; no limiter/compressor/normalization before head.',
      limits:
        'Offline Chromium, not a live latency/CPU benchmark. Short sparse clips: LUFS matching is approximate perceptually. DI dryness and owner sound approval pending.',
    },
  }
  try {
    await server.listen()
    const origin = server.resolvedUrls.local[0].replace(/\/$/, '')
    browser = await chromium.launch({ headless: true })
    report.browserVersion = browser.version()
    const page = await browser.newPage()
    const browserErrors = []
    page.on('pageerror', (error) => browserErrors.push(error.message))
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (url.origin !== origin) return route.abort()
      if (url.pathname === '/__audition')
        return route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><title>Private offline guitar audition</title>',
        })
      if (url.pathname === '/__audition_baseline.js')
        return route.fulfill({
          contentType: 'application/javascript',
          body: baseline.code,
        })
      if (assets.has(url.pathname))
        return route.fulfill({
          contentType: 'application/octet-stream',
          body: assets.get(url.pathname),
        })
      return route.continue()
    })
    await page.goto(`${origin}/__audition`)
    report.headVerification = await page.evaluate(async () => {
      const renderer = await import('/scripts/guitar-audition-browser.mjs')
      return renderer.verifyProfiles()
    })
    for (const input of inputs) {
      console.log(`Guitar fixture: ${input.id}`)
      const folder = join(out, input.id)
      mkdirSync(folder, { recursive: true })
      const prepared = await page.evaluate(
        async (config) => {
          const renderer = await import('/scripts/guitar-audition-browser.mjs')
          return renderer.prepareFixture(config)
        },
        { ...input, irUrl: ir.url },
      )
      const { pcm, ...metadata } = prepared
      const sourcePcm = writeMonoFloatWav(
        join(folder, 'source.wav'),
        pcm,
        48000,
      )
      const result = { ...input, metadata, sourcePcm, renders: {} }
      if (reference !== null) {
        const previous = reference.inputs.find(
          (candidate) => candidate.id === input.id,
        )
        assert.equal(
          sourcePcm.pcmSha256,
          previous.sourcePcm.pcmSha256,
          'Prepared input PCM changed',
        )
        if (input.kind === 'score')
          for (const key of [
            'name',
            'track',
            'startSeconds',
            'windowSeconds',
            'notes',
            'seed',
            'rendering',
          ])
            assert.deepEqual(
              metadata[key],
              previous.metadata[key],
              `Reference score ${key} changed`,
            )
      }
      for (const id of [...variants, 'baseline-old', 'prototype-no-sag-ir']) {
        const rendered = await page.evaluate(async (variant) => {
          const renderer = await import('/scripts/guitar-audition-browser.mjs')
          return renderer.renderVariant(variant)
        }, id)
        const path = join(folder, `${id}-raw.wav`)
        result.renders[id] = {
          path,
          parameters: rendered.parameters,
          ...writeMonoFloatWav(path, rendered.pcm, rendered.sampleRate),
          ...measureLoudness(path),
        }
        assert.equal(
          result.renders[id].clippedSamples,
          0,
          `${id} clips before output match`,
        )
      }
      assert.equal(
        result.renders.edge.pcmSha256,
        result.renders['baseline-old'].pcmSha256,
        'Default head/cab refactor must be PCM-identical to original source',
      )
      assert.notEqual(
        result.renders['prototype-ir'].pcmSha256,
        result.renders['prototype-no-sag-ir'].pcmSha256,
        'Prototype sidechain must affect real rendered audio',
      )
      if (reference !== null) {
        const previous = reference.inputs.find(
          (candidate) => candidate.id === input.id,
        )
        assert.ok(previous !== undefined, 'Reference fixture missing')
        assert.equal(
          input.sha256,
          previous.sha256,
          'Reference input bytes changed',
        )
        assert.equal(
          result.sourcePcm.pcmSha256,
          previous.sourcePcm.pcmSha256,
          'Prepared input PCM changed',
        )
        for (const id of [
          'edge',
          'lead',
          'lead-ir',
          'prototype-ir',
          'prototype-no-sag-ir',
        ])
          assert.equal(
            result.renders[id].pcmSha256,
            previous.renders[id].pcmSha256,
            `Historical ${id} control must stay PCM-identical`,
          )
        result.referenceControlsVerified = true
      }
      const targetLufs = Math.min(
        -20,
        ...variants.map((id) => {
          const render = result.renders[id]
          return render.integratedLufs - 2 - render.truePeakDbTP
        }),
      )
      result.targetLufs = targetLufs
      for (const id of variants) {
        const render = result.renders[id]
        const gainDb = targetLufs - render.integratedLufs
        const path = join(folder, `${id}.wav`)
        execFileSync('ffmpeg', [
          '-v',
          'error',
          '-y',
          '-i',
          render.path,
          '-af',
          `volume=${gainDb}dB`,
          '-c:a',
          'pcm_s24le',
          path,
        ])
        const measured = measureLoudness(path)
        assert.ok(
          Math.abs(measured.integratedLufs - targetLufs) <= 0.3,
          'Level match exceeds tolerance',
        )
        assert.ok(
          measured.truePeakDbTP <= -1.8,
          'Export true peak lacks headroom',
        )
        render.matched = {
          path,
          gainDb,
          sha256: hashBytes(readFileSync(path)),
          ...measured,
        }
      }
      report.inputs.push(result)
      saveJson(join(out, 'report.json'), report)
    }
    assert.deepEqual(browserErrors, [])
    report.browserErrors = browserErrors
    saveJson(join(out, 'report.json'), report)
    console.log(`Verified guitar comparison: ${out}`)
    return report
  } finally {
    await browser?.close()
    await server.close()
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { values } = parseArgs({
    options: {
      fixtures: { type: 'string' },
      cabinet: { type: 'string' },
      out: { type: 'string' },
      gp: { type: 'string', multiple: true },
      reference: { type: 'string' },
    },
  })
  assert.ok(
    typeof values.fixtures === 'string' &&
      values.fixtures.length > 0 &&
      typeof values.cabinet === 'string' &&
      values.cabinet.length > 0 &&
      typeof values.out === 'string' &&
      values.out.length > 0,
    'Supply --fixtures, --cabinet, --out',
  )
  await buildGuitarAuditionPack(values)
}

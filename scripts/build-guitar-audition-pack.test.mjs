// Guitar audition guard tests reject unsafe manifests before rendering or replacing evidence.
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { buildGuitarAuditionPack } from './build-guitar-audition-pack.mjs'
import { historicalLiteAuditionParameters, verifyReferencePcm, } from './guitar-audition-browser.mjs'

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

test('historical Lead controls stay Lite and retain the approved reference voicing', () => {
  const expected = {
    engine: 'lite',
    enabled: true,
    drive: 0.84,
    bass: -0.1,
    mid: 0.38,
    treble: -0.22,
    presence: 0.08,
    output: 0.25,
    cabinet: 'dark',
    asymmetry: 0.46,
  }
  assert.deepEqual(historicalLiteAuditionParameters('lead'), expected)
  const edited = historicalLiteAuditionParameters('lead')
  edited.drive = 0
  assert.deepEqual(historicalLiteAuditionParameters('lead'), expected)
  assert.throws(() => historicalLiteAuditionParameters('tight'), /Unknown/)
})

test('historical Edge controls retain the baseline parity voicing', () => {
  assert.deepEqual(historicalLiteAuditionParameters('edge'), {
    engine: 'lite',
    enabled: true,
    drive: 0.42,
    bass: 0.08,
    mid: 0.1,
    treble: -0.08,
    presence: 0.1,
    output: 0.6,
    cabinet: 'balanced',
    asymmetry: 0.18,
  })
})

function fixture(context) {
  const directory = mkdtempSync(join(tmpdir(), 'guitar-audition-guards-'))
  context.after(() => rmSync(directory, { recursive: true, force: true }))
  // A regression must fail the test without opening a browser. Valid guards
  // reject before even creating the output directory or setting up Vite.
  const launch = context.mock.method(chromium, 'launch', () => {
    throw new Error('Input guard unexpectedly reached browser launch')
  })
  context.after(() => assert.equal(launch.mock.callCount(), 0))
  const asset = (name, values) => {
    const bytes = new Uint8Array(values)
    const path = join(directory, name)
    writeFileSync(path, bytes)
    return { path, sha256: sha256(bytes) }
  }
  const ir = asset('cabinet.wav', [1, 2, 3, 4])
  const first = asset('first.wav', [5, 6, 7, 8])
  const second = asset('second.wav', [9, 10, 11, 12])
  const manifest = {
    candidates: [
      { id: 'first', excerpt: first },
      { id: 'second', excerpt: second },
    ],
  }
  const cabinet = {
    filePath: ir.path,
    sha256: ir.sha256,
    licenceEvidence: { redistributionPermitted: true },
  }
  const options = {
    fixtures: join(directory, 'fixtures.json'),
    cabinet: join(directory, 'cabinet.json'),
    out: join(directory, 'output'),
  }
  const save = () => {
    writeFileSync(options.fixtures, JSON.stringify(manifest))
    writeFileSync(options.cabinet, JSON.stringify(cabinet))
  }
  save()
  return {
    directory,
    manifest,
    cabinet,
    options,
    save,
    assets: [ir, first, second],
  }
}

for (const unsafeId of ['../escaped', '/absolute', '..\\escaped']) {
  test(`rejects unsafe input ID ${JSON.stringify(unsafeId)} without creating output`, async (context) => {
    const data = fixture(context)
    data.manifest.candidates[0].id = unsafeId
    data.save()

    await assert.rejects(
      buildGuitarAuditionPack(data.options),
      /Input IDs must be safe directory slugs/,
    )

    assert.equal(existsSync(data.options.out), false)
    assert.equal(existsSync(join(data.directory, 'escaped')), false)
  })
}

test('rejects duplicate recording IDs without replacing one candidate with another', async (context) => {
  const data = fixture(context)
  data.manifest.candidates[1].id = data.manifest.candidates[0].id
  data.save()

  await assert.rejects(
    buildGuitarAuditionPack(data.options),
    /Unique input IDs required/,
  )

  assert.equal(existsSync(data.options.out), false)
})

test('rejects recording IDs that collide with generated score IDs', async (context) => {
  const data = fixture(context)
  data.manifest.candidates[0].id = 'score-1'
  data.options.gp = [data.assets[1].path]
  data.save()

  await assert.rejects(
    buildGuitarAuditionPack(data.options),
    /Unique input IDs required/,
  )

  assert.equal(existsSync(data.options.out), false)
})

for (const target of ['cabinet', 'excerpt']) {
  for (const [label, value] of [
    ['missing', undefined],
    ['empty', ''],
    ['malformed', 'not-a-sha256'],
  ]) {
    test(`rejects ${label} audited ${target} SHA-256 before rendering`, async (context) => {
      const data = fixture(context)
      const subject =
        target === 'cabinet'
          ? data.cabinet
          : data.manifest.candidates[0].excerpt
      subject.sha256 = value
      data.save()

      await assert.rejects(buildGuitarAuditionPack(data.options), {
        code: 'ERR_ASSERTION',
      })

      assert.equal(existsSync(data.options.out), false)
    })
  }
}

test('rejects changed audited source bytes even when their claimed hash is well formed', async (context) => {
  const data = fixture(context)
  writeFileSync(data.assets[1].path, new Uint8Array([99, 98, 97, 96]))

  await assert.rejects(
    buildGuitarAuditionPack(data.options),
    /Audited source changed/,
  )

  assert.equal(existsSync(data.options.out), false)
})

test('refuses an existing output directory and preserves its sentinel and source assets', async (context) => {
  const data = fixture(context)
  mkdirSync(data.options.out)
  const sentinel = join(data.options.out, 'sentinel.txt')
  const contents = 'Existing owner evidence must stay byte-identical.\n'
  writeFileSync(sentinel, contents)

  await assert.rejects(
    buildGuitarAuditionPack(data.options),
    /Use a fresh output directory/,
  )

  assert.equal(readFileSync(sentinel, 'utf8'), contents)
  assert.deepEqual(readdirSync(data.options.out), ['sentinel.txt'])
  for (const asset of data.assets)
    assert.equal(sha256(readFileSync(asset.path)), asset.sha256)
})

function referenceFixture(data) {
  data.options.reference = join(data.directory, 'reference.json')
  return {
    cabinet: data.cabinet,
    inputs: data.manifest.candidates.map((candidate) => ({
      id: candidate.id,
      sha256: candidate.excerpt.sha256,
    })),
  }
}

test('frozen source tolerates float roundoff but never hides changed or silent synthesis', () => {
  const saved = new Float32Array([0, 0.2, -0.1])
  assert.equal(verifyReferencePcm(saved, saved), 0)
  const rounded = new Float32Array([0, 0.2 + 2.98e-8, -0.1])
  assert.ok(verifyReferencePcm(rounded, saved) < 1e-6)
  assert.throws(
    () => verifyReferencePcm(new Float32Array([0, 0.21, -0.1]), saved),
    /exceeds floating-point tolerance/,
  )
  assert.throws(
    () => verifyReferencePcm(new Float32Array(3), saved),
    /is silent/,
  )
  assert.throws(
    () => verifyReferencePcm(new Float32Array(3), new Float32Array(3)),
    /is silent/,
  )
  assert.throws(
    () => verifyReferencePcm(new Float32Array(2), saved),
    /length changed/,
  )
  for (const value of [NaN, Infinity, -Infinity]) {
    const invalid = new Float32Array([0, value, -0.1])
    assert.throws(() => verifyReferencePcm(invalid, saved), /Nonfinite/)
    assert.throws(() => verifyReferencePcm(saved, invalid), /Nonfinite/)
  }
})

test('rejects a different reference cabinet before rendering', async (context) => {
  const data = fixture(context)
  const reference = referenceFixture(data)
  reference.cabinet = { ...data.cabinet, sha256: 'a'.repeat(64) }
  writeFileSync(data.options.reference, JSON.stringify(reference))

  await assert.rejects(
    buildGuitarAuditionPack(data.options),
    /Reference cabinet must match/,
  )
  assert.equal(existsSync(data.options.out), false)
})

test('rejects mismatched or missing reference input before rendering', async (context) => {
  const data = fixture(context)
  const reference = referenceFixture(data)
  reference.inputs[0].sha256 = 'a'.repeat(64)
  writeFileSync(data.options.reference, JSON.stringify(reference))
  await assert.rejects(
    buildGuitarAuditionPack(data.options),
    /Reference input bytes changed/,
  )

  reference.inputs = []
  writeFileSync(data.options.reference, JSON.stringify(reference))
  await assert.rejects(
    buildGuitarAuditionPack(data.options),
    /Reference fixture missing/,
  )
  assert.equal(existsSync(data.options.out), false)
})

test('requires and verifies the frozen score source checksum before rendering', async (context) => {
  const data = fixture(context)
  const reference = referenceFixture(data)
  data.options.gp = [data.assets[1].path]
  const source = join(data.directory, 'source.wav')
  writeFileSync(source, new Uint8Array([1, 3, 5, 7]))
  const score = {
    id: 'score-1',
    sha256: data.assets[1].sha256,
    sourcePcm: { sha256: 'a'.repeat(64) },
    renders: { edge: { path: join(data.directory, 'edge-raw.wav') } },
  }
  reference.inputs.push(score)
  writeFileSync(data.options.reference, JSON.stringify(reference))
  await assert.rejects(
    buildGuitarAuditionPack(data.options),
    /Audited source changed/,
  )

  delete score.sourcePcm.sha256
  writeFileSync(data.options.reference, JSON.stringify(reference))
  await assert.rejects(buildGuitarAuditionPack(data.options), {
    code: 'ERR_ASSERTION',
  })
  assert.equal(existsSync(data.options.out), false)
})

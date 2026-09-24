// Package the accepted V7 master as standard glTF with host-safe external buffers.

import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

import { format, resolveConfig } from 'prettier'

import { createExternalDelivery, EXTERNAL_BUFFER_LIMIT_BYTES, verifyExternalDelivery, } from './external_gltf_delivery.mjs'
import { discardStagedCandidate, fileFingerprint, promoteStagedCandidate, stageCandidateForAtomicPromotion, verifyAcceptedFile, verifyAcceptedFileIfPresent, } from './runtime_build_guards.mjs'

const runFile = promisify(execFile)
const REPO = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../..',
)
const MASTER_DIR = join(
  REPO,
  'art/glass-adventure/platform-trials/v7/runtime/master',
)
const MASTER_KIT = join(MASTER_DIR, 'cloudway-platform-kit-v7.glb')
const MASTER_MANIFEST = join(MASTER_DIR, 'manifest.json')
const OUTPUT_DIR = process.env.CLOUDWAY_V7_PUBLIC_DIR
  ? resolve(process.env.CLOUDWAY_V7_PUBLIC_DIR)
  : join(REPO, 'apps/beside-cue/public/games/cloudway-v7')
const CANONICAL_PUBLIC_DIRECTORY = 'apps/beside-cue/public/games/cloudway-v7'
const GLTF_NAME = 'cloudway-platform-kit-v7.gltf'
const PART_NAMES = ['01', '02', '03', '04'].map(
  (part) => `cloudway-platform-kit-v7-part-${part}.bin`,
)
const MANIFEST_NAME = 'manifest.json'
const OVERSIZED_PUBLIC_GLB = join(OUTPUT_DIR, 'cloudway-platform-kit-v7.glb')
const ACCEPTED_INPUTS_PATH = join(
  REPO,
  'art/glass-adventure/platform-trials/v7/runtime/production/accepted-inputs.json',
)
const ACCEPTED_DELIVERY_PATH = join(
  REPO,
  'art/glass-adventure/platform-trials/v7/runtime/production/accepted-delivery.json',
)
const GLTF_TRANSFORM = join(
  REPO,
  'apps/beside-cue/node_modules/.bin/gltf-transform',
)

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function repoRelative(path) {
  return path.slice(REPO.length + 1)
}

async function formatJson(value) {
  const config = (await resolveConfig(join(REPO, 'package.json'))) ?? {}
  return format(JSON.stringify(value), {
    ...config,
    parser: 'json',
    plugins: [],
  })
}

async function candidateRecord(path, canonicalFile) {
  const fingerprint = await fileFingerprint(path)
  return { file: canonicalFile, ...fingerprint }
}

async function validate(path, quiet = false) {
  const result = await runFile(GLTF_TRANSFORM, ['validate', path], {
    cwd: REPO,
    timeout: 600_000,
    maxBuffer: 16 * 1024 * 1024,
  })
  if (!quiet && result.stdout.trim() !== '') process.stdout.write(result.stdout)
  if (!quiet && result.stderr.trim() !== '') process.stderr.write(result.stderr)
}

async function main() {
  const printCandidateReceipt = process.argv.includes(
    '--print-candidate-receipt',
  )
  const acceptedInputs = JSON.parse(
    await readFile(ACCEPTED_INPUTS_PATH, 'utf8'),
  )
  const acceptedMaster = acceptedInputs.outputs['1024']
  await verifyAcceptedFile(MASTER_KIT, acceptedMaster, 'V7 runtime master')
  const removeObsoletePublicGlb = await verifyAcceptedFileIfPresent(
    OVERSIZED_PUBLIC_GLB,
    acceptedMaster,
    'obsolete public V7 GLB',
  )

  const masterBytes = await readFile(MASTER_KIT)
  const masterManifest = JSON.parse(await readFile(MASTER_MANIFEST, 'utf8'))
  assert.equal(masterManifest.bundle.bytes, masterBytes.byteLength)
  assert.equal(masterManifest.bundle.sha256, sha256(masterBytes))

  const work = await mkdtemp(join(tmpdir(), 'cloudway-v7-external-'))
  try {
    const delivery = createExternalDelivery(masterBytes, PART_NAMES)
    assert.equal(delivery.parts.length, 4)
    assert(
      delivery.parts.every(
        (part) => part.byteLength <= EXTERNAL_BUFFER_LIMIT_BYTES,
      ),
    )

    const candidateGltf = join(work, GLTF_NAME)
    const candidateParts = PART_NAMES.map((name) => join(work, name))
    await Promise.all([
      writeFile(candidateGltf, await formatJson(delivery.document)),
      ...candidateParts.map((path, index) =>
        writeFile(path, delivery.parts[index]),
      ),
    ])
    verifyExternalDelivery(
      masterBytes,
      JSON.parse(await readFile(candidateGltf, 'utf8')),
      await Promise.all(candidateParts.map((path) => readFile(path))),
    )
    await validate(candidateGltf, printCandidateReceipt)

    const gltfRecord = await candidateRecord(
      candidateGltf,
      `${CANONICAL_PUBLIC_DIRECTORY}/${GLTF_NAME}`,
    )
    const dependencyRecords = await Promise.all(
      candidateParts.map((path, index) =>
        candidateRecord(
          path,
          `${CANONICAL_PUBLIC_DIRECTORY}/${PART_NAMES[index]}`,
        ),
      ),
    )
    const publicManifest = {
      ...masterManifest,
      status: 'integrated external-buffer runtime delivery',
      bundle: {
        id: masterManifest.bundle.id,
        file: GLTF_NAME,
        bytes: gltfRecord.bytes,
        sha256: gltfRecord.sha256,
        dependencies: dependencyRecords.map(
          ({ file: _file, ...record }, index) => ({
            file: PART_NAMES[index],
            ...record,
          }),
        ),
        totalBytes:
          gltfRecord.bytes +
          dependencyRecords.reduce((total, file) => total + file.bytes, 0),
        maximumFileBytes: Math.max(
          gltfRecord.bytes,
          ...dependencyRecords.map((file) => file.bytes),
        ),
        acceptedMaster: {
          file: repoRelative(MASTER_KIT),
          bytes: masterBytes.byteLength,
          sha256: sha256(masterBytes),
        },
      },
      runtimeContract: {
        ...masterManifest.runtimeContract,
        delivery: 'glTF JSON with four external binary buffers',
        externalBufferLimitBytes: EXTERNAL_BUFFER_LIMIT_BYTES,
      },
    }
    const candidateManifest = join(work, MANIFEST_NAME)
    await writeFile(candidateManifest, await formatJson(publicManifest))
    const manifestRecord = await candidateRecord(
      candidateManifest,
      `${CANONICAL_PUBLIC_DIRECTORY}/${MANIFEST_NAME}`,
    )

    const candidateReceipt = {
      schema: 1,
      decision:
        'Accepted byte-preserving external-buffer delivery. Production packaging verifies this receipt and never updates it.',
      source: {
        file: repoRelative(MASTER_KIT),
        bytes: masterBytes.byteLength,
        sha256: sha256(masterBytes),
      },
      limitBytes: EXTERNAL_BUFFER_LIMIT_BYTES,
      bufferViewCount: delivery.receipt.bufferViews.length,
      bufferViewBytes: delivery.receipt.bufferViews.reduce(
        (total, view) => total + view.bytes,
        0,
      ),
      bufferViews: delivery.receipt.bufferViews,
      files: Object.fromEntries(
        [gltfRecord, ...dependencyRecords, manifestRecord].map(
          ({ file, ...record }) => [file, record],
        ),
      ),
    }
    if (printCandidateReceipt) {
      console.log(JSON.stringify(candidateReceipt, null, 2))
      return
    }

    const acceptedDelivery = JSON.parse(
      await readFile(ACCEPTED_DELIVERY_PATH, 'utf8'),
    )
    assert.deepEqual(
      candidateReceipt,
      acceptedDelivery,
      'External delivery changed; review it before updating the acceptance receipt.',
    )

    const candidates = [
      ...candidateParts.map((path, index) => ({
        path,
        target: join(OUTPUT_DIR, PART_NAMES[index]),
        receiptFile: `${CANONICAL_PUBLIC_DIRECTORY}/${PART_NAMES[index]}`,
        label: `V7 external buffer ${index + 1}`,
      })),
      {
        path: candidateGltf,
        target: join(OUTPUT_DIR, GLTF_NAME),
        receiptFile: `${CANONICAL_PUBLIC_DIRECTORY}/${GLTF_NAME}`,
        label: 'V7 external glTF',
      },
      {
        path: candidateManifest,
        target: join(OUTPUT_DIR, MANIFEST_NAME),
        receiptFile: `${CANONICAL_PUBLIC_DIRECTORY}/${MANIFEST_NAME}`,
        label: 'V7 public manifest',
      },
    ]
    const staged = []
    try {
      for (const candidate of candidates) {
        const expected = acceptedDelivery.files[candidate.receiptFile]
        staged.push({
          ...candidate,
          staged: await stageCandidateForAtomicPromotion(
            candidate.path,
            candidate.target,
            expected,
            candidate.label,
          ),
        })
      }
      for (const candidate of staged)
        if (await promoteStagedCandidate(candidate.staged, candidate.target))
          candidate.staged = null
    } finally {
      await Promise.all(
        staged.map((candidate) => discardStagedCandidate(candidate.staged)),
      )
    }
    if (removeObsoletePublicGlb) await rm(OVERSIZED_PUBLIC_GLB)
    console.log(JSON.stringify(publicManifest, null, 2))
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}

await main()

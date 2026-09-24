// Prove drift cannot stage over an accepted Cloudway runtime artifact.

import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { fileFingerprint, stageCandidateForAtomicPromotion, verifyAcceptedFile, } from './runtime_build_guards.mjs'

test('input drift is rejected by its immutable receipt', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'cloudway-v7-input-drift-'))
  context.after(async () => {
    const { rm } = await import('node:fs/promises')
    await rm(directory, { recursive: true, force: true })
  })
  const source = join(directory, 'source.glb')
  await writeFile(source, 'accepted source')
  const accepted = await fileFingerprint(source)
  await writeFile(source, 'drifted source')

  await assert.rejects(
    verifyAcceptedFile(source, accepted, 'V6 runtime source'),
    /Accepted V6 runtime source changed/,
  )
})

test('candidate drift cannot overwrite or stage beside an accepted target', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'cloudway-v7-output-drift-'))
  context.after(async () => {
    const { rm } = await import('node:fs/promises')
    await rm(directory, { recursive: true, force: true })
  })
  const acceptedSource = join(directory, 'accepted.glb')
  const candidate = join(directory, 'candidate.glb')
  const target = join(directory, 'runtime.glb')
  await writeFile(acceptedSource, 'accepted runtime')
  await writeFile(candidate, 'drifted candidate')
  await writeFile(target, 'installed runtime sentinel')
  const accepted = await fileFingerprint(acceptedSource)

  await assert.rejects(
    stageCandidateForAtomicPromotion(
      candidate,
      target,
      accepted,
      'V7 runtime candidate',
    ),
    /Accepted V7 runtime candidate changed/,
  )
  assert.equal(await readFile(target, 'utf8'), 'installed runtime sentinel')
  assert.deepEqual((await readdir(directory)).sort(), [
    'accepted.glb',
    'candidate.glb',
    'runtime.glb',
  ])
})

test('an already accepted target is not rewritten', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'cloudway-v7-noop-'))
  context.after(async () => {
    const { rm } = await import('node:fs/promises')
    await rm(directory, { recursive: true, force: true })
  })
  const candidate = join(directory, 'candidate.glb')
  const target = join(directory, 'runtime.glb')
  await writeFile(candidate, 'accepted runtime')
  await writeFile(target, 'accepted runtime')
  const accepted = await fileFingerprint(candidate)
  const before = await stat(target)

  const staged = await stageCandidateForAtomicPromotion(
    candidate,
    target,
    accepted,
    'V7 runtime candidate',
  )

  const after = await stat(target)
  assert.equal(staged, null)
  assert.equal(after.ino, before.ino)
  assert.equal(after.mtimeMs, before.mtimeMs)
})

// Verify immutable runtime inputs and stage accepted candidates beside their targets.

import { createHash, randomUUID } from 'node:crypto'
import { copyFile, mkdir, readFile, rename, rm } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

export async function fileFingerprint(path) {
  const bytes = await readFile(path)
  return {
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
}

export async function verifyAcceptedFile(path, expected, label) {
  if (!expected) throw new Error(`Missing accepted receipt for ${label}.`)
  const actual = await fileFingerprint(path)
  if (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256)
    throw new Error(
      `Accepted ${label} changed; preserved outputs were not replaced.`,
    )
  return actual
}

async function targetAlreadyAccepted(path, expected) {
  if (!expected) return false
  try {
    const actual = await fileFingerprint(path)
    return actual.bytes === expected.bytes && actual.sha256 === expected.sha256
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

export async function stageCandidateForAtomicPromotion(
  candidate,
  target,
  expected,
  label,
) {
  const candidateRecord = expected ?? (await fileFingerprint(candidate))
  await verifyAcceptedFile(candidate, candidateRecord, label)
  if (await targetAlreadyAccepted(target, expected)) return null

  await mkdir(dirname(target), { recursive: true })
  const staged = join(
    dirname(target),
    `.${basename(target)}.${process.pid}-${randomUUID()}.candidate`,
  )
  try {
    await copyFile(candidate, staged)
    await verifyAcceptedFile(staged, candidateRecord, `${label} staging copy`)
    return staged
  } catch (error) {
    await rm(staged, { force: true })
    throw error
  }
}

export async function promoteStagedCandidate(staged, target) {
  if (staged === null) return false
  await rename(staged, target)
  return true
}

export async function discardStagedCandidate(staged) {
  if (staged !== null) await rm(staged, { force: true })
}

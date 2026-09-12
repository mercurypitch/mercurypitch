// Recorded bank curation — pinned audition mixtures and dynamics, shared by both rooms.
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const RECORDED_KIT_IDS = Object.freeze(['muldjord', 'crocell'])
const NOTICE_HASHES = Object.freeze({
  'muldjord/CC-BY-4.0.txt':
    '9e5f1b3c610b9c2da5c313bf81d577a7d1acec686bdb0384edefa6df0f90cd94',
  'crocell/CC-BY-4.0.txt':
    '9e5f1b3c610b9c2da5c313bf81d577a7d1acec686bdb0384edefa6df0f90cd94',
  'muldjord/UPSTREAM-README.txt':
    '2243f2f88123e2d89e53410355e8e94bcbd2b4eb40c677468d54b5112862c17a',
  'crocell/UPSTREAM-README.txt':
    '8f92c0b6bfc083dbc8e16ce72f7dfd40b61765ab76c132edafb56c56d849839c',
})
const publicRoot = fileURLToPath(
  new URL('../public/drum-night/kits/', import.meta.url),
)
export const RECORDED_KIT_RECIPES = Object.fromEntries(
  RECORDED_KIT_IDS.map((kitId) => [
    kitId,
    JSON.parse(
      readFileSync(resolve(publicRoot, kitId, 'selected-mixes.json'), 'utf8'),
    ),
  ]),
)
export const RECORDED_KIT_CALIBRATION = Object.fromEntries(
  RECORDED_KIT_IDS.map((kitId) => [
    kitId,
    {
      gainDb: RECORDED_KIT_RECIPES[kitId].gainDb,
      velcurve: RECORDED_KIT_RECIPES[kitId].velcurve,
    },
  ]),
)
export const RECORDED_KIT_ZONES = Object.freeze(
  RECORDED_KIT_IDS.flatMap((kitId) =>
    RECORDED_KIT_RECIPES[kitId].mixes.map((mix) => ({
      kitId,
      articulation: mix.articulation,
      gmKeys: [mix.gmKey],
      layer: mix.layer,
      roundRobin: mix.roundRobin,
      velocityMin: mix.velocityMin,
      velocityMax: mix.velocityMax,
      chokeGroup: mix.articulation === 'hh-open' ? 'hi-hat-open' : null,
      chokes: mix.articulation === 'hh-closed' ? ['hi-hat-open'] : [],
      sourceKind: 'approved-mix',
      sourceCommit:
        RECORDED_KIT_RECIPES[kitId].source.commit ??
        RECORDED_KIT_RECIPES[kitId].source.version,
      sourcePath: `${kitId}/selected-mixes.json#${mix.id}`,
      sourceSha256: mix.sha256,
      preparedPath: mix.preparedPath,
    })),
  ),
)

export function resolveRecordedMix(zone, auditionRoot) {
  if (!auditionRoot)
    throw new Error(
      'Set DRUM_AUDITION_ROOT to the approved audition directory to rebuild recorded kits (see kits/README.md)',
    )
  const root = resolve(auditionRoot)
  const path = resolve(root, zone.preparedPath)
  if (
    !path.startsWith(`${root}/samples/${zone.kitId}/`) ||
    !lstatSync(path).isFile() ||
    lstatSync(path).isSymbolicLink()
  ) {
    throw new Error(`Unsafe recorded mix path: ${zone.preparedPath}`)
  }
  const sha = createHash('sha256').update(readFileSync(path)).digest('hex')
  if (sha !== zone.sourceSha256)
    throw new Error(`Recorded mix SHA-256 mismatch: ${zone.preparedPath}`)
  return path
}

export function assertRecordedKitNotices(outputRoot = publicRoot) {
  for (const [file, expected] of Object.entries(NOTICE_HASHES)) {
    const actual = createHash('sha256')
      .update(readFileSync(resolve(outputRoot, file)))
      .digest('hex')
    if (actual !== expected)
      throw new Error(
        `Recorded kit licence or upstream notice drifted: ${file}`,
      )
  }
}

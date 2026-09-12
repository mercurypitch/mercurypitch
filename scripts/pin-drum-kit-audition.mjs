// Pin the approved licensed audition subset as public, path-sanitized curation recipes.
// Usage: node scripts/pin-drum-kit-audition.mjs <audition-root> <muldjord-source-root>
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const [auditionRoot, muldjordRoot] = process.argv.slice(2)
if (!auditionRoot || !muldjordRoot || process.argv.length !== 4) {
  throw new Error(
    'Usage: node scripts/pin-drum-kit-audition.mjs <audition-root> <muldjord-source-root>',
  )
}
const hash = (data) => createHash('sha256').update(data).digest('hex')
const manifestBytes = readFileSync(
  resolve(auditionRoot, 'free-kits-manifest.json'),
)
const auditionSha256 =
  '46159675f7e720c769b7bb44a96446cca056ce8f6e1c98c1a3ef5c47b6ddeded'
if (hash(manifestBytes) !== auditionSha256)
  throw new Error('Audition manifest does not match the approved source')
const manifest = JSON.parse(manifestBytes)
const gmVoices = {
  36: 'kick',
  38: 'snare',
  41: 'tom-low',
  42: 'hh-closed',
  46: 'hh-open',
  48: 'tom-high',
  49: 'crash',
  51: 'ride',
}

function publicProvenance(value) {
  if (Array.isArray(value)) return value.map(publicProvenance)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => {
        if (
          key === 'path' &&
          typeof child === 'string' &&
          child.startsWith('/')
        ) {
          const sourceRelative =
            /(?:sources\/crocell\/|source-cache\/muldjord\/)(.+)$/.exec(
              child,
            )?.[1]
          return [
            key,
            value.archiveMember ??
              sourceRelative ??
              `prepared-mixes/${basename(child)}`,
          ]
        }
        return [key, publicProvenance(child)]
      }),
    )
  }
  if (typeof value === 'string' && value.startsWith('/'))
    throw new Error('Unclassified private path in provenance')
  return value
}

for (const kit of manifest.kits.filter((item) =>
  ['muldjord', 'crocell'].includes(item.kitId),
)) {
  const kitRoot = resolve(root, 'public/drum-night/kits', kit.kitId)
  mkdirSync(kitRoot, { recursive: true })
  const mixes = []
  for (const [gmKey, hits] of Object.entries(kit.voices)) {
    const velocities = [...new Set(hits.map((hit) => hit.velocity))].sort(
      (a, b) => a - b,
    )
    for (const hit of hits) {
      const layer = velocities.indexOf(hit.velocity)
      const velocityMin =
        hit.velocityMin ??
        (layer === 0
          ? 1
          : Math.floor((velocities[layer - 1] + hit.velocity) / 2) + 1)
      const velocityMax =
        hit.velocityMax ??
        (layer === velocities.length - 1
          ? 127
          : Math.floor((hit.velocity + velocities[layer + 1]) / 2))
      const preparedPath = `samples/${kit.kitId}/${basename(hit.path)}`
      if (
        hash(readFileSync(resolve(auditionRoot, preparedPath))) !== hit.sha256
      )
        throw new Error(`Approved mix changed: ${preparedPath}`)
      mixes.push({
        id: `${gmVoices[gmKey]}-l${layer + 1}-rr${hit.variant}`,
        gmKey: Number(gmKey),
        articulation: gmVoices[gmKey],
        layer: layer + 1,
        roundRobin: hit.variant,
        velocityMin,
        velocityMax,
        preparedPath,
        sha256: hit.sha256,
        provenance: publicProvenance({ ...hit, path: preparedPath }),
      })
    }
  }
  const source =
    kit.kitId === 'muldjord'
      ? {
          repository: kit.source.repository,
          commit: kit.source.commit,
          url: `https://github.com/${kit.source.repository}/tree/${kit.source.commit}`,
        }
      : {
          url: kit.source.url,
          version: 'CrocellKit1_1',
          license: publicProvenance(kit.source.license),
        }
  const recipe = {
    schemaVersion: 1,
    kitId: kit.kitId,
    auditionSha256,
    source,
    // The frozen groove differs by 10 LU between kits. Compensate that offset,
    // allowing codec peak overshoot while leaving at least 6 dB per-hit headroom.
    gainDb: kit.kitId === 'muldjord' ? -5 : 5,
    velcurve: [
      [1, 1],
      [127, 1],
    ],
    policy:
      'Recorded amplitude and microphone balance retained. One fixed kit gain. Velocity selects a layer; no second velocity attenuation or per-hit normalization. Eight selected core voices, not the complete upstream kit.',
    mixes,
  }
  writeFileSync(
    resolve(kitRoot, 'selected-mixes.json'),
    `${JSON.stringify(recipe, null, 2)}\n`,
  )
  // Preserve the complete legal text with one terminal newline for the diff gate.
  writeFileSync(
    resolve(kitRoot, 'CC-BY-4.0.txt'),
    `${readFileSync(resolve(muldjordRoot, 'LICENSE'), 'utf8').trimEnd()}\n`,
  )
  if (kit.kitId === 'muldjord') {
    const response = await fetch(
      `https://raw.githubusercontent.com/${kit.source.repository}/${kit.source.commit}/README.md`,
    )
    if (!response.ok)
      throw new Error('Could not retrieve pinned Muldjord notice')
    writeFileSync(
      resolve(kitRoot, 'UPSTREAM-README.txt'),
      await response.text(),
    )
  } else {
    copyFileSync(
      resolve(auditionRoot, 'sources/crocell/CrocellKit/README.md'),
      resolve(kitRoot, 'UPSTREAM-README.txt'),
    )
  }
  globalThis.console.log(
    `${kit.kitId}: pinned ${mixes.length} licensed strikes`,
  )
}

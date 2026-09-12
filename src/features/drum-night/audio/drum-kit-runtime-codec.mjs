// Drum runtime rows share field names and derive redundant MP3 identities without losing metadata.
const FIELDS = Object.freeze([
  'slug',
  'articulation',
  'gmKeys',
  'velocityMin',
  'velocityMax',
  'roundRobin',
  'chokeGroup',
  'chokes',
  'readiness',
  'encodedBytes',
  'sha256',
  'power',
  'playbackGain',
])

function identity(kitId, version, slug, sha256) {
  if (
    typeof slug !== 'string' ||
    !/^[a-z0-9-]+$/.test(slug) ||
    typeof sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(sha256)
  ) {
    throw new Error('Invalid compact Drum Night resource identity')
  }
  return {
    id: `${kitId}:${slug}`,
    kitId,
    path: `${kitId}/${version}/${sha256.slice(0, 16)}-${slug}.mp3`,
    mimeType: 'audio/mpeg',
  }
}

export function packDrumKitRuntimeResource(resource, kitId, version) {
  const slug = resource.id.slice(kitId.length + 1)
  const expected = identity(kitId, version, slug, resource.sha256)
  if (
    Object.entries(expected).some(([field, value]) => resource[field] !== value)
  ) {
    throw new Error(
      `Drum Night runtime identity cannot be compacted: ${resource.id}`,
    )
  }
  return FIELDS.map((field) =>
    field === 'slug' ? slug : (resource[field] ?? null),
  )
}

/** The manifest validator still checks every expanded playback field and kit total. */
export function unpackDrumKitRuntimeResource(value, kitId, version) {
  if (!Array.isArray(value) || value.length !== FIELDS.length) {
    throw new Error('Invalid compact Drum Night resource row')
  }
  const row = Object.fromEntries(
    FIELDS.map((field, index) => [field, value[index]]),
  )
  const { slug, power, ...fields } = row
  return {
    ...identity(kitId, version, slug, row.sha256),
    ...fields,
    ...(power === null ? {} : { power }),
  }
}

// ============================================================
// Audio asset manifest — packaged, caption-bound and lane-aware
// ============================================================

export const AUDIO_MANIFEST_SCHEMA_VERSION = 1 as const

export const AUDIO_LANES = [
  'dialogue',
  'score',
  'hold-bed',
  'foley',
  'ui',
] as const

export type AudioLane = (typeof AUDIO_LANES)[number]

export interface AudioSourceVariant {
  /** Packaged, same-origin URL. Remote providers are outside this contract. */
  readonly src: string
  /** Complete MIME declaration, including the codec when one is known. */
  readonly mimeType: string
  /** SHA-256 of these exact delivery bytes, in lowercase hexadecimal. */
  readonly sha256: string
  readonly byteLength: number
  readonly durationMs: number
  readonly sampleRateHz: number
  readonly channels: 1 | 2
}

export type AudioPlayback =
  | { readonly kind: 'one-shot' }
  | {
      readonly kind: 'loop'
      /** Both bounds refer to the decoded source clock. */
      readonly loopStartMs: number
      readonly loopEndMs: number
    }

export interface DialogueAudioBinding {
  readonly lineId: string
  /** SHA-256 of the exact NFC-normalized UTF-8 visible caption. */
  readonly captionSha256: string
}

interface AudioAssetBase {
  /** Stable semantic identity; filenames and providers never define behavior. */
  readonly id: string
  readonly lane: AudioLane
  readonly playback: AudioPlayback
  /** Ordered fallbacks containing the same authored sound. */
  readonly sources: readonly [AudioSourceVariant, ...AudioSourceVariant[]]
}

export interface DialogueAudioAsset extends AudioAssetBase {
  readonly lane: 'dialogue'
  readonly playback: { readonly kind: 'one-shot' }
  readonly dialogue: DialogueAudioBinding
}

export interface NonDialogueAudioAsset extends AudioAssetBase {
  readonly lane: Exclude<AudioLane, 'dialogue'>
}

export type AudioAsset = DialogueAudioAsset | NonDialogueAudioAsset

export interface AudioAssetManifest {
  readonly schemaVersion: typeof AUDIO_MANIFEST_SCHEMA_VERSION
  readonly revision: string
  readonly locale: string
  readonly assets: readonly AudioAsset[]
}

const NO_AUDIO_ASSETS: readonly AudioAsset[] = Object.freeze([])

/**
 * Valid before the recording pass lands. Caption-only remains a complete app
 * state, so an empty audio registry is deliberate rather than exceptional.
 */
export const DEFAULT_AUDIO_ASSET_MANIFEST: AudioAssetManifest = Object.freeze({
  schemaVersion: AUDIO_MANIFEST_SCHEMA_VERSION,
  revision: 'beside-cue-audio-empty-v1',
  locale: 'en',
  assets: NO_AUDIO_ASSETS,
})

export interface ResolvedAudioAsset {
  readonly asset: AudioAsset
  /** Supported variants retain the manifest's authored fallback order. */
  readonly sources: readonly AudioSourceVariant[]
}

export interface DialogueAudioRequest {
  readonly assetId: string
  readonly lineId: string
  readonly captionSha256: string
}

export interface DialogueAudioLookup {
  readonly lineId: string
  readonly captionSha256: string
}

export interface AudioDialogueLineBinding {
  readonly lineId: string
  readonly captionSha256: string
  readonly audioAssetId?: string
}

export interface ReferencedAudioSource {
  readonly assetId: string
  readonly lane: AudioLane
  readonly sourceIndex: number
  readonly source: AudioSourceVariant
}

const TOP_LEVEL_KEYS = [
  'schemaVersion',
  'revision',
  'locale',
  'assets',
] as const
const ASSET_KEYS = ['id', 'lane', 'playback', 'sources', 'dialogue'] as const
const SOURCE_KEYS = [
  'src',
  'mimeType',
  'sha256',
  'byteLength',
  'durationMs',
  'sampleRateHz',
  'channels',
] as const
const ONE_SHOT_KEYS = ['kind'] as const
const LOOP_KEYS = ['kind', 'loopStartMs', 'loopEndMs'] as const
const DIALOGUE_KEYS = ['lineId', 'captionSha256'] as const
const LOWERCASE_SHA256 = /^[a-f\d]{64}$/u
const STABLE_ID = /^[a-z\d][a-z\d._-]*$/u
const LOCALE = /^[a-z]{2,3}(?:-[A-Za-z\d]{2,8})*$/u
const MIME_TYPE = /^audio\/[a-z\d][a-z\d.+-]*(?:\s*;\s*\S(?:.*\S)?)?$/iu

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function hasAsciiControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0)
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127)
  })
}

function reportUnexpectedKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
  label: string,
  problems: string[],
): void {
  const expectedKeys = new Set(expected)
  for (const key of Object.keys(value)) {
    if (!expectedKeys.has(key)) {
      problems.push(`${label} has unexpected field "${key}".`)
    }
  }
}

/** Same-origin, revisioned public audio only; no traversal or URL decoration. */
export function isPackagedAudioAssetUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false

  const url = value.trim()
  if (
    url !== value ||
    url === '' ||
    url.includes('\\') ||
    url.includes('?') ||
    url.includes('#') ||
    url.includes('%') ||
    /^[a-z][a-z\d+.-]*:/iu.test(url) ||
    url.startsWith('//')
  ) {
    return false
  }

  const path = url.startsWith('/')
    ? url.slice(1)
    : url.startsWith('./')
      ? url.slice(2)
      : url
  const segments = path.split('/')

  return (
    path.startsWith('audio/') &&
    /^[a-z\d][a-z\d._/-]*$/iu.test(path) &&
    segments.every(
      (segment) => segment !== '' && segment !== '.' && segment !== '..',
    )
  )
}

function validatePlayback(
  playback: unknown,
  label: string,
  sourceDurations: readonly number[],
  problems: string[],
): AudioPlayback['kind'] | undefined {
  if (!isRecord(playback)) {
    problems.push(`${label} playback must be an object.`)
    return undefined
  }

  if (playback.kind === 'one-shot') {
    reportUnexpectedKeys(playback, ONE_SHOT_KEYS, `${label} playback`, problems)
    return 'one-shot'
  }

  if (playback.kind !== 'loop') {
    problems.push(
      `${label} playback kind is ${String(playback.kind)}, expected one-shot or loop.`,
    )
    return undefined
  }

  reportUnexpectedKeys(playback, LOOP_KEYS, `${label} playback`, problems)
  const start = playback.loopStartMs
  const end = playback.loopEndMs
  if (typeof start !== 'number' || !Number.isFinite(start) || start < 0) {
    problems.push(`${label} loop start must be a finite non-negative number.`)
  }
  if (!isFinitePositive(end)) {
    problems.push(`${label} loop end must be a finite positive number.`)
  }
  if (
    typeof start === 'number' &&
    Number.isFinite(start) &&
    isFinitePositive(end) &&
    end <= start
  ) {
    problems.push(`${label} loop end must be after its loop start.`)
  }
  if (
    isFinitePositive(end) &&
    sourceDurations.some((duration) => end > duration)
  ) {
    problems.push(`${label} loop end exceeds a source duration.`)
  }
  return 'loop'
}

function validateSource(
  source: unknown,
  label: string,
  seenSourceUrls: Set<string>,
  problems: string[],
): number | undefined {
  if (!isRecord(source)) {
    problems.push(`${label} must be an object.`)
    return undefined
  }

  reportUnexpectedKeys(source, SOURCE_KEYS, label, problems)
  if (!isPackagedAudioAssetUrl(source.src)) {
    problems.push(
      `${label} has a non-packaged source URL "${String(source.src)}".`,
    )
  } else if (seenSourceUrls.has(source.src)) {
    problems.push(`Audio source "${source.src}" is declared more than once.`)
  } else {
    seenSourceUrls.add(source.src)
  }
  const mimeType =
    typeof source.mimeType === 'string' ? source.mimeType.trim() : undefined
  if (
    mimeType === undefined ||
    mimeType !== source.mimeType ||
    hasAsciiControlCharacter(mimeType) ||
    !MIME_TYPE.test(mimeType)
  ) {
    problems.push(`${label} has no valid audio MIME type.`)
  }
  if (
    typeof source.sha256 !== 'string' ||
    !LOWERCASE_SHA256.test(source.sha256)
  ) {
    problems.push(`${label} has no valid lowercase SHA-256.`)
  }
  if (!Number.isInteger(source.byteLength) || Number(source.byteLength) <= 0) {
    problems.push(`${label} byte length must be a positive integer.`)
  }
  if (!isFinitePositive(source.durationMs)) {
    problems.push(`${label} duration must be a finite positive number.`)
  }
  if (
    !Number.isInteger(source.sampleRateHz) ||
    Number(source.sampleRateHz) <= 0
  ) {
    problems.push(`${label} sample rate must be a positive integer.`)
  }
  if (source.channels !== 1 && source.channels !== 2) {
    problems.push(`${label} channels must be 1 or 2.`)
  }

  return isFinitePositive(source.durationMs) ? source.durationMs : undefined
}

function validateDialogue(
  dialogue: unknown,
  label: string,
  seenLineIds: Set<string>,
  problems: string[],
): void {
  if (!isRecord(dialogue)) {
    problems.push(`${label} must bind one exact dialogue line.`)
    return
  }

  reportUnexpectedKeys(dialogue, DIALOGUE_KEYS, `${label} dialogue`, problems)
  if (typeof dialogue.lineId !== 'string' || !STABLE_ID.test(dialogue.lineId)) {
    problems.push(`${label} has no valid dialogue line id.`)
  } else if (seenLineIds.has(dialogue.lineId)) {
    problems.push(`Dialogue line "${dialogue.lineId}" is bound more than once.`)
  } else {
    seenLineIds.add(dialogue.lineId)
  }
  if (
    typeof dialogue.captionSha256 !== 'string' ||
    !LOWERCASE_SHA256.test(dialogue.captionSha256)
  ) {
    problems.push(`${label} has no valid caption SHA-256.`)
  }
}

/** Strict structural validation for generated or injected manifest data. */
export function validateAudioAssetManifest(
  manifest: unknown,
): readonly string[] {
  if (!isRecord(manifest)) return ['Audio manifest must be an object.']

  const problems: string[] = []
  reportUnexpectedKeys(manifest, TOP_LEVEL_KEYS, 'Audio manifest', problems)
  if (manifest.schemaVersion !== AUDIO_MANIFEST_SCHEMA_VERSION) {
    problems.push(
      `Audio manifest schema is ${String(manifest.schemaVersion)}, expected ${String(AUDIO_MANIFEST_SCHEMA_VERSION)}.`,
    )
  }
  if (
    typeof manifest.revision !== 'string' ||
    !STABLE_ID.test(manifest.revision)
  ) {
    problems.push('Audio manifest has no valid revision.')
  }
  if (typeof manifest.locale !== 'string' || !LOCALE.test(manifest.locale)) {
    problems.push('Audio manifest has no valid locale.')
  }
  if (!Array.isArray(manifest.assets)) {
    problems.push('Audio manifest assets must be an array.')
    return problems
  }

  const seenAssetIds = new Set<string>()
  const seenSourceUrls = new Set<string>()
  const seenLineIds = new Set<string>()
  for (const [index, suppliedAsset] of manifest.assets.entries()) {
    const label = `Audio asset at index ${String(index)}`
    if (!isRecord(suppliedAsset)) {
      problems.push(`${label} must be an object.`)
      continue
    }

    reportUnexpectedKeys(suppliedAsset, ASSET_KEYS, label, problems)
    if (
      typeof suppliedAsset.id !== 'string' ||
      !STABLE_ID.test(suppliedAsset.id)
    ) {
      problems.push(`${label} has no valid id.`)
    } else if (seenAssetIds.has(suppliedAsset.id)) {
      problems.push(
        `Audio asset "${suppliedAsset.id}" is declared more than once.`,
      )
    } else {
      seenAssetIds.add(suppliedAsset.id)
    }

    const assetLabel =
      typeof suppliedAsset.id === 'string' && suppliedAsset.id !== ''
        ? `Audio asset "${suppliedAsset.id}"`
        : label
    const lane = suppliedAsset.lane
    if (!AUDIO_LANES.includes(lane as AudioLane)) {
      problems.push(`${assetLabel} has unknown lane "${String(lane)}".`)
    }

    const sourceDurations: number[] = []
    if (
      !Array.isArray(suppliedAsset.sources) ||
      suppliedAsset.sources.length === 0
    ) {
      problems.push(`${assetLabel} must declare at least one source variant.`)
    } else {
      for (const [sourceIndex, source] of suppliedAsset.sources.entries()) {
        const duration = validateSource(
          source,
          `${assetLabel} source ${String(sourceIndex)}`,
          seenSourceUrls,
          problems,
        )
        if (duration !== undefined) sourceDurations.push(duration)
      }
    }

    const playbackKind = validatePlayback(
      suppliedAsset.playback,
      assetLabel,
      sourceDurations,
      problems,
    )
    if (lane === 'dialogue') {
      if (playbackKind !== undefined && playbackKind !== 'one-shot') {
        problems.push(`${assetLabel} dialogue must use one-shot playback.`)
      }
      validateDialogue(
        suppliedAsset.dialogue,
        assetLabel,
        seenLineIds,
        problems,
      )
    } else if (suppliedAsset.dialogue !== undefined) {
      problems.push(
        `${assetLabel} may bind dialogue only on the dialogue lane.`,
      )
    }
    if (
      lane === 'hold-bed' &&
      playbackKind !== undefined &&
      playbackKind !== 'loop'
    ) {
      problems.push(
        `${assetLabel} hold bed must declare bounded loop playback.`,
      )
    }
    if (
      (lane === 'foley' || lane === 'ui') &&
      playbackKind !== undefined &&
      playbackKind !== 'one-shot'
    ) {
      problems.push(`${assetLabel} ${lane} audio must use one-shot playback.`)
    }
  }

  return problems
}

export function findAudioAsset(
  manifest: AudioAssetManifest,
  assetId: string,
): AudioAsset | undefined {
  return manifest.assets.find((asset) => asset.id === assetId)
}

/**
 * Resolves supported sources without selecting a playback provider. The
 * caller tries the returned variants in order and falls back to silence.
 */
export function resolveAudioAsset(
  manifest: AudioAssetManifest,
  assetId: string,
  supportsMimeType: (mimeType: string) => boolean = () => true,
): ResolvedAudioAsset | undefined {
  const asset = findAudioAsset(manifest, assetId)
  if (asset === undefined) return undefined

  const sources = asset.sources.filter((source) =>
    supportsMimeType(source.mimeType),
  )
  return sources.length === 0 ? undefined : { asset, sources }
}

/** A dialogue clip resolves only when asset, line and exact caption agree. */
export function resolveDialogueAudioAsset(
  manifest: AudioAssetManifest,
  request: DialogueAudioRequest,
): DialogueAudioAsset | undefined {
  const asset = findAudioAsset(manifest, request.assetId)
  if (
    asset?.lane !== 'dialogue' ||
    asset.dialogue.lineId !== request.lineId ||
    asset.dialogue.captionSha256 !== request.captionSha256
  ) {
    return undefined
  }
  return asset
}

/**
 * Finds the single manifest-owned recording for an exact line and caption.
 * This is the default seam: adding audio never requires a line-side asset id.
 */
export function findDialogueAudioAssetForLine(
  manifest: AudioAssetManifest,
  lookup: DialogueAudioLookup,
): DialogueAudioAsset | undefined {
  const matches = manifest.assets.filter(
    (asset): asset is DialogueAudioAsset =>
      asset.lane === 'dialogue' &&
      asset.dialogue.lineId === lookup.lineId &&
      asset.dialogue.captionSha256 === lookup.captionSha256,
  )
  return matches.length === 1 ? matches[0] : undefined
}

/**
 * Pure cross-check for a future content-pack test. Callers calculate caption
 * hashes from their own line registry; this module stays browser-compatible.
 */
export function validateAudioDialogueLineBindings(
  manifest: AudioAssetManifest,
  bindings: readonly AudioDialogueLineBinding[],
): readonly string[] {
  const problems: string[] = []
  const seenLineIds = new Set<string>()
  const referencedAssetIds = new Set<string>()

  for (const binding of bindings) {
    if (seenLineIds.has(binding.lineId)) {
      problems.push(`Audio line binding "${binding.lineId}" is declared twice.`)
      continue
    }
    seenLineIds.add(binding.lineId)
    const asset =
      binding.audioAssetId === undefined
        ? findDialogueAudioAssetForLine(manifest, binding)
        : resolveDialogueAudioAsset(manifest, {
            assetId: binding.audioAssetId,
            lineId: binding.lineId,
            captionSha256: binding.captionSha256,
          })
    if (asset === undefined) {
      if (binding.audioAssetId !== undefined) {
        problems.push(
          `Line "${binding.lineId}" does not exactly match dialogue audio asset "${binding.audioAssetId}".`,
        )
      }
      continue
    }

    if (referencedAssetIds.has(asset.id)) {
      problems.push(
        `Dialogue audio asset "${asset.id}" is referenced more than once.`,
      )
      continue
    }
    referencedAssetIds.add(asset.id)
  }

  for (const asset of manifest.assets) {
    if (asset.lane === 'dialogue' && !referencedAssetIds.has(asset.id)) {
      problems.push(
        `Dialogue audio asset "${asset.id}" is not bound to a line.`,
      )
    }
  }
  return problems
}

/** Enumerates the exact packaged bytes a static integrity test must pin. */
export function referencedAudioSources(
  manifest: AudioAssetManifest,
): readonly ReferencedAudioSource[] {
  return manifest.assets.flatMap((asset) =>
    asset.sources.map((source, sourceIndex) => ({
      assetId: asset.id,
      lane: asset.lane,
      sourceIndex,
      source,
    })),
  )
}

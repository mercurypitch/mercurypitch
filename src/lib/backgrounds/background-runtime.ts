// ============================================================
// Premium background runtime — validated catalog and protected image delivery
// ============================================================
//
// The Worker decides which known premium backgrounds are currently shipped.
// This client accepts only ids and surfaces already present in the compiled
// catalog, never exposes R2 keys, and decodes private bytes before returning an
// object URL to a renderer.

import { getAuthHeaders } from '@/db/services/user-service'
import { API_BASE_URL } from '@/lib/defaults'
import type { BackgroundPerkId, BackgroundSurface } from './background-catalog'
import { getBackgroundDefinition, isBackgroundPerkId, } from './background-catalog'

export const PREMIUM_BACKGROUND_VARIANTS = [
  'landscape-2k',
  'landscape-4k',
  'portrait-2k',
] as const

export type PremiumBackgroundVariantName =
  (typeof PREMIUM_BACKGROUND_VARIANTS)[number]

export interface PremiumBackgroundVariant {
  name: PremiumBackgroundVariantName
  width: number
  height: number
  byteSize: number
  sha256: string
}

export interface PremiumBackgroundAsset {
  id: BackgroundPerkId
  title: string
  description: string
  surface: BackgroundSurface
  activeVersion: number
  variants: readonly PremiumBackgroundVariant[]
}

export interface PremiumBackgroundCatalogAccess {
  authenticated: boolean
  activeSupporter: boolean
  backgroundIds: readonly BackgroundPerkId[]
  /** Earliest server-known instant at which the current access may shrink. */
  expiresAt: string | null
}

export interface PremiumBackgroundCatalogResponse {
  assets: readonly PremiumBackgroundAsset[]
  access: PremiumBackgroundCatalogAccess
  generatedAt: string
}

export interface JamBackgroundCapability {
  backgroundId: BackgroundPerkId
  roomId: string
  version: number
  token: string
  expiresAt: string
}

export class BackgroundRequestError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'BackgroundRequestError'
    this.status = status
  }
}

interface RuntimeFetchOptions {
  base?: string
  signal?: AbortSignal
  fetcher?: typeof fetch
}

export interface ProtectedBackgroundRequest extends RuntimeFetchOptions {
  variant?: PremiumBackgroundVariantName
  version?: number
  capability?: string
  roomId?: string
  createObjectURL?: (blob: Blob) => string
  revokeObjectURL?: (url: string) => void
  decode?: (
    blob: Blob,
    objectUrl: string,
    signal?: AbortSignal,
  ) => Promise<void>
}

function apiBase(base?: string): string | null {
  const value = base ?? API_BASE_URL
  if (value == null || value === '') return null
  return value.replace(/\/+$/, '')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finitePositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function signalAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted ?? false
}

function isPremiumVariantName(
  value: unknown,
): value is PremiumBackgroundVariantName {
  return (
    typeof value === 'string' &&
    (PREMIUM_BACKGROUND_VARIANTS as readonly string[]).includes(value)
  )
}

function parseVariant(value: unknown): PremiumBackgroundVariant | null {
  if (!isRecord(value)) return null
  if (
    !isPremiumVariantName(value.name) ||
    !finitePositiveInteger(value.width) ||
    !finitePositiveInteger(value.height) ||
    !finitePositiveInteger(value.byteSize) ||
    typeof value.sha256 !== 'string' ||
    !/^[a-f\d]{64}$/i.test(value.sha256)
  ) {
    return null
  }
  return {
    name: value.name,
    width: value.width,
    height: value.height,
    byteSize: value.byteSize,
    sha256: value.sha256.toLowerCase(),
  }
}

function parseAsset(value: unknown): PremiumBackgroundAsset | null {
  if (!isRecord(value) || !isBackgroundPerkId(value.id)) return null
  const definition = getBackgroundDefinition(value.id)
  if (
    definition === null ||
    definition.access.kind !== 'supporter' ||
    (value.surface !== 'karaoke' && value.surface !== 'jam') ||
    definition.surface !== value.surface ||
    typeof value.title !== 'string' ||
    value.title.trim() === '' ||
    typeof value.description !== 'string' ||
    !finitePositiveInteger(value.activeVersion) ||
    !Array.isArray(value.variants)
  ) {
    return null
  }

  const variants = value.variants
    .map(parseVariant)
    .filter((variant): variant is PremiumBackgroundVariant => variant !== null)
  if (variants.length === 0) return null

  return {
    id: value.id,
    title: value.title.trim(),
    description: value.description.trim(),
    surface: value.surface,
    activeVersion: value.activeVersion,
    variants,
  }
}

/** Validate the untrusted server payload at the app boundary. */
export function parsePremiumBackgroundCatalog(
  value: unknown,
): PremiumBackgroundCatalogResponse | null {
  if (!isRecord(value) || !Array.isArray(value.assets)) return null
  if (!isRecord(value.access) || !Array.isArray(value.access.backgroundIds)) {
    return null
  }
  if (
    typeof value.access.authenticated !== 'boolean' ||
    typeof value.access.activeSupporter !== 'boolean' ||
    (value.access.expiresAt !== null &&
      typeof value.access.expiresAt !== 'string') ||
    typeof value.generatedAt !== 'string'
  ) {
    return null
  }

  const byId = new Map<BackgroundPerkId, PremiumBackgroundAsset>()
  for (const rawAsset of value.assets) {
    const asset = parseAsset(rawAsset)
    if (asset !== null && !byId.has(asset.id)) byId.set(asset.id, asset)
  }

  const backgroundIds = [
    ...new Set(
      value.access.backgroundIds.filter(
        (id): id is BackgroundPerkId => isBackgroundPerkId(id) && byId.has(id),
      ),
    ),
  ]

  return {
    assets: [...byId.values()],
    access: {
      authenticated: value.access.authenticated,
      activeSupporter: value.access.activeSupporter,
      backgroundIds,
      expiresAt: value.access.expiresAt,
    },
    generatedAt: value.generatedAt,
  }
}

export async function fetchPremiumBackgroundCatalog(
  options: RuntimeFetchOptions = {},
): Promise<PremiumBackgroundCatalogResponse | null> {
  const base = apiBase(options.base)
  if (base === null) return null

  const response = await (options.fetcher ?? fetch)(
    `${base}/api/premium-backgrounds/catalog`,
    {
      headers: getAuthHeaders(),
      signal: options.signal,
    },
  )
  if (!response.ok) {
    throw new BackgroundRequestError(
      response.status,
      'The stage catalog is unavailable.',
    )
  }
  return parsePremiumBackgroundCatalog(await response.json())
}

async function decodeImage(
  blob: Blob,
  objectUrl: string,
  signal?: AbortSignal,
): Promise<void> {
  if (signalAborted(signal)) throw new DOMException('Aborted', 'AbortError')

  if (typeof globalThis.createImageBitmap === 'function') {
    const bitmap = await globalThis.createImageBitmap(blob)
    bitmap.close()
    if (signalAborted(signal)) {
      throw new DOMException('Aborted', 'AbortError')
    }
    return
  }

  if (typeof Image === 'undefined') return
  await new Promise<void>((resolve, reject) => {
    const image = new Image()
    const abort = () => {
      image.src = ''
      reject(new DOMException('Aborted', 'AbortError'))
    }
    image.onload = () => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }
    image.onerror = () => {
      signal?.removeEventListener('abort', abort)
      reject(new Error('The stage image could not be decoded.'))
    }
    signal?.addEventListener('abort', abort, { once: true })
    image.src = objectUrl
  })
}

/**
 * Fetch and decode protected image bytes. The returned object URL has not been
 * installed anywhere; its caller owns it and must revoke it.
 */
export async function loadProtectedBackgroundObjectUrl(
  asset: PremiumBackgroundAsset,
  request: ProtectedBackgroundRequest = {},
): Promise<string> {
  const base = apiBase(request.base)
  if (base === null) {
    throw new BackgroundRequestError(503, 'Private stage delivery is offline.')
  }

  const version = request.version ?? asset.activeVersion
  const variant = request.variant ?? 'landscape-2k'
  if (!asset.variants.some((entry) => entry.name === variant)) {
    throw new BackgroundRequestError(404, 'That stage size is unavailable.')
  }

  const headers: Record<string, string> =
    request.capability !== undefined && request.capability !== ''
      ? {
          'X-Jam-Background-Capability': request.capability,
          ...(request.roomId === undefined
            ? {}
            : { 'X-Jam-Room-Id': request.roomId }),
        }
      : getAuthHeaders()
  const response = await (request.fetcher ?? fetch)(
    `${base}/api/premium-backgrounds/${encodeURIComponent(asset.id)}?variant=${encodeURIComponent(variant)}&version=${encodeURIComponent(version)}`,
    { headers, signal: request.signal },
  )
  if (!response.ok) {
    throw new BackgroundRequestError(
      response.status,
      response.status === 401 || response.status === 403
        ? 'This stage is no longer unlocked.'
        : 'This stage image is unavailable.',
    )
  }

  const blob = await response.blob()
  if (!blob.type.startsWith('image/')) {
    throw new BackgroundRequestError(
      502,
      'The stage response was not an image.',
    )
  }

  const createUrl =
    request.createObjectURL ?? ((value: Blob) => URL.createObjectURL(value))
  const revokeUrl =
    request.revokeObjectURL ?? ((url: string) => URL.revokeObjectURL(url))
  const objectUrl = createUrl(blob)
  try {
    await (request.decode ?? decodeImage)(blob, objectUrl, request.signal)
    if (signalAborted(request.signal)) {
      throw new DOMException('Aborted', 'AbortError')
    }
    return objectUrl
  } catch (error) {
    revokeUrl(objectUrl)
    throw error
  }
}

export async function mintJamBackgroundCapability(
  backgroundId: BackgroundPerkId,
  request: {
    roomId: string
    ownerToken: string
    version?: number
  } & RuntimeFetchOptions,
): Promise<JamBackgroundCapability> {
  const base = apiBase(request.base)
  if (base === null) {
    throw new BackgroundRequestError(503, 'Private stage delivery is offline.')
  }
  const response = await (request.fetcher ?? fetch)(
    `${base}/api/premium-backgrounds/${encodeURIComponent(backgroundId)}/capability`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        roomId: request.roomId,
        ownerToken: request.ownerToken,
        ...(request.version === undefined ? {} : { version: request.version }),
      }),
      signal: request.signal,
    },
  )
  if (!response.ok) {
    throw new BackgroundRequestError(
      response.status,
      'Guest access to this room stage could not be refreshed.',
    )
  }

  const data: unknown = await response.json()
  if (
    !isRecord(data) ||
    data.backgroundId !== backgroundId ||
    data.roomId !== request.roomId ||
    !finitePositiveInteger(data.version) ||
    typeof data.token !== 'string' ||
    data.token === '' ||
    typeof data.expiresAt !== 'string'
  ) {
    throw new BackgroundRequestError(502, 'Guest stage access was malformed.')
  }
  return {
    backgroundId,
    roomId: request.roomId,
    version: data.version,
    token: data.token,
    expiresAt: data.expiresAt,
  }
}

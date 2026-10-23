// ============================================================
// Splat backdrop request — what a development preview asked to draw beyond the fog.
// ============================================================
//
// Development hosts read this from the page query. A procedural world needs
// no download; a URL names a splat file (Spark reads .spz, .ply, .splat,
// .ksplat, .sog and its streamable .rad) and only same-site paths or https
// addresses are accepted, so a shared preview link cannot point the page at
// an arbitrary scheme.

export type SplatBackdropRequest =
  | { readonly kind: 'procedural'; readonly seed: number }
  | {
      readonly kind: 'url'
      readonly url: string
      /** Multiplier applied to the file's units; Marble reports its own metric scale. */
      readonly scale: number
      /** Vertical offset in metres, applied after scaling. */
      readonly offsetY: number
    }

export const DEFAULT_SPLAT_BACKDROP_SEED = 1

const SPLAT_FILE = /\.(spz|ply|splat|ksplat|sog|rad)$/i
const MAX_URL_LENGTH = 2048

function finiteInRange(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
): number | undefined {
  if (raw === null || raw === '') return fallback
  const value = Number(raw)
  return Number.isFinite(value) && value >= min && value <= max
    ? value
    : undefined
}

function acceptedUrl(raw: string): boolean {
  if (raw.length > MAX_URL_LENGTH) return false
  const path = raw.split(/[?#]/, 1)[0]
  if (!SPLAT_FILE.test(path)) return false
  if (raw.startsWith('/') && !raw.startsWith('//')) return true
  if (raw.startsWith('./') || raw.startsWith('../')) return true
  try {
    return new URL(raw).protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * `splats=procedural` (optionally `splatsSeed`), or `splats=<splat file>` with
 * optional `splatsScale` and `splatsY`. Anything malformed draws no splats.
 */
export function parseSplatBackdropRequest(
  query: URLSearchParams,
): SplatBackdropRequest | undefined {
  const values = query.getAll('splats')
  if (values.length !== 1) return undefined
  const raw = values[0].trim()
  if (raw === 'procedural') {
    const seed = finiteInRange(
      query.get('splatsSeed'),
      DEFAULT_SPLAT_BACKDROP_SEED,
      0,
      2 ** 31 - 1,
    )
    if (seed === undefined || !Number.isInteger(seed)) return undefined
    return { kind: 'procedural', seed }
  }
  if (!acceptedUrl(raw)) return undefined
  const scale = finiteInRange(query.get('splatsScale'), 1, 0.001, 1000)
  const offsetY = finiteInRange(query.get('splatsY'), 0, -500, 500)
  if (scale === undefined || offsetY === undefined) return undefined
  return { kind: 'url', url: raw, scale, offsetY }
}

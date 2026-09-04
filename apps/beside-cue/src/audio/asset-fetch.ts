// ============================================================
// Packaged asset reads across Capacitor's iOS custom origin
// ============================================================
//
// Capacitor's iOS `WebViewAssetHandler` answers an ordinary, non-Range GET
// for a bundled media extension with `URLResponse`, not `HTTPURLResponse`.
// WebKit therefore has bytes but no HTTP status and exposes this shape:
//
//   fetch('.../score.m4a')  ->  ok: false, status: 0, body: the whole file
//
// Android's local server returns an explicit 200 for the same asset. The
// portable success condition for these packaged reads is therefore a normal
// success status OR status 0 with a non-empty body.

/** What a caller needs from a Response. Narrow on purpose: this is what
 * makes the whole thing testable without a network or a WebView. */
export interface AssetResponse {
  readonly ok: boolean
  readonly status: number
  arrayBuffer(): Promise<ArrayBuffer>
}

/**
 * Did this response actually fail?
 *
 * Status 0 with a body is a success on a custom scheme, and there is no
 * opaque cross-origin response also reports 0, but its body is unreadable or
 * empty and this helper rejects that after the read.
 */
export const assetResponseFailed = (response: AssetResponse): boolean =>
  !response.ok && response.status !== 0

/**
 * Read a packaged asset's bytes, or throw with something worth reading.
 *
 * The message names the URL as well as the status, because the failure
 * this replaces was invisible: the loaders logged nothing, so a device
 * report could not distinguish "the file is not there" from "the file
 * will not decode".
 */
export const readAssetBytes = async (
  url: string,
  response: AssetResponse,
): Promise<ArrayBuffer> => {
  if (assetResponseFailed(response)) {
    throw new Error(`Asset request failed (${String(response.status)}): ${url}`)
  }
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength === 0) {
    // The one case a zero status could genuinely be hiding. Cheap to
    // check, and it turns a silent decode failure into a named one.
    throw new Error(`Asset was empty: ${url}`)
  }
  return bytes
}

/** `fetch`, then the two checks above. The shape both audio loaders
 * inject in tests, so neither has its own copy of this rule. */
export const fetchAssetBytes = async (
  url: string,
  init?: RequestInit,
): Promise<ArrayBuffer> => readAssetBytes(url, await fetch(url, init))

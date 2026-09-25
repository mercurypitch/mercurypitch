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
//
// Shared, because the rule is a fact about the WebView and not about one
// app. Beside Cue found it on 4 Sep 2026 (its onboarding was silent on
// iOS); Mercury Pitch shipped the same `if (!response.ok) throw` three weeks
// later in the alley's ambient loader and in the guided exercise waveform,
// and both were silent on iOS for the same reason. Every packaged read of a
// media file goes through here.
//
// Plugin-free on purpose: nothing below imports Capacitor, so the web app
// can read its own bundled media through this entry too.

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
 * Status 0 with a body is a success on a custom scheme. An opaque
 * cross-origin response also reports 0, but its body is unreadable or empty,
 * and this helper rejects that after the read.
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

/** `fetch`, then the two checks above. The shape every packaged-media
 * loader uses or injects in tests, so none has its own copy of this rule. */
export const fetchAssetBytes = async (
  url: string,
  init?: RequestInit,
): Promise<ArrayBuffer> => readAssetBytes(url, await fetch(url, init))

/** A packaged read, with what the response said about itself. */
export interface AssetRead {
  readonly bytes: ArrayBuffer
  /** 0 on iOS for a packaged media file, 200 everywhere else. */
  readonly status: number
  readonly ok: boolean
}

/**
 * `fetchAssetBytes`, keeping the status the bytes arrived with.
 *
 * For a loader that reports its reads (the alley's ambient does, to the
 * device's audio diagnostics): "status 0, ok false, 266161 bytes" beside a
 * decoded buffer is the one line that tells the iOS shape apart from a 200.
 */
export const fetchAssetRead = async (
  url: string,
  init?: RequestInit,
): Promise<AssetRead> => {
  const response = await fetch(url, init)
  const bytes = await readAssetBytes(url, response)
  return { bytes, status: response.status, ok: response.ok }
}

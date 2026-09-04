// Reading a packaged asset, on a platform that has no HTTP status.
// ============================================================
//
// This exists because of one bug, and the bug is worth writing down in
// full, because the code that caused it looks completely correct.
//
// The app ships natively through Capacitor. On Android the WebView loads
// over https:// from `WebViewLocalServer`, which builds a real
// `WebResourceResponse` with an explicit 200 on it. On iOS there is no
// server at all: `capacitor.config.ts` sets `androidScheme` and no
// `iosScheme`, so iOS falls back to the default `capacitor` scheme and
// every asset is answered by `WebViewAssetHandler`, a
// `WKURLSchemeHandler`.
//
// That handler branches on the file EXTENSION. `isMediaExtension` lists
// m4a, mp4, mp3, wav, aac, mov. A request for one of those WITHOUT a
// Range header is answered with a bare `URLResponse` -- while every
// other file gets an `HTTPURLResponse` carrying a status line. A
// URLResponse has no status, so WebKit hands JavaScript a Response with
// `status === 0`, and the Fetch spec defines `ok` as `status` in
// 200..299. So:
//
//   fetch('.../score.m4a')  ->  ok: false, status: 0, body: the whole file
//
// `fetch` never sends a Range header, so an audio loader always takes
// that branch. Both of this app's loaders then threw on their own
// `if (!response.ok)` guard -- before `decodeAudioData` was ever
// reached -- and both swallowed the throw. The onboarding was silent on
// iOS, loud on Android, with nothing in any log to say why. It survived
// two rounds of device testing being described as "no sound", because
// every visible symptom pointed at the audio session or the codec, and
// both of those were fine.
//
// THE RULE THIS MODULE ENCODES: a zero status is not a failure. It is
// what a scheme handler returns when it has no status to give. What
// decides whether an asset read worked is whether bytes arrived.
//
// Ruled out by measurement while finding this, and recorded so nobody
// re-runs them: the packaged m4a files are ordinary AAC-LC in an
// `M4A ` container with a version-0 sample entry (not the QuickTime
// shape Safari's decoder refuses), the mp4s are all faststart already,
// and the native AVAudioSession category is set and correct.

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
 * other case in this app where a 0 could arrive: an opaque cross-origin
 * response also reports 0, and this is only ever used for assets that
 * ship inside the bundle.
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

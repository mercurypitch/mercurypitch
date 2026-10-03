// ============================================================
// Artwork for the system's media controls, handed over as data
// ============================================================
//
// Neither native half of the media session plugin can load one of the app's
// own URLs. Android's opens an HTTP connection from Java, which never reaches
// the WebView's local server; iOS's hands the URL to URLSession, which knows
// nothing of the capacitor:// scheme. Both decode a data: URL (Android by its
// ";base64," part, iOS through URLSession), so the picture is read once in
// the WebView, where the app's URLs resolve, and passed on as one.

import { fetchAssetBytes } from './asset-fetch'

/** The data: URL's type, by the file's extension. Both halves decode by the
 * bytes; the type only has to be honest. */
const TYPES: Readonly<Record<string, string>> = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
}

/** Bytes per String.fromCharCode call: well under any engine's limit on
 * arguments. */
const CHUNK = 0x8000

function typeOf(url: string): string {
  const extension = /\.(\w+)(?:[?#].*)?$/u.exec(url)?.[1]?.toLowerCase()
  return (
    (extension === undefined ? undefined : TYPES[extension]) ??
    'application/octet-stream'
  )
}

function base64Of(bytes: Uint8Array): string {
  let binary = ''
  for (let start = 0; start < bytes.length; start += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(start, start + CHUNK))
  }
  return btoa(binary)
}

/** Each picture asked for, by URL: read, being read, or failed and gone. */
const pictures = new Map<string, Promise<string | null>>()

/**
 * The picture at `url` as a data: URL, or null when it cannot be read.
 *
 * Read once per URL, through the packaged-read rule (iOS serves some bundled
 * files with status 0, see asset-fetch.ts). A read that fails is forgotten,
 * so the next call tries again: a song is never held up by its picture.
 */
export function artworkDataUrl(url: string): Promise<string | null> {
  const known = pictures.get(url)
  if (known !== undefined) return known
  const reading = fetchAssetBytes(url).then(
    (bytes) => `data:${typeOf(url)};base64,${base64Of(new Uint8Array(bytes))}`,
    () => {
      pictures.delete(url)
      return null
    },
  )
  pictures.set(url, reading)
  return reading
}

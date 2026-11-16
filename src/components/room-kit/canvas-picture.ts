// ============================================================
// Canvas pictures: a room's art decoded for a canvas to copy from
// ============================================================
//
// The glide rooms (Lip roll's bay, Ng slides' bridge) copy strips of a lit
// picture into a canvas over the unlit one. A 2d canvas drawing an <img>
// decodes it again, on the main thread, in the commit of the frame that
// first draws it, whatever img.decode() did before: Lip roll's wave pair
// (1451 x 1190 with alpha) cost 112 ms there at 4x CPU, the frame of the
// first lit strip 167 ms (measured 2026-10-15).
//
// So a picture a canvas copies from is the file's bytes through
// createImageBitmap, which decodes on a worker thread. Its pixels are the
// <img>'s, byte for byte (the same check, 2026-10-15). Without
// createImageBitmap, or when the fetch fails, it is the room's own <img>
// loader's picture, and the canvas decodes it as before. The room owns
// every bitmap it asks for and lets each go when it leaves
// (`releasePicture`).
//
// A small picture is not a file at all: under 4 KB the build inlines it
// into the script as a `data:` address, as it does Ng slides' two
// reflections (934 and 2,754 bytes). The web's content security policy
// lets a fetch reach the site itself, https and blob addresses, and no
// data one (`connect-src`, public/_headers), so fetching such an address
// was refused on every visit, with two errors in the console for each
// picture, and the picture came through the <img> after all (seen on the
// dev site, 16 November 2026). Its bytes are in the address, so they are
// read from there, and a data address is never fetched.

/** A picture a canvas copies from, decoded. */
export type CanvasPicture = HTMLImageElement | ImageBitmap

/**
 * The bytes a `data:` address carries, as a blob of its type; null for an
 * address that is not one, or that cannot be read as one.
 */
export function inlineBlob(url: string): Blob | null {
  if (!url.startsWith('data:')) return null
  const comma = url.indexOf(',')
  if (comma < 0) return null
  const head = url.slice('data:'.length, comma)
  const body = url.slice(comma + 1)
  const base64 = /;base64$/i.test(head)
  const type = head.replace(/;base64$/i, '').split(';')[0] ?? ''
  try {
    if (!base64) return new Blob([decodeURIComponent(body)], { type })
    const text = atob(body)
    const bytes = new Uint8Array(text.length)
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i)
    return new Blob([bytes], { type })
  } catch {
    return null
  }
}

/** The file at `url` as a blob, or null where it cannot be had: an inlined
 *  picture from its own address, any other by a fetch. */
async function pictureBlob(url: string): Promise<Blob | null> {
  if (url.startsWith('data:')) return inlineBlob(url)
  if (typeof fetch !== 'function') return null
  const response = await fetch(url)
  return response.ok ? await response.blob() : null
}

/**
 * The picture at `url`, decoded off the main thread; `fallback` (the
 * room's <img> loader) where that cannot be done. Rejects only as the
 * fallback does.
 */
export async function decodePicture(
  url: string,
  fallback: (url: string) => Promise<HTMLImageElement>,
): Promise<CanvasPicture> {
  if (typeof globalThis.createImageBitmap === 'function') {
    try {
      const blob = await pictureBlob(url)
      if (blob !== null) return await globalThis.createImageBitmap(blob)
    } catch {
      // The <img> below: it reports a file that will not load.
    }
  }
  return fallback(url)
}

/** Done with a picture: a bitmap's pixels go; an <img> stays its loader's. */
export function releasePicture(picture: CanvasPicture): void {
  if (typeof ImageBitmap !== 'undefined' && picture instanceof ImageBitmap) {
    picture.close()
  }
}

/** A picture's size in px. */
export function pictureSize(picture: CanvasPicture): {
  width: number
  height: number
} {
  return 'naturalWidth' in picture
    ? {
        width: picture.naturalWidth || picture.width,
        height: picture.naturalHeight || picture.height,
      }
    : { width: picture.width, height: picture.height }
}

/**
 * Several pictures decoded together, or none: a set with any picture
 * that will not load releases the ones that did, and rejects.
 */
export async function decodePictures(
  urls: readonly string[],
  fallback: (url: string) => Promise<HTMLImageElement>,
): Promise<CanvasPicture[]> {
  const settled = await Promise.allSettled(
    urls.map((url) => decodePicture(url, fallback)),
  )
  const pictures: CanvasPicture[] = []
  for (const result of settled) {
    if (result.status === 'fulfilled') pictures.push(result.value)
  }
  if (pictures.length < urls.length) {
    pictures.forEach(releasePicture)
    throw new Error('canvas pictures: not every picture loaded')
  }
  return pictures
}

/** A room's pictures for its canvases, decoded once a visit. */
export interface PictureSet {
  /** The pictures, in `urls` order: decoded on the first ask, then kept. */
  get: () => Promise<CanvasPicture[]>
  /** The room is leaving: every bitmap goes, now or once it has decoded. */
  release: () => void
}

/**
 * The pictures at `urls`, asked for once and kept until `release`. A set
 * that failed to load is asked for again on the next `get`.
 */
export function createPictureSet(
  urls: () => readonly string[],
  fallback: (url: string) => Promise<HTMLImageElement>,
): PictureSet {
  let asked: Promise<CanvasPicture[]> | null = null
  let released = false
  const gone = (): Error => new Error('canvas pictures: released')
  return {
    get: () => {
      if (released) return Promise.reject(gone())
      if (asked !== null) return asked
      const next = decodePictures(urls(), fallback).then(
        (pictures) => {
          if (!released) return pictures
          pictures.forEach(releasePicture)
          throw gone()
        },
        (error: unknown) => {
          asked = null
          throw error
        },
      )
      asked = next
      return next
    },
    release: () => {
      released = true
      void asked?.then(
        (pictures) => pictures.forEach(releasePicture),
        () => undefined,
      )
    },
  }
}

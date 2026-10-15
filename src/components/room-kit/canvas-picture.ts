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

/** A picture a canvas copies from, decoded. */
export type CanvasPicture = HTMLImageElement | ImageBitmap

/**
 * The picture at `url`, decoded off the main thread; `fallback` (the
 * room's <img> loader) where that cannot be done. Rejects only as the
 * fallback does.
 */
export async function decodePicture(
  url: string,
  fallback: (url: string) => Promise<HTMLImageElement>,
): Promise<CanvasPicture> {
  if (
    typeof globalThis.createImageBitmap === 'function' &&
    typeof fetch === 'function'
  ) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return await globalThis.createImageBitmap(await response.blob())
      }
    } catch {
      // The <img> below: it reports a file that will not load.
    }
  }
  return fallback(url)
}

/**
 * Start the file's download ahead of its decodePicture, keeping nothing:
 * the bytes wait in the HTTP cache (hashed /assets/ files are immutable
 * there, public/_headers), not as a decoded picture in memory.
 */
export function warmPicture(url: string): void {
  if (url === '' || typeof fetch !== 'function') return
  void fetch(url)
    .then((response) => (response.ok ? response.arrayBuffer() : undefined))
    .catch(() => undefined)
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

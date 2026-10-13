// ============================================================
// Plate loader: a premium room's painted plates, decoded before they show
// ============================================================
//
// A room's world can be one painted plate as tall as the phone: Echo's sky
// over the rooftops is 1290 x 3096 px, 16 MB once decoded, and decoding it
// takes tens of milliseconds on a phone. So it starts on the singer's tap,
// while the screen pushes in: `preloadPlate` builds the very `<picture>`
// the room will show and starts `img.decode()`. The room adopts that
// picture (`claimPlate`) instead of loading a second copy. Nothing claims a
// preload after CLAIM_MS: it is released, so a tap that never became a
// room holds no pixels.
//
// The browser picks the file, as for any `<picture>`: the first `<source>`
// whose media query matches (a tablet's own plate, by the screen's shape),
// else the image's own set, each by width descriptors against `sizes`. A
// phone at DPR 2 or under takes the 860 px plate (7 MB decoded), a DPR 3
// phone the 1290 px one. A screen that changes shape switches plates by
// itself.
//
// The room releases a plate when it leaves: every src and srcset is
// cleared, so the decoded pixels can go (ART-FIDELITY.md 3.4, budgets).

/** One file of a plate and its width in px, for a `w` descriptor. */
export interface PlateCandidate {
  readonly url: string
  readonly width: number
}

/** A `<source>`: its files, for screens that match `media`. */
export interface PlateSource {
  readonly media: string
  readonly candidates: readonly PlateCandidate[]
}

export interface PlateSpec {
  /** One plate, one key: a preload and a claim meet on it. */
  readonly key: string
  /** The default files, for every screen no source matches. */
  readonly candidates: readonly PlateCandidate[]
  /** `<picture>` sources, first match wins (a tablet's plate). */
  readonly sources?: readonly PlateSource[]
  /** How wide the plate is drawn, as the `sizes` attribute says it. */
  readonly sizes: string
}

/** A plate on the page or on its way: its picture and the image in it. */
export interface Plate {
  readonly picture: HTMLPictureElement
  readonly img: HTMLImageElement
}

/** A preload nobody claimed is let go after this, ms. */
export const CLAIM_MS = 10_000

/** `url 860w, url 1290w` for a candidate list. */
export function srcsetOf(candidates: readonly PlateCandidate[]): string {
  return candidates.map((c) => `${c.url} ${c.width}w`).join(', ')
}

interface Preload {
  readonly plate: Plate
  readonly expiry: ReturnType<typeof setTimeout>
}

const preloads = new Map<string, Preload>()
const decodes = new WeakMap<HTMLImageElement, Promise<void>>()

/**
 * The image's decode: `decode()` where the browser has it, else its load
 * event. Rejects when the file will not load or decode, or when the
 * picture switched files mid-decode; a rejection is not kept, so asking
 * again decodes the file the picture holds now.
 */
export function plateDecoded(img: HTMLImageElement): Promise<void> {
  const known = decodes.get(img)
  if (known !== undefined) return known
  const done =
    typeof img.decode === 'function'
      ? img.decode()
      : new Promise<void>((resolve, reject) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve()
            return
          }
          img.addEventListener('load', () => resolve(), { once: true })
          img.addEventListener('error', () => reject(new Error('plate')), {
            once: true,
          })
        })
  decodes.set(img, done)
  // A rejection nobody awaits is still handled: the room shows its fallback.
  done.catch(() => {
    if (decodes.get(img) === done) decodes.delete(img)
  })
  return done
}

/** The plate's `<picture>`: its sources, then the image with the default set. */
export function buildPlate(spec: PlateSpec): Plate {
  const picture = document.createElement('picture')
  for (const source of spec.sources ?? []) {
    const el = document.createElement('source')
    el.media = source.media
    el.sizes = spec.sizes
    el.srcset = srcsetOf(source.candidates)
    picture.append(el)
  }
  const img = new Image()
  img.decoding = 'async'
  img.alt = ''
  img.draggable = false
  img.sizes = spec.sizes
  img.srcset = srcsetOf(spec.candidates)
  picture.append(img)
  return { picture, img }
}

/** Start loading and decoding a plate now, for a room about to open. */
export function preloadPlate(spec: PlateSpec): void {
  // Asked again before the room claimed it: the first preload stands.
  if (preloads.has(spec.key)) return
  const plate = buildPlate(spec)
  const expiry = setTimeout(() => dropPreload(spec.key), CLAIM_MS)
  preloads.set(spec.key, { plate, expiry })
  void plateDecoded(plate.img)
}

function dropPreload(key: string): void {
  const preload = preloads.get(key)
  if (preload === undefined) return
  preloads.delete(key)
  clearTimeout(preload.expiry)
  releasePlate(preload.plate)
}

/**
 * The plate for the room to show: the preloaded one when the tap made it,
 * else a fresh one that starts loading now.
 */
export function claimPlate(spec: PlateSpec): Plate {
  const preload = preloads.get(spec.key)
  if (preload === undefined) return buildPlate(spec)
  preloads.delete(spec.key)
  clearTimeout(preload.expiry)
  return preload.plate
}

/** A plate is let go: no file, no pixels, out of the page. */
export function releasePlate(plate: Plate): void {
  // The image's own set first: a source cleared before it would hand the
  // picture back to that set and start a load nobody wants.
  for (const el of [...plate.picture.children].reverse()) {
    el.removeAttribute('srcset')
    el.removeAttribute('src')
  }
  plate.picture.remove()
  decodes.delete(plate.img)
}

/** Every preload let go, for tests. */
export function resetPlatesForTests(): void {
  for (const key of [...preloads.keys()]) dropPreload(key)
}

/** Whether a preload of `key` is waiting for its room, for tests. */
export function hasPreload(key: string): boolean {
  return preloads.has(key)
}

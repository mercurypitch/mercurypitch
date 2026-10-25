// ============================================================
// Lesson kit DOM helpers — queries, SVG, maths and safe storage
// ============================================================
//
// The lesson pages are plain documents with no framework: every section is
// markup already in the HTML, and each module finds its own elements. A
// missing element is a broken page, so `q` throws instead of handing back
// null: a renamed id fails on the first load, not on the first tap.

export const TAU = Math.PI * 2
const SVG_NS = 'http://www.w3.org/2000/svg'

export function q<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T {
  const found = root.querySelector<T>(selector)
  if (found === null) throw new Error(`lesson: no element for ${selector}`)
  return found
}

export function qa<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T[] {
  return Array.from(root.querySelectorAll<T>(selector))
}

/** An SVG element with its attributes; `text` sets the text content. */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | null | undefined> = {},
  parent?: Element,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined) continue
    if (key === 'text') el.textContent = String(value)
    else el.setAttribute(key, String(value))
  }
  parent?.appendChild(el)
  return el
}

export const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v))
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
/** Hermite smoothstep of x between a and b. */
export function smooth(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

export const easeInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2

/** A seeded generator, so scattered stars and air sit in the same places on every visit. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * localStorage that never throws: a private window, blocked site data or a
 * full quota keep the choice for this visit only.
 */
export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = window.localStorage.getItem(key)
      return raw === null ? fallback : (JSON.parse(raw) as T)
    } catch {
      return fallback
    }
  },
  set(key: string, value: unknown): void {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // kept for this visit only
    }
  },
}

export const wait = (seconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, seconds * 1000))

/**
 * Whether the welcome tour is up, or the page still coming to rest after it
 * (tour.ts marks <html> `touring`): its glides pass steps nobody read, so
 * nothing then counts as reading (step-deck.ts, position.ts).
 */
export const touring = (): boolean =>
  document.documentElement.classList.contains('touring')

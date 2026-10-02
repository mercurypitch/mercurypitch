// ============================================================
// Store shots: where a capture's words and controls sit
// ============================================================
//
// Read from the page right after each screenshot and written beside the PNG
// as <name>.layout.json (store.shots.ts), so a composition built from the PNG
// can keep a cut or an overlap clear of them. What the file holds: README.md.

import type { Page } from '@playwright/test'

/** A box in the viewport, in CSS px. */
export interface Box {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * Where a capture's words and controls sit, written beside its PNG as
 * <name>.layout.json, so a composition built from the PNG can keep a cut or
 * an overlap clear of them. CSS px of the viewport; `scale` turns them into
 * the PNG's pixels.
 */
export interface CaptureLayout {
  readonly viewport: { readonly width: number; readonly height: number }
  readonly scale: number
  /** The box of the landmark the capture waited for. */
  readonly landmark: Box | null
  /**
   * Each visible line of each text node, cut to what its clipping ancestors
   * let show. A line less than half visible is left out, and so is text
   * kept for screen readers only.
   */
  readonly words: readonly (Box & { readonly text: string })[]
  /** Each visible button, link, field, tab, slider or switch, cut the same way. */
  readonly controls: readonly (Box & { readonly label: string })[]
  /**
   * Controls that read as one object, which a cut must keep whole: a painted
   * container holding two or more of them (a pill, a bar), or a row of them
   * set close together (a chip row). `kind` says which; `size` is how many
   * controls it holds.
   */
  readonly groups: readonly (Box & {
    readonly kind: 'container' | 'row'
    readonly size: number
    readonly labels: readonly string[]
  })[]
  /** The Ear Lab's serif as this browser drew it, held to the project's `systemSerif`. */
  readonly serif?: {
    readonly text: string
    readonly faces: readonly string[]
    readonly expected: string | null
  }
}

/** The words, controls and control groups on screen, read right after a screenshot. */
export function wordsAndControls(
  page: Page,
  minShare = 0.5,
): Promise<Pick<CaptureLayout, 'words' | 'controls' | 'groups'>> {
  return page.evaluate((share) => {
    const viewport = {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
    }
    type Rect = { left: number; top: number; right: number; bottom: number }
    const meet = (a: Rect, b: Rect): Rect => ({
      left: Math.max(a.left, b.left),
      top: Math.max(a.top, b.top),
      right: Math.min(a.right, b.right),
      bottom: Math.min(a.bottom, b.bottom),
    })
    const area = (r: Rect) =>
      Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top)
    // What an element's clipping ancestors and the viewport leave of a box:
    // the stage that scrolls, a sheet, a screen-reader-only span (1 x 1 px,
    // overflow hidden) all clip.
    const clipped = (element: Element, box: Rect): Rect => {
      let out = meet(box, viewport)
      for (
        let e: Element | null = element;
        e !== null && e !== document.documentElement;
        e = e.parentElement
      ) {
        const style = window.getComputedStyle(e)
        if (style.visibility === 'hidden' || Number(style.opacity) === 0) {
          return { left: 0, top: 0, right: 0, bottom: 0 }
        }
        if (
          e !== element &&
          (style.overflowX !== 'visible' || style.overflowY !== 'visible')
        ) {
          out = meet(out, e.getBoundingClientRect())
        }
        if (
          style.clip === 'rect(0px, 0px, 0px, 0px)' ||
          style.clipPath === 'inset(50%)'
        ) {
          return { left: 0, top: 0, right: 0, bottom: 0 }
        }
      }
      return out
    }
    const plain = (box: Rect) => ({
      x: Math.round(box.left * 100) / 100,
      y: Math.round(box.top * 100) / 100,
      width: Math.round((box.right - box.left) * 100) / 100,
      height: Math.round((box.bottom - box.top) * 100) / 100,
    })
    // Enough of it shows (half, for the layout file): the part that does is
    // what is recorded.
    const showing = (element: Element, box: Rect): Rect | null => {
      if (area(box) === 0) return null
      const left = clipped(element, box)
      return area(left) > 0 && area(left) >= area(box) * share ? left : null
    }

    const words: (ReturnType<typeof plain> & { text: string })[] = []
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    )
    while (walker.nextNode()) {
      const node = walker.currentNode
      const text = node.textContent?.trim() ?? ''
      if (node.parentElement === null || text === '') continue
      const range = document.createRange()
      range.selectNodeContents(node)
      for (const box of range.getClientRects()) {
        const left = showing(node.parentElement, box)
        if (left !== null) words.push({ text, ...plain(left) })
      }
    }

    const shownControls = [
      ...document.querySelectorAll(
        'button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="slider"], [role="switch"]',
      ),
    ].flatMap((element) => {
      const box = showing(element, element.getBoundingClientRect())
      if (box === null) return []
      const label =
        element.getAttribute('aria-label') ??
        element.textContent?.trim().slice(0, 60) ??
        ''
      return [{ element, label, box }]
    })
    const controls = shownControls.map((c) => ({
      label: c.label,
      ...plain(c.box),
    }))

    // Groups. A painted container: the nearest ancestor that draws a box
    // (a fill, an image, a border, a shadow or a backdrop blur) around two
    // or more controls, short of a page-sized surface.
    const alpha = (color: string): number => {
      if (color === 'transparent') return 0
      const slash = /\/\s*([\d.]+)(%?)\s*\)$/u.exec(color)
      if (slash) return Number(slash[1]) / (slash[2] === '%' ? 100 : 1)
      const comma = /^rgba\(.*,\s*([\d.]+)\s*\)$/u.exec(color)
      return comma ? Number(comma[1]) : 1
    }
    const paints = (style: CSSStyleDeclaration): boolean =>
      alpha(style.backgroundColor) > 0.05 ||
      style.backgroundImage !== 'none' ||
      style.boxShadow !== 'none' ||
      (style.backdropFilter !== '' && style.backdropFilter !== 'none') ||
      (['Top', 'Right', 'Bottom', 'Left'] as const).some(
        (side) =>
          Number.parseFloat(style[`border${side}Width`]) > 0 &&
          style[`border${side}Style`] !== 'none' &&
          alpha(style[`border${side}Color`]) > 0.05,
      )
    const pageArea = window.innerWidth * window.innerHeight
    const groups: (ReturnType<typeof plain> & {
      kind: 'container' | 'row'
      size: number
      labels: string[]
    })[] = []
    const seen = new Set<Element>()
    for (const c of shownControls) {
      for (
        let e = c.element.parentElement;
        e !== null && e !== document.body;
        e = e.parentElement
      ) {
        const box = e.getBoundingClientRect()
        if (box.width * box.height > pageArea / 2) break
        const inside = shownControls.filter(
          (o) => o.element !== e && e.contains(o.element),
        )
        if (inside.length < 2 || !paints(window.getComputedStyle(e))) continue
        if (!seen.has(e)) {
          seen.add(e)
          const left = showing(e, box)
          if (left !== null) {
            groups.push({
              kind: 'container',
              size: inside.length,
              labels: inside.map((o) => o.label.slice(0, 40)),
              ...plain(left),
            })
          }
        }
        break
      }
    }
    // A row: controls whose middles share a line and whose edges sit within
    // 24 px of the next, like a chip row or a transport.
    const parent = shownControls.map((_, i) => i)
    const root = (i: number): number =>
      parent[i] === i ? i : (parent[i] = root(parent[i]))
    shownControls.forEach((a, i) => {
      shownControls.forEach((b, j) => {
        if (j <= i) return
        const ha = a.box.bottom - a.box.top
        const hb = b.box.bottom - b.box.top
        if (Math.max(ha, hb) > 120) return
        const sameLine =
          Math.abs(
            (a.box.top + a.box.bottom) / 2 - (b.box.top + b.box.bottom) / 2,
          ) <=
          0.3 * Math.min(ha, hb)
        const gap =
          Math.max(a.box.left, b.box.left) - Math.min(a.box.right, b.box.right)
        if (sameLine && gap <= 24) parent[root(i)] = root(j)
      })
    })
    const rows = new Map<number, typeof shownControls>()
    shownControls.forEach((c, i) => {
      const r = root(i)
      rows.set(r, [...(rows.get(r) ?? []), c])
    })
    for (const row of rows.values()) {
      if (row.length < 2) continue
      groups.push({
        kind: 'row',
        size: row.length,
        labels: row.map((o) => o.label.slice(0, 40)),
        ...plain({
          left: Math.min(...row.map((o) => o.box.left)),
          top: Math.min(...row.map((o) => o.box.top)),
          right: Math.max(...row.map((o) => o.box.right)),
          bottom: Math.max(...row.map((o) => o.box.bottom)),
        }),
      })
    }
    return { words, controls, groups }
  }, minShare)
}

/**
 * The faces the browser drew an element's own text in, read through the
 * DevTools protocol: the first serif-set line inside `within`. The page is
 * marked to find the node and unmarked after.
 */
export async function serifFaces(
  page: Page,
  within: string,
): Promise<{ text: string; faces: string[] }> {
  const text = await page.evaluate((selector) => {
    const scope = document.querySelector(selector)
    if (scope === null) return null
    for (const element of scope.querySelectorAll('*')) {
      if (!/Iowan Old Style/u.test(window.getComputedStyle(element).fontFamily))
        continue
      const own = [...element.childNodes].find(
        (n) =>
          n.nodeType === Node.TEXT_NODE && (n.textContent?.trim() ?? '') !== '',
      )
      if (own === undefined) continue
      element.setAttribute('data-shot-serif', '')
      return own.textContent?.trim() ?? ''
    }
    return null
  }, within)
  if (text === null) throw new Error(`No serif-set text inside ${within}.`)
  const cdp = await page.context().newCDPSession(page)
  try {
    await cdp.send('DOM.enable')
    await cdp.send('CSS.enable')
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 })
    const { nodeId } = await cdp.send('DOM.querySelector', {
      nodeId: root.nodeId,
      selector: '[data-shot-serif]',
    })
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
    return {
      text,
      faces: [...fonts]
        .sort((a, b) => b.glyphCount - a.glyphCount)
        .map((f) => f.familyName),
    }
  } finally {
    await page.evaluate(() =>
      document
        .querySelector('[data-shot-serif]')
        ?.removeAttribute('data-shot-serif'),
    )
    await cdp.detach()
  }
}

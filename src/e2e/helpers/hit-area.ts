// ============================================================
// hit-area — where a control actually takes a press
// ============================================================
//
// A bounding box is not the target: a transparent pseudo-element can widen
// it, and a neighbour's can take part of it away. So this asks the browser,
// with `elementFromPoint`, how far from the control's centre a press still
// lands on it, along the centre row and column, and whether the middle of
// every edge of its own drawn box still does. A press on a field's <label>
// lands on the field, as it does in the browser. Read before any assertion
// that a control is "at least 44 px" or that two controls do not share a
// press; `neighbourAreas` gives the presses of the controls near enough for
// a grown box to reach, and `bringToMiddle` puts a control where a hit-test
// can read all of it.

import type { Locator } from '@playwright/test'

export interface HitArea {
  /** The drawn box, width and height. */
  box: [number, number]
  /** How far the press reaches, width and height, through the centre. */
  hit: [number, number]
  /** That reach as a rectangle: left, top, right, bottom. */
  rect: [number, number, number, number]
  /** The centre and the middle of every edge of the drawn box, 2 px in,
   *  land on it. */
  ownsItsBox: boolean
}

export function hitArea(control: Locator): Promise<HitArea> {
  return control.evaluate((element) => {
    const r = element.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const lands = (x: number, y: number): boolean => {
      const target = document.elementFromPoint(x, y)
      if (target === null) return false
      if (target === element || element.contains(target)) return true
      // A press on a field's <label> is a press on the field: the browser
      // hands it the focus. The app-check sweep counts it the same way.
      return target instanceof HTMLLabelElement && target.control === element
    }
    const reach = (dx: number, dy: number): number => {
      let n = 0
      for (let step = 1; step <= 60; step++) {
        if (!lands(cx + dx * step, cy + dy * step)) break
        n = step
      }
      return n
    }
    const left = reach(-1, 0)
    const right = reach(1, 0)
    const up = reach(0, -1)
    const down = reach(0, 1)
    // The middle of each edge, not the corners: the browser hit-tests the
    // rounded shape a control draws, so a round button never owns its
    // bounding box's corners.
    const points: [number, number][] = [
      [cx, cy],
      [cx, r.top + 2],
      [r.right - 2, cy],
      [cx, r.bottom - 2],
      [r.left + 2, cy],
    ]
    return {
      box: [r.width, r.height],
      hit: [left + right + 1, up + down + 1],
      rect: [cx - left, cy - up, cx + right, cy + down],
      ownsItsBox: points.every(([x, y]) => lands(x, y)),
    }
  })
}

/** Scroll `control` to the middle of its scrollers and the screen, before
 *  hit-testing it: a hit-test reads only what is on screen and on top, so
 *  a control left at an edge, under the phone's tab bar, loses part of its
 *  press to the bar. */
export async function bringToMiddle(control: Locator): Promise<void> {
  await control.evaluate((element) =>
    element.scrollIntoView({
      behavior: 'instant',
      block: 'center',
      inline: 'center',
    }),
  )
}

/** The press of every other visible control within `within` px of
 *  `control`'s drawn box: the ones a grown box could reach. */
export async function neighbourAreas(
  control: Locator,
  within = 60,
): Promise<HitArea[]> {
  const page = control.page()
  await control.evaluate((element, within) => {
    for (const marked of Array.from(
      document.querySelectorAll('[data-e2e-near]'),
    ))
      marked.removeAttribute('data-e2e-near')
    const r = element.getBoundingClientRect()
    const all = document.querySelectorAll(
      'button, a[href], input, select, textarea',
    )
    for (const other of Array.from(all)) {
      if (other === element) continue
      const o = other.getBoundingClientRect()
      if (o.width === 0 || o.height === 0) continue
      const dx = Math.max(o.left - r.right, r.left - o.right, 0)
      const dy = Math.max(o.top - r.bottom, r.top - o.bottom, 0)
      if (dx <= within && dy <= within) other.setAttribute('data-e2e-near', '')
    }
  }, within)
  const near = await page.locator('[data-e2e-near]').all()
  const areas: HitArea[] = []
  for (const other of near) areas.push(await hitArea(other))
  return areas
}

/** Whether two reach rectangles share any press (more than half a pixel). */
export function sharePress(a: HitArea['rect'], b: HitArea['rect']): boolean {
  const width = Math.min(a[2], b[2]) - Math.max(a[0], b[0])
  const height = Math.min(a[3], b[3]) - Math.max(a[1], b[1])
  return width > 0.5 && height > 0.5
}

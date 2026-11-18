// ============================================================
// The bench and the Ear Report on a wide window
// ============================================================
//
// Merc's bench was drawn for a phone, and until November 2026 a desk got
// that phone's column in the middle of the window: 528 px of bench in the
// 1,130 px the web's sidebar leaves at 1440x900, while every drill's room
// filled the window. From 860 px of tab the bench is a desk now (merc/
// bench.module.css, "A wide window"): Merc at his desk beside the Mercury
// Index and Today, the Ear rooms and the stations three to a row under
// them, the Ear Path beside the Ear Report; and the report lays its Index
// beside what moved and its maps two to a row (report.module.css).
//
// The boxes are measured, not the classes: a layout that only looked wide,
// or that bought its width by laying one part over another, fails here.
// The phone keeps its column, and that is measured too.

import { expect, test, type Page } from '@playwright/test'
import { dismissOverlays, openNavTab } from './helpers/ui'

interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** The bench's parts, where they stand, and whether any lies over another. */
function measureBench(page: Page) {
  return page.evaluate(() => {
    const box = (el: Element | null): Box | null => {
      if (el === null) return null
      const r = el.getBoundingClientRect()
      return { x: r.left, y: r.top, w: r.width, h: r.height }
    }
    const line = document.querySelector('[data-testid="merc-bench-line"]')
    const parts: Array<[string, Box | null]> = [
      // Merc's desk: the hero his line is drawn on.
      ['hero', box(line?.parentElement ?? null)],
      ['index', box(document.querySelector('[data-tour="ear.index"]'))],
      ['today', box(document.querySelector('[data-testid="merc-today"]'))],
      ['rooms', box(document.querySelector('[data-testid="ear-rooms-row"]'))],
      ['stations', box(document.querySelector('[data-tour="ear.faculties"]'))],
      ['path', box(document.querySelector('[data-tour="ear.path"]'))],
      ['report', box(document.querySelector('[data-tour="ear.report"]'))],
    ]
    const overlaps: string[] = []
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        const a = parts[i][1]
        const b = parts[j][1]
        if (a === null || b === null) continue
        const x = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
        const y = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
        if (x > 1 && y > 1) overlaps.push(`${parts[i][0]} over ${parts[j][0]}`)
      }
    }
    const rows = (sel: string) => {
      const tops = [...document.querySelectorAll(sel)].map((el) =>
        Math.round(el.getBoundingClientRect().top),
      )
      return { count: tops.length, rows: new Set(tops).size }
    }
    const bench = document.querySelector('[data-testid="merc-bench"]')
    return {
      parts: Object.fromEntries(parts) as Record<string, Box | null>,
      overlaps,
      stations: rows('[data-testid="merc-station"]'),
      rooms: rows('[data-testid="ear-rooms-card"]'),
      /** The tab's width: the window less the scrollbar of the scroller
       *  the tab is in, which a desktop browser draws. */
      width: bench === null ? 0 : bench.getBoundingClientRect().width,
      sideways:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      benchSideways: bench === null ? 0 : bench.scrollWidth - bench.clientWidth,
    }
  })
}

async function openBench(page: Page): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  // Through the tab bar rather than /ear-lab: the built site has a real
  // dist/ear-lab/ directory of room art, and the static server answers that
  // path with its listing instead of the app.
  await page.goto('/')
  await dismissOverlays(page)
  await openNavTab(page, 'tab-ear-lab')
  await expect(page.getByTestId('merc-station').first()).toBeVisible()
  // The rooms row is a lazy island of its own; measure with it in place.
  await expect(page.getByTestId('ear-rooms-card').first()).toBeVisible()
}

test.describe('at a desk', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('lays the bench out for the width, Merc beside the Index @smoke', async ({
    page,
  }) => {
    await openBench(page)
    const bench = await measureBench(page)
    const { hero, index, today, stations, path, report } = bench.parts
    if (!hero || !index || !today || !stations || !path || !report) {
      throw new Error(
        `a part of the bench is missing: ${JSON.stringify(bench.parts)}`,
      )
    }

    // Merc's desk, and beside it the Index over Today.
    expect(index.x, 'the Index is not beside Merc').toBeGreaterThanOrEqual(
      hero.x + hero.w,
    )
    expect(Math.abs(today.x - index.x)).toBeLessThanOrEqual(1)
    expect(today.y).toBeGreaterThan(index.y)
    expect(hero.w, 'Merc is drawn smaller than on a phone').toBeGreaterThan(390)
    // The rest across the width, far wider than a phone's column.
    expect(stations.w, 'the stations are a phone column').toBeGreaterThan(900)
    expect(bench.stations).toEqual({ count: 6, rows: 2 })
    expect(bench.rooms.rows, 'the Ear rooms are not one row').toBe(1)
    // The Ear Path beside the Ear Report.
    expect(report.x).toBeGreaterThanOrEqual(path.x + path.w)
    expect(Math.abs(report.y - path.y)).toBeLessThanOrEqual(1)

    expect(bench.overlaps, 'parts of the bench lie over each other').toEqual([])
    expect(bench.sideways, 'the page scrolls sideways').toBe(0)
    expect(bench.benchSideways, 'the bench scrolls sideways').toBe(0)
  })

  test('lays the Ear Report out for the width, the Index beside what moved', async ({
    page,
  }) => {
    // A season at the bench: two seals, a trace on each threshold drill,
    // and mix-ups on two maps, so every card the report has is drawn.
    await page.addInitScript(() => {
      const day = 86_400_000
      const now = Date.now()
      const reading = (
        drillId: string,
        value: number,
        days: number,
        source: string,
      ) => ({
        drillId,
        value,
        spread: 1,
        tracks: source === 'calibration' ? 3 : 1,
        source,
        at: now - days * day,
      })
      localStorage.setItem(
        'mercurypitch_ear_readings',
        JSON.stringify([
          reading('hairline', 6.1, 3, 'calibration'),
          reading('the-grid', 22, 4, 'practice'),
          reading('hairline', 8.2, 30, 'calibration'),
          reading('the-grid', 30, 32, 'practice'),
        ]),
      )
      localStorage.setItem(
        'mercurypitch_ear_calibrations',
        JSON.stringify([
          { at: now - 3 * day, index: 312, parts: {}, readings: [] },
          { at: now - 30 * day, index: 281, parts: {}, readings: [] },
        ]),
      )
      localStorage.setItem(
        'mercurypitch_ear_confusions',
        JSON.stringify({
          'home|deg-4>deg-3': 4,
          'leap|leap:m3>leap:M3': 2,
        }),
      )
    })
    await openBench(page)
    await page.getByTestId('merc-report').click()
    const screen = page.getByTestId('merc-report-screen')
    await expect(screen.locator('[data-plate="trace-the-grid"]')).toBeVisible()

    const layout = await screen.evaluate((root) => {
      const box = (sel: string) => {
        const el = root.querySelector(sel)
        if (el === null) return null
        const r = el.getBoundingClientRect()
        return { x: r.left, y: r.top, w: r.width, h: r.height }
      }
      const plates = [...root.querySelectorAll('[data-plate]')].map((el) => {
        const r = el.getBoundingClientRect()
        return { x: r.left, y: r.top, w: r.width, h: r.height }
      })
      let overlaps = 0
      for (let i = 0; i < plates.length; i++) {
        for (let j = i + 1; j < plates.length; j++) {
          const a = plates[i]
          const b = plates[j]
          const x = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
          const y = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
          if (x > 1 && y > 1) overlaps++
        }
      }
      return {
        index: box('[data-plate="index"]'),
        hairline: box('[data-plate="trace-hairline"]'),
        grid: box('[data-plate="trace-the-grid"]'),
        home: box('[data-plate="confusion-home"]'),
        leap: box('[data-plate="confusion-leap"]'),
        overlaps,
        sideways:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      }
    })
    const { index, hairline, grid, home, leap } = layout
    if (!index || !hairline || !grid || !home || !leap) {
      throw new Error(
        `a card of the report is missing: ${JSON.stringify(layout)}`,
      )
    }
    // The Index beside what moved, whose traces stand side by side.
    expect(hairline.x).toBeGreaterThanOrEqual(index.x + index.w)
    expect(grid.x).toBeGreaterThanOrEqual(hairline.x + hairline.w)
    expect(Math.abs(grid.y - hairline.y)).toBeLessThanOrEqual(1)
    // The maps two to a row, under both.
    expect(home.y).toBeGreaterThan(index.y + index.h)
    expect(leap.x).toBeGreaterThanOrEqual(home.x + home.w)
    expect(Math.abs(leap.y - home.y)).toBeLessThanOrEqual(1)
    expect(home.w + leap.w, 'the maps are a phone column').toBeGreaterThan(900)

    expect(layout.overlaps, 'cards of the report lie over each other').toBe(0)
    expect(layout.sideways, 'the page scrolls sideways').toBe(0)
  })
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('keeps the bench a column, the Index under Merc', async ({ page }) => {
    await openBench(page)
    const bench = await measureBench(page)
    const { hero, index, today, stations } = bench.parts
    if (!hero || !index || !today || !stations) {
      throw new Error(
        `a part of the bench is missing: ${JSON.stringify(bench.parts)}`,
      )
    }

    // Merc's hero across the screen, the Index and Today under it.
    expect(hero.x).toBe(0)
    expect(hero.w).toBe(bench.width)
    expect(index.y).toBeGreaterThanOrEqual(hero.y + hero.h)
    expect(today.y).toBeGreaterThan(index.y)
    // Two to a row, inside the screen.
    expect(stations.w).toBeLessThanOrEqual(bench.width)
    expect(bench.stations).toEqual({ count: 6, rows: 3 })
    expect(bench.rooms.rows).toBe(2)
    expect(bench.overlaps).toEqual([])
    expect(bench.sideways, 'the page scrolls sideways').toBe(0)
  })
})

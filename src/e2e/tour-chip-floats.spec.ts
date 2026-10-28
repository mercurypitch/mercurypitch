// ============================================================
// The tour offer floats: it moves nothing and covers nothing
// ============================================================
//
// A tab's first-visit tour chip (TourChipHost, TourChip) used to take a row
// at the top of the main column and push the page down. It floats now
// (chip-place.ts). Opened with its offer due, on every tab that offers a
// tour and on Karaoke Night, which shows the same chip, at 390x844,
// 1024x768 and 1440x900:
//
// - Nothing moves. The page's title, its first controls and its canvases
//   stand where they stand once the chip is taken down (Not now), and the
//   page has not scrolled: so the chip took no room while it showed.
// - Nothing is covered. No control, canvas or stage is under the chip's box
//   (every element a hit-test finds there), and no line of visible text
//   touches it, as far as the line shows (a row its box clips is hidden).
// - It is on screen, clear of the foot stack, seen (its offer spent), and
//   named as it always was; it took no focus by itself.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { localKaraokeDemo } from './helpers/karaoke-demo'

test.use({ serviceWorkers: 'block' })

const version = (
  JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'),
  ) as { version: string }
).version

const SIZES = [
  { width: 390, height: 844 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const

const MERC_LINE = 'Merc can show you around, 30 s'

interface Offered {
  /** The tab, or Karaoke Night. */
  name: string
  /** The start button's name, in every form. */
  line: string
  /** The page's column, the scroller whose scroll must not jump. */
  column: string
}

const TAB_LABELS: Record<string, string> = {
  home: 'Home',
  'ear-lab': 'Ear Lab',
  path: 'Path',
  guitar: 'Guitar',
  piano: 'Piano',
  analysis: 'Analysis',
  exercises: 'Exercises',
  jam: 'Jam',
  community: 'Community',
  leaderboard: 'Leaderboard',
  challenges: 'Challenges',
}

const PAGES: Offered[] = [
  { name: 'singing', line: MERC_LINE, column: 'main.main-content' },
  ...Object.entries(TAB_LABELS).map(([name, label]) => ({
    name,
    line: `New to ${label}? Take a quick tour.`,
    column: 'main.main-content',
  })),
  {
    name: 'karaoke-night',
    line: 'Sing the demo with Merc',
    column: '.kn-body',
  },
]

const offerKey = (name: string): string =>
  `pitchperfect_page_tour_offered_${name}`

async function open(page: Page, of: Offered): Promise<void> {
  await page.addInitScript(
    ([v, tab]) => {
      ;(window as Window & { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
      localStorage.setItem('pitchperfect_welcome_version', v)
      localStorage.setItem('pitchperfect_onboarding_done', '1')
      localStorage.setItem('pitchperfect_focus_mode', 'false')
      localStorage.setItem('pitchperfect_survey_seen', '1')
      if (tab !== 'karaoke-night') {
        localStorage.setItem('pitchperfect_active_tab', tab)
      }
    },
    [version, of.name],
  )
  if (of.name === 'karaoke-night') {
    await localKaraokeDemo(page)
    await page.goto('/karaoke-night')
  } else {
    await page.goto(`/#/${of.name}`)
  }
}

interface Landmarks {
  scroll: number
  boxes: string[]
}

/**
 * Where the page's title, its first controls and its canvases stand, and
 * how far it has scrolled, leaving the chip out.
 */
async function landmarks(page: Page, column: string): Promise<Landmarks> {
  return page.evaluate((sel) => {
    const col = document.querySelector(sel)
    const chip = document.querySelector('[data-testid="tour-chip"]')
    if (col === null) return { scroll: -1, boxes: ['no column'] }
    const shown = (el: Element): boolean => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }
    const outside = (el: Element): boolean =>
      chip === null || !chip.contains(el)
    const title = [...col.querySelectorAll('h1, h2')].filter(shown)[0]
    const controls = [
      ...col.querySelectorAll(
        'button, a[href], input, select, [role="tab"], [role="slider"]',
      ),
    ]
      .filter(outside)
      .filter(shown)
      .slice(0, 6)
    const canvases = [...col.querySelectorAll('canvas')].filter(shown)
    const boxes = [title, ...controls, ...canvases]
      .filter((el): el is Element => el !== undefined)
      .map((el) => {
        const r = el.getBoundingClientRect()
        const name = el.getAttribute('aria-label') ?? el.textContent ?? ''
        return `${el.tagName} ${name.trim().slice(0, 24)} @ ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`
      })
    const scroller =
      col.scrollHeight > col.clientHeight ? col : document.scrollingElement
    return { scroll: Math.round(scroller?.scrollTop ?? 0), boxes }
  }, column)
}

/** Everything under the chip it must not cover: controls, stages, words. */
async function underChip(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const chip = document.querySelector('[data-testid="tour-chip"]')
    if (chip === null) return ['no chip']
    const r = chip.getBoundingClientRect()
    const hits = new Set<string>()
    const control =
      'button, a[href], input, select, textarea, canvas, video, [role="button"], [role="link"], [role="tab"], [role="slider"], [role="switch"], [data-stage-canvas], #canvas-container'
    for (let x = r.left + 1; x < r.right; x += 6) {
      for (let y = r.top + 1; y < r.bottom; y += 6) {
        for (const el of document.elementsFromPoint(x, y)) {
          if (chip.contains(el)) continue
          const hit = el.closest(control)
          if (hit !== null && !hit.contains(chip)) {
            hits.add(
              `${hit.tagName} ${hit.getAttribute('aria-label') ?? (hit.textContent ?? '').trim().slice(0, 24)}`,
            )
          }
        }
      }
    }
    // A line of text as far as it shows: cut by every box that clips it.
    const shownPart = (line: DOMRect, from: Element) => {
      let box = {
        left: line.left,
        top: line.top,
        right: line.right,
        bottom: line.bottom,
      }
      for (let el: Element | null = from; el !== null; el = el.parentElement) {
        const style = getComputedStyle(el)
        if (style.overflowX === 'visible' && style.overflowY === 'visible')
          continue
        const c = el.getBoundingClientRect()
        box = {
          left: Math.max(box.left, c.left),
          top: Math.max(box.top, c.top),
          right: Math.min(box.right, c.right),
          bottom: Math.min(box.bottom, c.bottom),
        }
      }
      return box
    }
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    )
    for (
      let node = walker.nextNode();
      node !== null;
      node = walker.nextNode()
    ) {
      const words = (node.textContent ?? '').trim()
      const parent = node.parentElement
      if (words === '' || parent === null || chip.contains(parent)) continue
      if (
        !parent.checkVisibility({
          opacityProperty: true,
          visibilityProperty: true,
        })
      ) {
        continue
      }
      const range = document.createRange()
      range.selectNodeContents(node)
      for (const each of range.getClientRects()) {
        const line = shownPart(each, parent)
        if (line.right - line.left < 2 || line.bottom - line.top < 2) continue
        const meets =
          line.left < r.right &&
          r.left < line.right &&
          line.top < r.bottom &&
          r.top < line.bottom
        if (meets) hits.add(`text "${words.slice(0, 30)}"`)
      }
    }
    return [...hits]
  })
}

/** The chip's box, what it covers and its form, once it has been placed. */
async function placedChip(page: Page) {
  const chip = page.getByTestId('tour-chip')
  await expect(chip).toBeVisible({ timeout: 20_000 })
  await expect(chip).toHaveAttribute('data-place', /^(column|bar)$/)
  // Placed again as the page settles (chip-float.ts, its first second): the
  // same box twice in a row, a beat apart.
  let previous = ''
  await expect
    .poll(
      async () => {
        const now = JSON.stringify(await chip.boundingBox())
        const same = now === previous
        previous = now
        return same
      },
      { intervals: [400] },
    )
    .toBe(true)
  return chip
}

for (const of of PAGES) {
  for (const size of SIZES) {
    test(`${of.name}: the tour offer moves nothing and covers nothing, at ${size.width}x${size.height}`, async ({
      page,
    }) => {
      test.setTimeout(60_000)
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.setViewportSize(size)
      await open(page, of)

      const chip = await placedChip(page)
      const shown = await landmarks(page, of.column)
      expect(
        shown.boxes.length,
        'the page has a title or controls',
      ).toBeGreaterThan(0)

      // Nothing under it.
      expect(await underChip(page)).toEqual([])
      // On screen, above the foot stack, and seen: its offer is spent.
      const box = await chip.boundingBox()
      expect(box).not.toBeNull()
      if (box !== null) {
        const foot = await page.evaluate(() => {
          const s = getComputedStyle(document.documentElement)
          const px = (k: string) =>
            Number.parseFloat(s.getPropertyValue(k)) || 0
          return Math.max(
            px('--tabbar-space'),
            px('--consent-banner-space'),
            px('--verify-banner-space'),
          )
        })
        expect(box.y).toBeGreaterThanOrEqual(0)
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(size.width)
        expect(box.y + box.height).toBeLessThanOrEqual(size.height - foot)
      }
      await expect
        .poll(() =>
          page.evaluate((k) => localStorage.getItem(k), offerKey(of.name)),
        )
        .toBe('true')
      // Named as it always was, whatever form it took; and it took no focus.
      const start = chip.getByRole('button', { name: of.line, exact: true })
      await expect(start).toBeVisible()
      await expect(chip.getByRole('button', { name: 'Not now' })).toBeVisible()
      expect(
        await chip.evaluate((el) => el.contains(document.activeElement)),
      ).toBe(false)

      // Taken down, the page stands where it stood: the chip took no room.
      await chip.getByRole('button', { name: 'Not now' }).click()
      await expect(chip).toHaveCount(0)
      expect(await landmarks(page, of.column)).toEqual(shown)
      expect(errors).toEqual([])
    })
  }
}

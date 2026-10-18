// ============================================================
// Drum take card — the Take ready card covers nothing it sits over
// ============================================================
//
// After a take, Drum Night pins a "Take ready" card to the bottom of the
// phrase-coach column (the take cue dock where that column is hidden). This
// spec reaches that state with a real pointer and measures, at six room sizes
// and at every scroll position of the column, that no text or control shows
// partly covered by the card or as a sliver beneath it.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

test.use({ launchOptions: { args: ['--mute-audio'] } })

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
] as const

async function clickWithRealMouse(page: Page, target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded()
  const bounds = await target.boundingBox()
  if (bounds === null) throw new Error('Pointer target has no visible bounds')
  await page.mouse.click(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  )
}

/** Save First Pocket as a project, play it, strike the snare, then pause. */
async function reachTakeReady(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })
  await clickWithRealMouse(
    page,
    page
      .getByRole('button', { name: 'Groove', exact: true })
      .filter({ visible: true })
      .first(),
  )
  const editor = page.getByTestId('drum-groove-editor')
  await expect(editor).toBeVisible()
  await clickWithRealMouse(
    page,
    editor.getByRole('button', { name: 'Save project', exact: true }),
  )
  const library = page.getByTestId('drum-project-library')
  const nameInput = library.getByRole('textbox', { name: 'Project name' })
  await expect(nameInput).toBeFocused()
  await nameInput.fill('Card Clearance Pocket')
  await clickWithRealMouse(
    page,
    library.getByRole('button', { name: 'Save on this device' }),
  )
  await expect(
    library.getByText('Saved on this device', { exact: true }),
  ).toBeVisible()
  await clickWithRealMouse(
    page,
    page.getByRole('button', { name: 'Rack controls' }),
  )
  await clickWithRealMouse(
    page,
    page.getByRole('button', { name: 'Close rack drawer' }),
  )
  await expect(page.locator('#drum-workbench')).toHaveAttribute(
    'aria-hidden',
    'true',
  )
  await clickWithRealMouse(
    page,
    page.getByRole('button', { name: 'Count-in: 4 audible beats' }),
  )

  const shell = page.getByTestId('drum-night-shell')
  const snare = page
    .locator('[aria-label="Pocket Console drum kit"]')
    .getByRole('button', { name: /^Acoustic snare, key/i })
  await clickWithRealMouse(
    page,
    page
      .getByRole('button', { name: /^Play First Pocket$/ })
      .filter({ visible: true }),
  )
  await expect(shell).toHaveAttribute('data-playing', 'true')
  // Enough strikes for the coach to fill in every row it has, which is what
  // makes the column taller than the room and puts rows under the card.
  for (let strike = 0; strike < 12; strike += 1) {
    await clickWithRealMouse(page, snare)
    await expect(shell).toHaveAttribute('data-playing', 'true')
  }
  await clickWithRealMouse(
    page,
    page
      .getByRole('button', { name: /^Pause First Pocket$/ })
      .filter({ visible: true }),
  )
  await expect(
    page
      .getByTestId('drum-take-history')
      .filter({ visible: true })
      .getByRole('button', { name: 'Finish take' }),
  ).toBeVisible()
  // The pause toast is a transient overlay of its own; measure the room it
  // leaves behind.
  const toast = page.locator('main > [role="status"][data-visible]')
  await expect(toast).toHaveAttribute('data-visible', 'false')
  await expect
    .poll(() => toast.evaluate((element) => getComputedStyle(element).opacity))
    .toBe('0')
}

interface CardClearance {
  readonly layout: 'column' | 'dock' | 'none'
  /** Card surfaces, as [left, top, right, bottom] in viewport px. */
  readonly card: readonly (readonly [number, number, number, number])[]
  /** The phrase-coach column, as [top, bottom], when it is on screen. */
  readonly column: readonly [number, number] | null
  /** The column's scroll range, in px. */
  readonly scrollRange: number
  /** Scroll positions measured. */
  readonly scrollPositions: readonly number[]
  /** Text or controls that show partly covered by a card surface. */
  readonly partlyCovered: readonly string[]
  /** Anything that paints in the strip between the card and the column bottom. */
  readonly sliver: readonly string[]
  /** Height of that strip, in px. */
  readonly stripHeight: number
  /** Column rows that never fit wholly above the card at the scroll end. */
  readonly neverClear: readonly string[]
  /** The coach region's edge fade at rest and at the scroll end. */
  readonly fade: { readonly rest: string; readonly end: string } | null
}

/**
 * Measures the visible card against everything beside, beneath and below it.
 * Runs in the page so the element walk and the hit tests share one layout.
 */
async function measureCardClearance(page: Page): Promise<CardClearance> {
  return page.evaluate(async () => {
    const settle = (): Promise<void> =>
      new Promise((resolve) => {
        // A frame where the page paints, a timeout where it does not.
        let done = false
        const finish = (): void => {
          if (done) return
          done = true
          resolve()
        }
        requestAnimationFrame(() => requestAnimationFrame(finish))
        setTimeout(finish, 120)
      })
    const shown = (element: Element): boolean => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity) > 0
      )
    }
    const describe = (element: Element): string => {
      const label =
        element.getAttribute('aria-label') ??
        (element.textContent ?? '').replace(/\s+/g, ' ').trim()
      return `${element.tagName.toLowerCase()} "${label.slice(0, 60)}"`
    }
    const round = (value: number): number => Math.round(value * 100) / 100

    // The area of an element the user can actually see: its box cut by every
    // clipping ancestor and the viewport.
    const visibleBox = (
      element: Element,
    ): { top: number; bottom: number; left: number; right: number } | null => {
      const rect = element.getBoundingClientRect()
      let top = Math.max(rect.top, 0)
      let bottom = Math.min(rect.bottom, innerHeight)
      let left = Math.max(rect.left, 0)
      let right = Math.min(rect.right, innerWidth)
      for (
        let ancestor = element.parentElement;
        ancestor !== null;
        ancestor = ancestor.parentElement
      ) {
        const style = getComputedStyle(ancestor)
        if (style.overflowX === 'visible' && style.overflowY === 'visible') {
          continue
        }
        const clip = ancestor.getBoundingClientRect()
        top = Math.max(top, clip.top)
        bottom = Math.min(bottom, clip.bottom)
        left = Math.max(left, clip.left)
        right = Math.min(right, clip.right)
      }
      return bottom - top > 0.5 && right - left > 0.5
        ? { top, bottom, left, right }
        : null
    }

    const history = [
      ...document.querySelectorAll(
        '[data-testid="drum-take-history"][data-mode="compact"]',
      ),
    ].filter(shown)
    const dock = [
      ...document.querySelectorAll('[data-testid="drum-take-cue"]'),
    ].filter(shown)
    // The dock never takes a pointer of its own; what covers is its children.
    const surfaces: Element[] =
      history.length > 0
        ? history
        : dock.flatMap((element) => [...element.children].filter(shown))
    const layout: CardClearance['layout'] =
      history.length > 0 ? 'column' : dock.length > 0 ? 'dock' : 'none'
    const column = document.querySelector(
      'aside[aria-label="Session phrase coach"]',
    )
    const columnShown = column !== null && shown(column)
    const scrollers = columnShown
      ? [column, ...column.querySelectorAll('*')].filter((element) => {
          const style = getComputedStyle(element)
          return (
            /auto|scroll/.test(style.overflowY) &&
            element.scrollHeight > element.clientHeight + 1
          )
        })
      : []
    const scroller = scrollers[0] ?? null
    const scrollRange =
      scroller === null ? 0 : scroller.scrollHeight - scroller.clientHeight

    const candidates = [
      ...document.querySelectorAll<HTMLElement>('body *'),
    ].filter((element) => {
      if (!shown(element)) return false
      if (surfaces.some((surface) => surface.contains(element))) return false
      if (element.contains(surfaces[0] ?? null)) return false
      const control = element.matches(
        'button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])',
      )
      const ownText = [...element.childNodes].some(
        (node) =>
          node.nodeType === Node.TEXT_NODE &&
          (node.textContent ?? '').trim() !== '',
      )
      return control || ownText
    })

    const covering = (x: number, y: number): boolean => {
      const hit = document.elementFromPoint(x, y)
      return hit !== null && surfaces.some((surface) => surface.contains(hit))
    }

    const partlyCovered = new Set<string>()
    const sliver = new Set<string>()
    const positions: number[] = []
    let stripHeight = 0
    const steps =
      scroller === null ? [0] : [...Array(13).keys()].map((i) => i / 12)
    for (const step of steps) {
      if (scroller !== null) {
        scroller.scrollTop = Math.round(scrollRange * step)
        positions.push(scroller.scrollTop)
      }
      await settle()
      for (const surface of surfaces) {
        const card = surface.getBoundingClientRect()
        for (const element of candidates) {
          const box = visibleBox(element)
          if (box === null) continue
          const overlapTop = Math.max(box.top, card.top)
          const overlapBottom = Math.min(box.bottom, card.bottom)
          const overlapLeft = Math.max(box.left, card.left)
          const overlapRight = Math.min(box.right, card.right)
          if (overlapBottom - overlapTop <= 0.5) continue
          if (overlapRight - overlapLeft <= 0.5) continue
          const inside =
            box.top >= card.top - 0.5 &&
            box.bottom <= card.bottom + 0.5 &&
            box.left >= card.left - 0.5 &&
            box.right <= card.right + 0.5
          if (inside) continue
          if (
            covering(
              (overlapLeft + overlapRight) / 2,
              (overlapTop + overlapBottom) / 2,
            )
          ) {
            partlyCovered.add(describe(element))
          }
        }
      }
      if (layout === 'column' && columnShown) {
        const card = surfaces[0].getBoundingClientRect()
        const edge = column.getBoundingClientRect()
        const bottomBorder = Number.parseFloat(
          getComputedStyle(column).borderBottomWidth,
        )
        const stripBottom = edge.bottom - bottomBorder
        stripHeight = Math.max(stripHeight, round(stripBottom - card.bottom))
        for (const element of candidates) {
          if (!column.contains(element)) continue
          const box = visibleBox(element)
          if (box === null) continue
          if (box.bottom > card.bottom + 0.5 && box.top < stripBottom - 0.5) {
            sliver.add(describe(element))
          }
        }
      }
    }

    const neverClear: string[] = []
    let fade: CardClearance['fade'] = null
    const fadeOf = (element: Element): string =>
      getComputedStyle(element).getPropertyValue('--coach-fade').trim()
    if (layout === 'column' && columnShown) {
      if (scroller !== null) scroller.scrollTop = 0
      await settle()
      const rest = scroller === null ? '' : fadeOf(scroller)
      if (scroller !== null) scroller.scrollTop = scrollRange
      await settle()
      fade = { rest, end: scroller === null ? '' : fadeOf(scroller) }
      const cardTop = surfaces[0].getBoundingClientRect().top
      for (const element of candidates) {
        if (!column.contains(element)) continue
        if (element.getBoundingClientRect().bottom > cardTop + 0.5) {
          neverClear.push(describe(element))
        }
      }
      if (scroller !== null) scroller.scrollTop = 0
      await settle()
    }

    return {
      layout,
      card: surfaces.map((surface) => {
        const rect = surface.getBoundingClientRect()
        return [
          round(rect.left),
          round(rect.top),
          round(rect.right),
          round(rect.bottom),
        ] as const
      }),
      column: columnShown
        ? ([
            round(column.getBoundingClientRect().top),
            round(column.getBoundingClientRect().bottom),
          ] as const)
        : null,
      scrollRange,
      scrollPositions: positions,
      partlyCovered: [...partlyCovered],
      sliver: [...sliver],
      stripHeight,
      neverClear,
      fade,
    }
  })
}

test('keeps the Take ready card clear of half-covered rows and slivers at six room sizes @smoke', async ({
  page,
}, testInfo) => {
  await reachTakeReady(page)

  const results: Record<string, CardClearance> = {}
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport)
    const key = `${viewport.width}x${viewport.height}`
    // Above 1040px the card is the column's footer; below it the column is
    // hidden and the take cue dock carries Finish take instead.
    const finish = (
      viewport.width > 1040
        ? page.getByTestId('drum-take-history').filter({ visible: true })
        : page.getByTestId('drum-take-cue')
    ).getByRole('button', { name: 'Finish take' })
    await expect(finish).toBeVisible()
    const clearance = await measureCardClearance(page)
    results[key] = clearance
    await page.screenshot({
      path: testInfo.outputPath(`drum-take-card-${key}.png`),
    })

    // Soft, so one run reports every room size instead of the first miss.
    expect
      .soft(clearance.layout, key)
      .toBe(viewport.width > 1040 ? 'column' : 'dock')
    expect.soft(clearance.partlyCovered, key).toEqual([])
    expect.soft(clearance.sliver, key).toEqual([])
    expect.soft(clearance.neverClear, key).toEqual([])
    if (clearance.layout === 'column') {
      // The coach must be taller than the room for the scroll walk to mean
      // anything, and the card must sit on the column's bottom edge.
      expect.soft(clearance.scrollRange, key).toBeGreaterThan(0)
      expect.soft(clearance.stripHeight, key).toBeLessThanOrEqual(0.5)
      // A row cut by the region's edge fades into the card's rule while
      // there is more to scroll, and the last row ends crisp.
      expect.soft(clearance.fade, key).toEqual({ rest: '32px', end: '0px' })
    }
  }
  await writeFile(
    testInfo.outputPath('drum-take-card-clearance.json'),
    JSON.stringify(results, null, 2),
  )
})

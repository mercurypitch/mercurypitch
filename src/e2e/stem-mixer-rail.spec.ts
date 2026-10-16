// ============================================================
// Stem mixer rail: one glass bar that keeps its timeline
// ============================================================
//
// The rail is one bar: the controls on its left, the timeline in the
// middle, Key and More on its right. Beside the controls the timeline keeps
// 380 px, or 240 px once Speed has folded into More, and short of that it
// takes a line of its own. These are the claims only a browser can check,
// at three window sizes: the timeline stays usable, nothing runs past the
// window, the key panel and the speed list close on a press outside and on
// Escape, a short loop's close-up opens clear of the controls in type of
// 12 px or more, without shortening the track, and a toast keeps off focus
// mode's pill docked at the top. At 1440 px, an A-B loop also plays round
// without freezing, the close-up stays on screen with the pill docked at
// the top, and the focus pill docks to every edge from the More menu.
// stem-mixer-rows.spec.ts holds both rows' sizes, folds and stillness.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { SPEED_FOLD_PX, TIMELINE_OWN_LINE_PX, } from '../components/stem-mixer/rail/rail-fold'
import { openSeededSong, playhead, setLoop, songPosition, } from './helpers/mixer-song'

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 844, height: 390 },
] as const

test.use({ permissions: ['microphone'] })

interface Box {
  x: number
  y: number
  w: number
  h: number
  right: number
  bottom: number
}

interface RailLayout {
  rail: Box
  /** The glass bar itself, whose width the folds read. */
  bar: Box
  capsule: Box
  /** The song-position slider. */
  timeline: Box
  /** The timeline around it: elapsed, the slider and the length. */
  timelineBox: Box
  speedFolded: boolean
  scrollWidth: number
  innerWidth: number
  /** Painted things in the rail that start or end outside the window. */
  outside: string[]
}

function railLayout(page: Page): Promise<RailLayout> {
  return page.evaluate(() => {
    const box = (element: Element | null): Box => {
      if (element === null) throw new Error('rail part missing')
      const r = element.getBoundingClientRect()
      return {
        x: r.left,
        y: r.top,
        w: r.width,
        h: r.height,
        right: r.right,
        bottom: r.bottom,
      }
    }
    const rail = document.querySelector('.sm-transport')
    const outside = Array.from(rail?.querySelectorAll('*') ?? [])
      .filter((element) => {
        const r = element.getBoundingClientRect()
        return (
          r.width > 0 &&
          r.height > 0 &&
          (r.left < -0.5 || r.right > window.innerWidth + 0.5)
        )
      })
      .map(
        (element) =>
          `${element.tagName.toLowerCase()}[${
            element.getAttribute('aria-label') ?? element.className
          }]`,
      )
    const bar = document.querySelector('[data-testid="mixer-rail"]')
    return {
      rail: box(rail),
      bar: box(bar),
      capsule: box(document.querySelector('[data-testid="mixer-capsule"]')),
      timeline: box(
        document.querySelector(
          '[data-testid="mixer-timeline"] input[type="range"]',
        ),
      ),
      timelineBox: box(
        document.querySelector('[data-testid="mixer-timeline"]'),
      ),
      speedFolded: bar?.getAttribute('data-speed-folded') === 'true',
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      outside,
    }
  })
}

interface PillLayout {
  /** Controls cut off by the pill's edge or the window's. */
  cutOff: string[]
  /** The smallest control's shorter side, as drawn. */
  smallestTarget: number
  /** The smallest text, as drawn: its font size times any zoom above it. */
  smallestText: number
  /**
   * The song-position slider's width, the width of the timeline around it
   * (times included), and whether it has a line of its own.
   */
  timeline: { w: number; box: number; ownLine: boolean } | null
  /** The bar's own width, and whether Speed has folded into More. */
  barWidth: number
  speedFolded: boolean
}

/** The focus pill as a singer meets it. */
function pillLayout(page: Page): Promise<PillLayout> {
  return page.evaluate(() => {
    const pill = document.querySelector('.sm-transport')
    if (pill === null) throw new Error('no focus pill')
    const box = pill.getBoundingClientRect()
    const zoomOf = (element: Element): number => {
      let zoom = 1
      for (let at: Element | null = element; at; at = at.parentElement) {
        const own = parseFloat(getComputedStyle(at).zoom)
        if (own > 0) zoom *= own
      }
      return zoom
    }
    const controls = Array.from(
      pill.querySelectorAll('button, input, [data-testid="dock-handle"]'),
    ).filter((element) => {
      const r = element.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    })
    const cutOff = controls
      .filter((element) => {
        const r = element.getBoundingClientRect()
        return (
          r.left < Math.max(0, box.left) - 0.5 ||
          r.top < Math.max(0, box.top) - 0.5 ||
          r.right > Math.min(window.innerWidth, box.right) + 0.5 ||
          r.bottom > Math.min(window.innerHeight, box.bottom) + 0.5
        )
      })
      .map(
        (element) =>
          element.getAttribute('aria-label') ??
          element.getAttribute('data-testid') ??
          element.tagName,
      )
    const sizes = controls.map((element) => {
      const r = element.getBoundingClientRect()
      return Math.min(r.width, r.height)
    })
    const texts = Array.from(pill.querySelectorAll('*'))
      .filter(
        (element) =>
          element.getBoundingClientRect().width > 0 &&
          Array.from(element.childNodes).some(
            (node) =>
              node.nodeType === Node.TEXT_NODE &&
              (node.textContent ?? '').trim() !== '',
          ),
      )
      .map(
        (element) =>
          parseFloat(getComputedStyle(element).fontSize) * zoomOf(element),
      )
    const around = pill.querySelector('[data-testid="mixer-timeline"]')
    const slider = around?.querySelector('input[type="range"]') ?? null
    const capsule = pill.querySelector('[data-testid="mixer-capsule"]')
    const timeline =
      around === null || slider === null || capsule === null
        ? null
        : {
            w: slider.getBoundingClientRect().width,
            box: around.getBoundingClientRect().width,
            ownLine:
              slider.getBoundingClientRect().top >=
              capsule.getBoundingClientRect().bottom - 1,
          }
    const bar = pill.querySelector('[data-testid="mixer-rail"]')
    return {
      cutOff,
      smallestTarget: Math.min(...sizes),
      smallestText: Math.min(...texts),
      timeline,
      barWidth: bar?.getBoundingClientRect().width ?? 0,
      speedFolded: bar?.getAttribute('data-speed-folded') === 'true',
    }
  })
}

/** A press on the rail's own padding: outside every control and panel. */
async function pressOutside(page: Page): Promise<void> {
  const rail = await page.locator('.sm-transport').boundingBox()
  if (rail === null) throw new Error('the rail has no box')
  await page.mouse.click(rail.x + 4, rail.y + 4)
}

const DOCKS = {
  top: 'Controls at the top',
  bottom: 'Controls at the bottom',
  left: 'Controls on the left',
  right: 'Controls on the right',
} as const

/** Docks the focus pill from More, the way a singer picks an edge. */
async function dockTo(page: Page, side: keyof typeof DOCKS): Promise<void> {
  await page.getByRole('button', { name: 'More playback options' }).click()
  await page.getByRole('menuitemradio', { name: DOCKS[side] }).click()
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(page.locator('.stem-mixer')).toHaveClass(
    new RegExp(`stem-mixer--focus-docked-${side}`),
  )
}

for (const viewport of VIEWPORTS) {
  test.describe(`the rail at ${viewport.width}x${viewport.height}`, () => {
    test.beforeEach(({ page }) => openSeededSong(page, viewport))

    test('keeps the timeline usable and every control inside the window', async ({
      page,
    }) => {
      const layout = await railLayout(page)
      const ownLine = layout.timeline.y >= layout.capsule.bottom - 1

      // Speed folds into More below 860 px of bar, and the timeline takes
      // its own line below 650 (rail-fold.ts, read by the CSS's twin).
      expect(layout.speedFolded).toBe(layout.bar.w < SPEED_FOLD_PX)
      if (layout.bar.w < TIMELINE_OWN_LINE_PX) {
        expect(ownLine, 'the timeline beside the controls').toBe(true)
        // Its line is the bar's, less the bar's own padding.
        expect(layout.timelineBox.w).toBeGreaterThanOrEqual(layout.bar.w - 20)
      } else {
        expect(ownLine, 'the timeline on a line of its own').toBe(false)
        const floor = layout.speedFolded ? 240 : 380
        expect(
          layout.timelineBox.w,
          `a ${layout.timelineBox.w} px timeline squeezed in beside the controls`,
        ).toBeGreaterThanOrEqual(floor)
      }
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.innerWidth)
      expect(layout.outside).toEqual([])
    })

    test('closes the key panel and the speed list on a press outside and on Escape', async ({
      page,
    }) => {
      const keyChip = page.getByTestId('key-chip')
      const keyPanel = page.getByTestId('key-chip-popover')

      await keyChip.click()
      await expect(keyPanel).toBeVisible()
      const panel = await keyPanel.boundingBox()
      expect(panel).not.toBeNull()
      expect(panel!.x).toBeGreaterThanOrEqual(0)
      expect(panel!.y).toBeGreaterThanOrEqual(0)
      expect(panel!.x + panel!.width).toBeLessThanOrEqual(viewport.width)
      expect(panel!.y + panel!.height).toBeLessThanOrEqual(viewport.height)
      // A press inside the portalled panel is not a press outside it.
      await keyPanel.getByText('Key', { exact: true }).click()
      await expect(keyPanel).toBeVisible()

      await pressOutside(page)
      await expect(keyPanel).toBeHidden()

      await keyChip.click()
      await expect(keyPanel).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(keyPanel).toBeHidden()
      await expect(keyChip).toBeFocused()

      // Short of width, the speeds are rows in More (stem-mixer-rows.spec.ts
      // checks those rows); More closes by the same rule.
      const folded = (await railLayout(page)).speedFolded
      const speedChip = folded
        ? page.getByRole('button', { name: /^More playback options/ })
        : page.getByTestId('speed-chip')
      const speedList = folded
        ? page.getByRole('menu', { name: /^More playback options/ })
        : page.getByRole('menu', { name: /^Playback speed/ })
      await speedChip.click()
      await expect(speedList).toBeVisible()
      await pressOutside(page)
      await expect(speedList).toBeHidden()

      await speedChip.click()
      await expect(speedList).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(speedList).toBeHidden()
      await expect(speedChip).toBeFocused()
    })

    test('opens the close-up of a short loop clear of the controls, in text a person can read', async ({
      page,
    }) => {
      const before = await railLayout(page)
      // Four seconds of a thirty-second song is under 88 px of track, so the
      // rail offers the A-B close-up, as it does on Guitar Night.
      await setLoop(page, 10, 14)
      const zoomIn = page.getByRole('button', { name: 'Zoom to the loop' })
      await expect(zoomIn).toBeVisible()
      // Offering it moves nothing: the track keeps its length, so no point
      // on it shifts under the pointer the moment B makes a short loop.
      expect((await railLayout(page)).timeline.w).toBeCloseTo(
        before.timeline.w,
        1,
      )
      await zoomIn.click()
      const lens = page.getByTestId('mixer-timeline-loop-precision-lens')
      await expect(lens).toBeInViewport({ ratio: 1 })

      const lensBox = await lens.boundingBox()
      const capsuleBox = await page.getByTestId('mixer-capsule').boundingBox()
      expect(lensBox).not.toBeNull()
      expect(capsuleBox).not.toBeNull()
      const overlaps =
        lensBox!.x < capsuleBox!.x + capsuleBox!.width &&
        capsuleBox!.x < lensBox!.x + lensBox!.width &&
        lensBox!.y < capsuleBox!.y + capsuleBox!.height &&
        capsuleBox!.y < lensBox!.y + lensBox!.height
      expect(overlaps, 'the close-up covers the controls').toBe(false)

      const sizes = await lens.evaluate((element) =>
        Array.from(element.querySelectorAll('*'))
          .filter(
            (node) =>
              node.children.length === 0 &&
              (node.textContent ?? '').trim() !== '',
          )
          .map((node) => ({
            text: (node.textContent ?? '').trim(),
            px: parseFloat(getComputedStyle(node).fontSize),
          })),
      )
      expect(sizes.map((size) => size.text)).toContain('A–B detail')
      for (const size of sizes) {
        expect(size.px, size.text).toBeGreaterThanOrEqual(12)
      }

      await page.keyboard.press('Escape')
      await expect(lens).toHaveCount(0)

      // It floats over the rail, so a press anywhere else closes it too.
      await zoomIn.click()
      await expect(lens).toBeVisible()
      await pressOutside(page)
      await expect(lens).toHaveCount(0)
    })

    test('docks the focus pill to every edge with every control in reach, none under 24 px or its text under 12 px', async ({
      page,
    }) => {
      await page.locator('[data-tour="mixer.focus"]').click()
      await expect(page.locator('.stem-mixer--focus')).toBeVisible()

      for (const side of ['bottom', 'top', 'left', 'right'] as const) {
        await dockTo(page, side)
        const pill = await pillLayout(page)

        expect.soft(pill.cutOff, `${side}: controls cut off`).toEqual([])
        expect.soft(pill.smallestTarget, side).toBeGreaterThanOrEqual(24)
        expect.soft(pill.smallestText, side).toBeGreaterThanOrEqual(12)
        if (side === 'left' || side === 'right') {
          // The side docks stack the controls and leave the timeline out.
          expect.soft(pill.timeline, side).toBeNull()
        } else {
          // The rail's rule: beside the controls the timeline keeps 380 px,
          // or 240 once Speed is in More, or it takes a line of its own.
          const floor = pill.speedFolded ? 240 : 380
          expect
            .soft(
              pill.timeline?.ownLine === true ||
                (pill.timeline?.box ?? 0) >= floor,
              `${side}: a ${pill.timeline?.box} px timeline beside the controls`,
            )
            .toBe(true)
        }
      }
    })

    test("keeps focus mode's More inside the window, its last row in reach", async ({
      page,
    }) => {
      await page.locator('[data-tour="mixer.focus"]').click()
      await expect(page.locator('.stem-mixer--focus')).toBeVisible()
      await page.getByRole('button', { name: 'More playback options' }).click()
      const menu = page.getByRole('menu')
      await expect(menu).toBeVisible()

      const box = await menu.boundingBox()
      const size = page.viewportSize()
      if (box === null || size === null) throw new Error('no menu box')
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.y + box.height).toBeLessThanOrEqual(size.height)
      const last = menu.locator('[role^="menuitem"]').last()
      await last.scrollIntoViewIfNeeded()
      await expect(last).toBeInViewport()
    })

    test('keeps a toast off the pill docked at the top', async ({ page }) => {
      // Docked at the top, the pill is the window's top edge, the corner
      // toasts used: at 844x390 one hid More and Exit while it showed.
      await page.locator('[data-tour="mixer.focus"]').click()
      await expect(page.locator('.stem-mixer--focus')).toBeVisible()
      await dockTo(page, 'top')

      // B at 0:00 with no A is refused, and the refusal is a toast.
      await page.getByRole('button', { name: 'Set loop end (B)' }).click()
      const toast = page
        .getByRole('region', { name: 'Notifications' })
        .getByText('The loop end (B) has to be at least 0.1 s after')
      await expect(toast).toBeVisible()

      const under = await page.evaluate(() => {
        const region = document.querySelector(
          '[role="region"][aria-label="Notifications"]',
        )
        const toasts = [...(region?.children ?? [])].map((t) =>
          t.getBoundingClientRect(),
        )
        const controls = [
          ...document.querySelectorAll(
            '.sm-transport :is(button, [role="slider"], input)',
          ),
        ]
        return controls
          .filter((control) => {
            const c = control.getBoundingClientRect()
            return toasts.some(
              (t) =>
                Math.min(t.right, c.right) - Math.max(t.left, c.left) > 0.5 &&
                Math.min(t.bottom, c.bottom) - Math.max(t.top, c.top) > 0.5,
            )
          })
          .map(
            (control) =>
              control.getAttribute('aria-label') ??
              control.textContent?.trim() ??
              '',
          )
      })
      expect(under).toEqual([])
    })
  })
}

test.describe('the rail at 1440x900, playing', () => {
  test.beforeEach(({ page }) => openSeededSong(page, VIEWPORTS[0]))

  test('plays an A-B loop round without freezing', async ({ page }) => {
    await setLoop(page, 2, 4)
    await expect(
      page.getByRole('button', { name: 'Loop', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await songPosition(page).fill('3')

    await page.getByRole('button', { name: 'Play', exact: true }).click()

    const often = { intervals: [100], timeout: 10_000 }
    // Up to B, round to A, and on again.
    await expect.poll(() => playhead(page), often).toBeGreaterThan(3.6)
    await expect.poll(() => playhead(page), often).toBeLessThan(3.2)
    const roundAgain = await playhead(page)
    await expect
      .poll(() => playhead(page), often)
      .toBeGreaterThan(roundAgain + 0.3)
    await page.getByRole('button', { name: 'Pause', exact: true }).click()
  })

  test('keeps the close-up on screen with the pill docked at the top', async ({
    page,
  }) => {
    await setLoop(page, 10, 12)
    await page.locator('[data-tour="mixer.focus"]').click()
    const focus = page.locator('.stem-mixer--focus')
    await expect(focus).toBeVisible()
    await dockTo(page, 'top')

    await page.getByRole('button', { name: 'Zoom to the loop' }).click()
    const lens = page.getByTestId('mixer-timeline-loop-precision-lens')
    await expect(lens).toBeInViewport({ ratio: 1 })

    // Escape shuts the close-up and leaves karaoke mode alone.
    await page.keyboard.press('Escape')
    await expect(lens).toHaveCount(0)
    await expect(focus).toBeVisible()
  })

  test("keeps the chips and More on the pill's glass under the pointer and while open", async ({
    page,
  }) => {
    await page.locator('[data-tour="mixer.focus"]').click()
    await expect(page.locator('.stem-mixer--focus')).toBeVisible()
    // Read each fill as it settles, not partway through its fade.
    await page.addStyleTag({
      content: '* { transition: none !important; }',
    })
    /** The fill's alpha: 0 is clear glass, 1 a solid box. */
    const fillAlpha = (testId: string) =>
      page.getByTestId(testId).evaluate((element) => {
        const colour = getComputedStyle(element).backgroundColor
        const alpha = /\/\s*([\d.]+)\)|rgba\([^)]*,\s*([\d.]+)\)/.exec(colour)
        return alpha === null ? 1 : Number(alpha[1] ?? alpha[2])
      })

    for (const testId of ['key-chip', 'speed-chip', 'mixer-more']) {
      const control = page.getByTestId(testId)
      await control.hover()
      const hovered = await fillAlpha(testId)
      await control.click()
      await page.mouse.move(2, 2)
      const open = await fillAlpha(testId)
      await page.keyboard.press('Escape')

      // A tint the glass shows through, as on the buttons beside them.
      expect.soft(hovered, `${testId} under the pointer`).toBeGreaterThan(0)
      expect
        .soft(hovered, `${testId} under the pointer`)
        .toBeLessThanOrEqual(0.2)
      expect.soft(open, `${testId} while open`).toBeGreaterThan(0)
      expect.soft(open, `${testId} while open`).toBeLessThanOrEqual(0.2)
    }
  })

  test('docks the focus pill to each edge from More, and Escape shuts More first', async ({
    page,
  }) => {
    await page.locator('[data-tour="mixer.focus"]').click()
    const focus = page.locator('.stem-mixer--focus')
    const pill = page.locator('.sm-transport')
    const more = page.getByRole('button', { name: 'More playback options' })
    const menu = page.getByRole('menu', { name: 'More playback options' })
    await expect(focus).toBeVisible()

    await more.click()
    await expect(menu).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(focus).toBeVisible()

    for (const side of ['top', 'left', 'right', 'bottom'] as const) {
      await dockTo(page, side)
      // More says where the pill is now.
      await more.click()
      await expect(
        page.getByRole('menuitemradio', { name: DOCKS[side] }),
      ).toHaveAttribute('aria-checked', 'true')
      await page.keyboard.press('Escape')
      await expect(menu).toBeHidden()

      const box = await pill.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x, side).toBeGreaterThanOrEqual(0)
      expect(box!.y, side).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width, side).toBeLessThanOrEqual(1440.5)
      expect(box!.y + box!.height, side).toBeLessThanOrEqual(900.5)
      await expect(
        page.getByRole('button', { name: 'Play', exact: true }),
      ).toBeInViewport()

      const timeline = page.getByTestId('mixer-timeline')
      if (side === 'left' || side === 'right') {
        // The side docks stack the controls and leave the timeline out.
        await expect(timeline).toHaveCount(0)
      } else {
        const bar = await timeline.boundingBox()
        expect(bar?.width ?? 0, side).toBeGreaterThanOrEqual(200)
      }
    }

    await page.getByRole('button', { name: 'Exit karaoke mode (Esc)' }).click()
    await expect(focus).toHaveCount(0)
  })
})

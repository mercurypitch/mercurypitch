// ============================================================
// Stem mixer rail: one row that keeps its timeline
// ============================================================
//
// The rail is a capsule of grouped controls with the timeline beside it,
// and the timeline keeps 380 px or takes a line of its own. These are the
// claims only a browser can check, at three window sizes: the timeline
// stays usable, nothing runs past the window, the row does not move when a
// loop is set or the mic turns on, the key panel and the speed list close
// on a press outside and on Escape, and a short loop's close-up opens clear
// of the controls in type of 12 px or more, without shortening the track.
// At 1440 px, an A-B loop also plays round without freezing, the close-up
// stays on screen with the pill docked at the top, and the focus pill docks
// to every edge from the More menu.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'

interface SongSeed {
  seedSong: (input: {
    name: string
    fileHash: string
    vocalWavBase64: string
  }) => Promise<string>
}

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 844, height: 390 },
] as const

/** A mono 8 kHz sine as a WAV, base64 for page.evaluate. */
function toneWavBase64(seconds: number, hz: number): string {
  const rate = 8000
  const samples = Math.floor(rate * seconds)
  const buf = Buffer.alloc(44 + samples * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + samples * 2, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(rate, 24)
  buf.writeUInt32LE(rate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(samples * 2, 40)
  for (let index = 0; index < samples; index += 1) {
    buf.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * hz * index) / rate) * 8000),
      44 + index * 2,
    )
  }
  return buf.toString('base64')
}

const SONG = {
  name: 'Rail Layout Song',
  fileHash: 'rail-layout-song',
  vocalWavBase64: toneWavBase64(30, 220),
}

// The mic's own plumbing is not under test here; a Web Audio stream stands
// in for the device, as in stem-mixer-controls.spec.ts.
const SYNTHETIC_MIC_INIT = () => {
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
    configurable: true,
    value: async () => {
      const context = new AudioContext()
      const oscillator = context.createOscillator()
      const destination = context.createMediaStreamDestination()
      oscillator.frequency.value = 220
      oscillator.connect(destination)
      oscillator.start()
      return destination.stream
    },
  })
}

test.use({ permissions: ['microphone'] })

async function openSeededSong(
  page: Page,
  viewport: { width: number; height: number },
): Promise<void> {
  await page.setViewportSize(viewport)
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  await page.addInitScript(SYNTHETIC_MIC_INIT)
  await page.goto('/')
  await dismissOverlays(page)
  await page.waitForFunction(
    () =>
      (window as unknown as { __ppSongSeed?: unknown }).__ppSongSeed !==
      undefined,
  )
  const sessionId = await page.evaluate((song) => {
    // The first-visit tour offer is a toast that sits on the rail at
    // 844x390 for ten seconds (a phone-stage item, Phase 3 of the rail
    // plan). It is not what this spec measures; mark it already offered.
    localStorage.setItem('pitchperfect_mixer_tour_offered', 'true')
    return (
      window as unknown as { __ppSongSeed: SongSeed }
    ).__ppSongSeed.seedSong(song)
  }, SONG)
  await page.goto(`/#/karaoke/session/${sessionId}/mixer`)
  await dismissOverlays(page)
  await expect(page.getByTestId('mixer-time-total')).toHaveText('0:30', {
    timeout: 20_000,
  })
}

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
  capsule: Box
  timeline: Box
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
    return {
      rail: box(rail),
      capsule: box(document.querySelector('[data-testid="mixer-capsule"]')),
      timeline: box(
        document.querySelector(
          '[data-testid="mixer-timeline"] input[type="range"]',
        ),
      ),
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
    return {
      cutOff,
      smallestTarget: Math.min(...sizes),
      smallestText: Math.min(...texts),
      timeline,
    }
  })
}

const songPosition = (page: Page) =>
  page.getByRole('slider', { name: 'Song position' })

/** Where the playhead is, in seconds. */
const playhead = (page: Page): Promise<number> =>
  songPosition(page).evaluate((element) =>
    Number((element as HTMLInputElement).value),
  )

async function setLoop(page: Page, a: number, b: number): Promise<void> {
  await songPosition(page).fill(String(a))
  await expect.poll(() => playhead(page)).toBeCloseTo(a, 1)
  await page.getByRole('button', { name: 'Set loop start (A)' }).click()
  await songPosition(page).fill(String(b))
  await expect.poll(() => playhead(page)).toBeCloseTo(b, 1)
  await page.getByRole('button', { name: 'Set loop end (B)' }).click()
  await expect(
    page.getByRole('button', { name: 'Set loop end (B)' }),
  ).toHaveAttribute('data-set', 'true')
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

      expect(layout.timeline.w).toBeGreaterThanOrEqual(200)
      expect(
        ownLine || layout.timeline.w >= 380,
        `a ${layout.timeline.w} px timeline squeezed in beside the capsule`,
      ).toBe(true)
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.innerWidth)
      expect(layout.outside).toEqual([])
    })

    test('keeps its width when a loop is set and the mic turns on', async ({
      page,
    }) => {
      const before = await railLayout(page)

      await setLoop(page, 5, 15)
      await page.getByRole('button', { name: 'Enable microphone' }).click()
      await expect(
        page.getByRole('button', { name: 'Disable microphone' }),
      ).toHaveAttribute('aria-pressed', 'true')

      const after = await railLayout(page)
      expect(after.capsule.w).toBeCloseTo(before.capsule.w, 1)
      expect(after.timeline.w).toBeCloseTo(before.timeline.w, 1)
      expect(after.rail.h).toBeCloseTo(before.rail.h, 1)
      expect(after.outside).toEqual([])
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

      const speedChip = page.getByTestId('speed-chip')
      const speedList = page.getByRole('menu', { name: /^Playback speed/ })
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
          // The page's rule: the timeline keeps 380 px or takes a line of
          // its own, and is never squeezed under 200.
          expect.soft(pill.timeline?.w ?? 0, side).toBeGreaterThanOrEqual(200)
          expect
            .soft(
              pill.timeline?.ownLine === true ||
                (pill.timeline?.box ?? 0) >= 380,
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

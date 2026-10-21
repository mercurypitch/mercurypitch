// ============================================================
// The stem mixer's two rows: sizes, folds, and nothing that moves
// ============================================================
//
// The header and the playback rail as approved in the rail redesign of
// 15 October: one header row and one glass bar, 28 px controls on a mouse
// and 44 px under a finger, chips of a fixed width, and folds by each row's
// own width. At nine windows, five on a mouse and four on a touch screen,
// this checks what only a browser can: both rows' heights and control
// sizes, the timeline's room, that no control runs past the window or over
// another, where Speed, Key, Play from the start and the view controls
// fold, that no control moves
// while the singer uses the rail, and that Loop and Hear my voice say why
// they wait in words on screen. At 1440 px it also opens the song in
// Karaoke Night, paused where the singer was, and the mixer's tour lands
// every step at 1440 and 1024.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { HEADER_WORDS_PX, headerFolds, } from '../components/stem-mixer/header/header-fold'
import { keyFolds, restartFolds, speedFolds, TIMELINE_OWN_LINE_COARSE_PX, TIMELINE_OWN_LINE_PX, } from '../components/stem-mixer/rail/rail-fold'
import { contrast } from './helpers/color'
import { blockMic, openSeededSong, playhead, seek } from './helpers/mixer-song'

test.use({ permissions: ['microphone'] })

interface Size {
  width: number
  height: number
}

const MOUSE: readonly Size[] = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 769, height: 600 },
  { width: 844, height: 390 },
]

const TOUCH: readonly Size[] = [
  { width: 1024, height: 768 },
  { width: 962, height: 601 },
  // An Android tablet held sideways.
  { width: 1280, height: 800 },
  // The same tablet upright, beside the app's sidebar: Key and Play from
  // the start fold into More.
  { width: 800, height: 1280 },
]

/** The approved sizes, in px: a mouse's and a finger's. */
const SIZES = {
  mouse: {
    control: 28,
    play: 32,
    speed: 56,
    key: 72,
    header: 52,
    oneLine: 48,
    twoLines: 82,
  },
  touch: {
    control: 44,
    play: 48,
    speed: 64,
    key: 84,
    header: 68,
    oneLine: 110,
    twoLines: 110,
  },
} as const

// The header and the rail measure their content box: the header has 16 px
// of padding either side, the rail a 1 px border.
const HEADER_PADDING = 32
const RAIL_BORDER = 2

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface Control extends Rect {
  name: string
  testId: string | null
  row: 'header' | 'rail'
}

interface Rows {
  header: Rect
  rail: Rect
  left: Rect
  timeline: Rect
  speedFolded: boolean
  headerFolded: boolean
  /** The visible buttons and links of both rows, the timeline's aside. */
  controls: Control[]
  /** Painted things in either row that start or end outside the window. */
  outside: string[]
  scrollWidth: number
  innerWidth: number
}

function readRows(page: Page): Promise<Rows> {
  return page.evaluate(() => {
    const rect = (element: Element | null): Rect => {
      if (element === null) throw new Error('a row part is missing')
      const r = element.getBoundingClientRect()
      return { x: r.left, y: r.top, w: r.width, h: r.height }
    }
    const shown = (element: Element): boolean => {
      const r = element.getBoundingClientRect()
      return (
        r.width > 0 &&
        r.height > 0 &&
        getComputedStyle(element).visibility !== 'hidden'
      )
    }
    const header = document.querySelector('[data-testid="mixer-header"]')
    const rail = document.querySelector('[data-testid="mixer-rail"]')
    const timeline = document.querySelector('[data-testid="mixer-timeline"]')
    if (header === null || rail === null || timeline === null) {
      throw new Error('the mixer rows are missing')
    }
    const controls: Control[] = []
    const rows = [
      ['header', header],
      ['rail', rail],
    ] as const
    for (const [row, root] of rows) {
      for (const element of root.querySelectorAll('button, a')) {
        if (timeline.contains(element) || !shown(element)) continue
        controls.push({
          name:
            element.getAttribute('aria-label') ??
            element.textContent?.trim() ??
            element.tagName,
          testId: element.getAttribute('data-testid'),
          row,
          ...rect(element),
        })
      }
    }
    const outside = [
      ...header.querySelectorAll('*'),
      ...rail.querySelectorAll('*'),
    ]
      .filter((element) => {
        if (!shown(element)) return false
        const r = element.getBoundingClientRect()
        return r.left < -0.5 || r.right > window.innerWidth + 0.5
      })
      .map(
        (element) =>
          `${element.tagName.toLowerCase()}[${
            element.getAttribute('aria-label') ?? element.className
          }]`,
      )
    return {
      header: rect(header),
      rail: rect(rail),
      left: rect(rail.querySelector('[data-testid="mixer-capsule"]')),
      timeline: rect(timeline),
      speedFolded: rail.getAttribute('data-speed-folded') === 'true',
      headerFolded: header.getAttribute('data-folded') === 'true',
      controls,
      outside,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }
  })
}

/** Pairs of controls (and the timeline) that cover each other. */
function overlapping(rows: Rows): string[] {
  const parts: (Rect & { name: string })[] = [
    ...rows.controls,
    { name: 'timeline', ...rows.timeline },
  ]
  const found: string[] = []
  for (let i = 0; i < parts.length; i += 1) {
    for (let j = i + 1; j < parts.length; j += 1) {
      const a = parts[i]!
      const b = parts[j]!
      const across = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
      const down = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
      if (across > 0.5 && down > 0.5) found.push(`${a.name} / ${b.name}`)
    }
  }
  return found
}

/**
 * Marks every visible control of both rows, the song-position slider
 * included, so later reads find the same elements whatever their names
 * become (Play turns into Pause, More names the speed).
 */
function markControls(page: Page): Promise<number> {
  return page.evaluate(() => {
    const roots = [
      document.querySelector('[data-testid="mixer-header"]'),
      document.querySelector('[data-testid="mixer-rail"]'),
    ]
    let count = 0
    for (const root of roots) {
      for (const element of root?.querySelectorAll('button, a, input') ?? []) {
        const r = element.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        element.setAttribute(
          'data-e2e-control',
          `${count}:${element.getAttribute('aria-label') ?? element.tagName}`,
        )
        count += 1
      }
    }
    return count
  })
}

type Placed = Record<string, Rect>

/** Where each marked control is now; one that left the page is absent. */
function placed(page: Page): Promise<Placed> {
  return page.evaluate(() => {
    const out: Record<string, Rect> = {}
    for (const element of document.querySelectorAll('[data-e2e-control]')) {
      const r = element.getBoundingClientRect()
      out[element.getAttribute('data-e2e-control') ?? '?'] = {
        x: r.left,
        y: r.top,
        w: r.width,
        h: r.height,
      }
    }
    return out
  })
}

/** Controls that moved, grew, shrank or went, by more than half a pixel. */
function moved(before: Placed, after: Placed): string[] {
  const found: string[] = []
  for (const [id, was] of Object.entries(before)) {
    const now = after[id]
    if (now === undefined) {
      found.push(`${id} is gone`)
      continue
    }
    const shifts = (['x', 'y', 'w', 'h'] as const).filter(
      (side) => Math.abs(now[side] - was[side]) > 0.5,
    )
    if (shifts.length > 0) {
      found.push(
        `${id}: ${shifts
          .map(
            (side) =>
              `${side} ${was[side].toFixed(1)} -> ${now[side].toFixed(1)}`,
          )
          .join(', ')}`,
      )
    }
  }
  return found
}

const loopButton = (page: Page) =>
  page.getByRole('button', { name: 'Loop', exact: true })
const micButton = (page: Page) =>
  page.getByRole('button', { name: 'Microphone', exact: true })
const monitorButton = (page: Page) =>
  page.getByRole('button', { name: 'Hear my voice', exact: true })
const moreButton = (page: Page) =>
  page.getByRole('button', { name: /^More playback options/ })
const restartButton = (page: Page) =>
  page
    .getByTestId('mixer-rail')
    .getByRole('button', { name: 'Play from the start', exact: true })

/**
 * Opens the key's panel where the rail offers it: its chip, or More's Key
 * row once the chip is folded. True when it came from More.
 */
async function openKey(page: Page): Promise<boolean> {
  const chip = page.getByTestId('key-chip')
  const folded = (await chip.count()) === 0
  if (folded) {
    await moreButton(page).click()
    await page.getByRole('menuitem', { name: /^Key/ }).click()
  } else {
    await chip.click()
  }
  await expect(page.getByRole('dialog', { name: 'Key' })).toBeVisible()
  return folded
}

/** Picks a speed where the rail offers it: its chip, or More's rows. */
async function pickSpeed(page: Page, speed: string): Promise<void> {
  const chip = page.getByTestId('speed-chip')
  if ((await chip.count()) > 0) {
    await chip.click()
    await page
      .getByRole('menu', { name: /^Playback speed/ })
      .getByRole('menuitemradio', { name: speed, exact: true })
      .click()
    await expect(chip).toHaveAccessibleName(`Playback speed ${speed}`)
    return
  }
  await moreButton(page).click()
  await page
    .getByRole('menuitemradio', { name: `Speed ${speed}`, exact: true })
    .click()
  // More names the speed while it is not 1x, before a moved key's name.
  if (speed === '1x') {
    await expect(moreButton(page)).not.toHaveAccessibleName(/Speed/)
  } else {
    await expect(moreButton(page)).toHaveAccessibleName(
      new RegExp(
        `^More playback options\\. Speed ${speed.replace('.', '\\.')}`,
      ),
    )
  }
}

function sizeChecks(rows: Rows, touch: boolean): string[] {
  const size = touch ? SIZES.touch : SIZES.mouse
  const wrong: string[] = []
  const off = (a: number, b: number) => Math.abs(a - b) > 0.5
  for (const control of rows.controls) {
    const label = `${control.row} ${control.name}: ${control.w.toFixed(1)}x${control.h.toFixed(1)}`
    if (control.name === 'Play' || control.name === 'Pause') {
      if (off(control.w, size.play) || off(control.h, size.play)) {
        wrong.push(`${label}, not ${size.play} square`)
      }
      continue
    }
    if (off(control.h, size.control)) {
      wrong.push(`${label}, not ${size.control} tall`)
    }
    if (control.testId === 'speed-chip' && off(control.w, size.speed)) {
      wrong.push(`${label}, not ${size.speed} wide`)
    }
    if (control.testId === 'key-chip' && off(control.w, size.key)) {
      wrong.push(`${label}, not ${size.key} wide`)
    }
    // Every other rail control is a square, and so is a header button
    // without its words.
    if (
      control.row === 'rail' &&
      control.testId !== 'speed-chip' &&
      control.testId !== 'key-chip' &&
      off(control.w, size.control)
    ) {
      wrong.push(`${label}, not ${size.control} wide`)
    }
    if (control.w < size.control - 0.5) {
      wrong.push(`${label}, narrower than ${size.control}`)
    }
  }
  return wrong
}

function layoutTests(windows: readonly Size[], touch: boolean): void {
  for (const size of windows) {
    test.describe(`${touch ? 'touch' : 'mouse'} at ${size.width}x${size.height}`, () => {
      if (touch) test.use({ hasTouch: true, isMobile: true })
      test.beforeEach(async ({ page }) => {
        await openSeededSong(page, size)
      })

      test('holds both rows to their sizes, inside the window, no control over another', async ({
        page,
      }) => {
        const sizes = touch ? SIZES.touch : SIZES.mouse
        const rows = await readRows(page)
        const twoLines = rows.timeline.y >= rows.left.y + rows.left.h - 1

        // Heights: one header row and one bar, the bar a line taller when
        // the timeline takes its own.
        expect(rows.header.h).toBeLessThanOrEqual(sizes.header + 0.5)
        expect(rows.rail.h).toBeLessThanOrEqual(
          (twoLines ? sizes.twoLines : sizes.oneLine) + 0.5,
        )
        expect(sizeChecks(rows, touch)).toEqual([])

        // The timeline: beside the controls with 380 px, or 240 once Speed
        // is in More; short of that, a line of its own across the bar.
        const bar = rows.rail.w - RAIL_BORDER
        const ownLineBelow = touch
          ? TIMELINE_OWN_LINE_COARSE_PX
          : TIMELINE_OWN_LINE_PX
        expect(twoLines, `the timeline's line at ${bar} px of bar`).toBe(
          bar < ownLineBelow,
        )
        if (twoLines) {
          expect(rows.timeline.w).toBeGreaterThanOrEqual(rows.rail.w - 20)
        } else {
          expect(rows.timeline.w).toBeGreaterThanOrEqual(
            rows.speedFolded ? 240 : 380,
          )
        }

        // Speed folds into More by the bar's width; the view controls into
        // View by the header's.
        expect(rows.speedFolded).toBe(speedFolds(bar, touch))
        expect(await page.getByTestId('speed-chip').count()).toBe(
          rows.speedFolded ? 0 : 1,
        )
        expect(await page.getByTestId('key-chip').count()).toBe(
          keyFolds(bar, touch) ? 0 : 1,
        )
        expect(await restartButton(page).count()).toBe(
          restartFolds(bar, touch) ? 0 : 1,
        )
        const header = rows.header.w - HEADER_PADDING
        expect(rows.headerFolded).toBe(headerFolds(header, touch))
        const names = rows.controls.map((control) => control.name)
        if (rows.headerFolded) {
          expect(names).toContain('View')
          for (const gone of ['Stage', 'Layout', 'Mixer sidebar', 'Tour']) {
            expect(names).not.toContain(gone)
          }
        } else {
          expect(names).not.toContain('View')
          for (const kept of ['Stage', 'Layout', 'Tour']) {
            expect(names).toContain(kept)
          }
        }

        // Words beside the icons from 1000 px of header on a mouse; Karaoke
        // Night keeps its words until the view controls fold.
        const byName = (name: string) =>
          rows.controls.find((control) => control.name === name)
        const words = !touch && header >= HEADER_WORDS_PX
        expect((byName('Songs')?.w ?? 0) > sizes.control + 0.5).toBe(words)
        expect(
          (byName('Open in Karaoke Night')?.w ?? 0) > sizes.control + 0.5,
        ).toBe(!rows.headerFolded)

        expect(overlapping(rows)).toEqual([])
        expect(rows.outside).toEqual([])
        expect(rows.scrollWidth).toBeLessThanOrEqual(rows.innerWidth)
      })

      test('moves no control while the singer uses the rail', async ({
        page,
      }) => {
        expect(await markControls(page)).toBeGreaterThan(10)
        const before = await placed(page)
        const loop = loopButton(page)
        const mic = micButton(page)
        const keyChip = page.getByTestId('key-chip')

        const steps: [string, () => Promise<void>][] = [
          [
            'A set',
            async () => {
              await seek(page, 5)
              await page
                .getByRole('button', { name: 'Set loop start (A)' })
                .click()
            },
          ],
          [
            'B set, the loop on',
            async () => {
              await seek(page, 15)
              await page
                .getByRole('button', { name: 'Set loop end (B)' })
                .click()
              await expect(loop).toHaveAttribute('aria-pressed', 'true')
            },
          ],
          [
            'the loop off',
            async () => {
              await loop.click()
              await expect(loop).toHaveAttribute('aria-pressed', 'false')
            },
          ],
          [
            'the loop on again',
            async () => {
              await loop.click()
              await expect(loop).toHaveAttribute('aria-pressed', 'true')
            },
          ],
          // Blocked first: once the mic has a stream, turning it off and on
          // reuses that stream and never asks the browser again.
          [
            'the mic blocked',
            async () => {
              await blockMic(page)
              await mic.click()
              await expect(mic).toHaveAttribute('data-state', 'error')
            },
          ],
          [
            'the mic on, after a press that tries again',
            async () => {
              await blockMic(page, false)
              await mic.click()
              await expect(mic).toHaveAttribute('aria-pressed', 'true')
            },
          ],
          [
            'the key +2',
            async () => {
              const folded = await openKey(page)
              const raise = page.getByRole('button', { name: 'Raise the key' })
              await raise.click()
              await raise.click()
              await page.keyboard.press('Escape')
              if (folded) {
                await expect(moreButton(page)).toHaveAccessibleName(/Key \+2/)
              } else {
                await expect(keyChip).toContainText('+2')
              }
            },
          ],
          ['the speed 0.75x', () => pickSpeed(page, '0.75x')],
          [
            'playing',
            async () => {
              await page
                .getByRole('button', { name: 'Play', exact: true })
                .click()
              await expect(
                page.getByRole('button', { name: 'Pause', exact: true }),
              ).toBeVisible()
            },
          ],
          [
            'paused',
            async () => {
              await page
                .getByRole('button', { name: 'Pause', exact: true })
                .click()
              await expect(
                page.getByRole('button', { name: 'Play', exact: true }),
              ).toBeVisible()
            },
          ],
        ]

        for (const [state, step] of steps) {
          await step()
          expect.soft(moved(before, await placed(page)), state).toEqual([])
        }

        // Finding my key: the chip swaps its chevron for a spinner while the
        // melody is read. The read can take a tenth of a second, so the
        // page notes every control's place the moment the chip goes busy.
        // A phone-class browser streams the vocal and never reads it there
        // (Find my key says so instead), so there is nothing to wait for.
        if (touch) return
        await page.evaluate(() => {
          const chip = document.querySelector('[data-testid="key-chip"]')
          const scope = window as unknown as {
            __busy?: Record<string, unknown>
          }
          scope.__busy = undefined
          if (chip === null) throw new Error('no key chip')
          const observer = new MutationObserver(() => {
            if (chip.getAttribute('aria-busy') !== 'true') return
            if (scope.__busy !== undefined) return
            const out: Record<string, unknown> = {}
            for (const element of document.querySelectorAll(
              '[data-e2e-control]',
            )) {
              const r = element.getBoundingClientRect()
              out[element.getAttribute('data-e2e-control') ?? '?'] = {
                x: r.left,
                y: r.top,
                w: r.width,
                h: r.height,
              }
            }
            scope.__busy = out
          })
          observer.observe(chip, {
            attributes: true,
            attributeFilter: ['aria-busy'],
          })
        })
        await keyChip.click()
        await page.getByRole('button', { name: /^Find my key/ }).click()
        // No voice range is stored yet, so Find my key asks for one first.
        await page.locator('[data-voice="bass"]').first().click()
        await expect
          .poll(() =>
            page.evaluate(
              () =>
                (window as unknown as { __busy?: unknown }).__busy !==
                undefined,
            ),
          )
          .toBe(true)
        const busy = (await page.evaluate(
          () => (window as unknown as { __busy: Placed }).__busy,
        )) as Placed
        expect.soft(moved(before, busy), 'finding my key').toEqual([])
      })

      test('says in words why Loop and Hear my voice wait, and does nothing else', async ({
        page,
      }) => {
        // A waiting control is aria-disabled, which Playwright will not
        // press of its own accord; a person can, and that press is the
        // point here.
        const press = (target: ReturnType<typeof loopButton>) =>
          touch ? target.tap({ force: true }) : target.click({ force: true })
        const loop = loopButton(page)
        const monitor = monitorButton(page)
        const reasonOf = async (target: ReturnType<typeof loopButton>) => {
          const id = await target.getAttribute('aria-describedby')
          expect(id, 'the reason is the control description').not.toBeNull()
          return page.locator(`[id="${id}"]`)
        }

        await expect(loop).toHaveAttribute('aria-disabled', 'true')
        await press(loop)
        const loopReason = await reasonOf(loop)
        await expect(loopReason).toBeVisible()
        await expect(loopReason).toHaveText('Set A and B to loop')
        await expect(loopReason).toBeInViewport({ ratio: 1 })
        await expect(loop).toHaveAttribute('aria-pressed', 'false')

        // With A set, the reason names what is left.
        await seek(page, 5)
        await page.getByRole('button', { name: 'Set loop start (A)' }).click()
        await press(loop)
        await expect(await reasonOf(loop)).toHaveText('Set B to close the loop')
        await expect(loop).toHaveAttribute('aria-pressed', 'false')

        await expect(monitor).toHaveAttribute('aria-disabled', 'true')
        await press(monitor)
        const monitorReason = await reasonOf(monitor)
        await expect(monitorReason).toBeVisible()
        await expect(monitorReason).toHaveText(
          'Turn the mic on to hear yourself',
        )
        await expect(monitorReason).toBeInViewport({ ratio: 1 })
        await expect(monitor).toHaveAttribute('aria-pressed', 'false')

        // With the mic on, Hear my voice works and says nothing.
        await press(micButton(page))
        await expect(micButton(page)).toHaveAttribute('aria-pressed', 'true')
        await expect(monitor).not.toHaveAttribute('aria-disabled', 'true')
        await press(monitor)
        await expect(monitor).toHaveAttribute('aria-pressed', 'true')
      })

      test('lists the speeds in More only while Speed is folded into it', async ({
        page,
      }) => {
        const folded = (await readRows(page)).speedFolded
        await moreButton(page).click()
        const rows = page.getByRole('menuitemradio', { name: /^Speed / })
        await expect(rows).toHaveCount(folded ? 8 : 0)
        await page.keyboard.press('Escape')
        if (!folded) return

        await pickSpeed(page, '0.75x')
        // A dot on More says the speed is not 1x.
        const dot = await moreButton(page).evaluate(
          (button) =>
            button.closest('[data-dot]')?.getAttribute('data-dot') ?? 'none',
        )
        expect(dot).toBe('true')
        await pickSpeed(page, '1x')
      })
    })
  }
}

layoutTests(MOUSE, false)
layoutTests(TOUCH, true)

test.describe('the app sidebar beside a tablet held upright', () => {
  test.use({ hasTouch: true, isMobile: true })

  test('can be put away without a hover, and gives the rail its room', async ({
    page,
  }) => {
    await openSeededSong(page, { width: 800, height: 1280 })
    const collapse = page.getByRole('button', { name: 'Collapse sidebar' })
    // Shown without a hover, at a finger's size.
    expect(
      await collapse.evaluate((button) => getComputedStyle(button).opacity),
    ).toBe('1')
    const box = await collapse.boundingBox()
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44)
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    await expect(page.getByTestId('key-chip')).toHaveCount(0)

    await collapse.click()

    // The rail takes the room back: the key chip returns to it.
    await expect(page.getByTestId('key-chip')).toHaveCount(1)
    expect(overlapping(await readRows(page))).toEqual([])

    await page.getByRole('button', { name: 'Expand sidebar' }).click()
    await expect(page.getByTestId('key-chip')).toHaveCount(0)
  })
})

test.describe('a blocked mic at 1440x900', () => {
  test('stays red under the pointer that pressed it', async ({ page }) => {
    await openSeededSong(page, { width: 1440, height: 900 })
    const mic = micButton(page)
    await blockMic(page)
    await mic.click()
    await expect(mic).toHaveAttribute('data-state', 'error')
    // The pointer is still on the mic, as it is when the reason shows.
    await mic.hover()
    await expect(mic).toHaveCSS('color', 'rgb(255, 123, 114)')
  })

  for (const theme of ['dark', 'light'] as const) {
    test(`says why on a solid line over a white backdrop, ${theme} theme`, async ({
      page,
    }) => {
      await page.addInitScript((value) => {
        localStorage.setItem('pitchperfect_theme', value)
      }, theme)
      await openSeededSong(page, { width: 1440, height: 900 })
      // Brighter than any photo: the stage's glass shows the backdrop most.
      await page.locator('.stem-mixer').evaluate((mixer) => {
        ;(mixer as HTMLElement).style.setProperty(
          '--mp-stage-image',
          'linear-gradient(#fff, #fff)',
        )
      })
      const mic = micButton(page)
      await blockMic(page)
      await mic.click()
      await expect(mic).toHaveAttribute('data-state', 'error')
      await mic.hover()

      const id = await mic.getAttribute('aria-describedby')
      expect(id).not.toBeNull()
      const reason = page.locator(`[id="${id}"]`)
      await expect(reason).toBeVisible()
      const look = await reason.evaluate((line) => {
        const style = getComputedStyle(line)
        return { background: style.backgroundColor, ink: style.color }
      })
      // Opaque: an rgb() colour, not glass mixed with the backdrop.
      expect(look.background).toMatch(/^rgb\(/)
      expect(contrast(look.ink, look.background)).toBeGreaterThanOrEqual(4.5)
    })
  }
})

test.describe('Open in Karaoke Night at 1440x900', () => {
  test('opens the song on the stage, paused where the singer was', async ({
    page,
  }) => {
    const sessionId = await openSeededSong(page, { width: 1440, height: 900 })
    await seek(page, 12)

    const link = page.getByTestId('mixer-karaoke-night')
    await expect(link).toHaveAttribute(
      'href',
      `/karaoke-night?session=${sessionId}`,
    )
    await link.click()

    await expect(page).toHaveURL(/\/karaoke-night\?session=/, {
      timeout: 15_000,
    })
    // The position arrives with the page and is consumed by it.
    await expect
      .poll(() => playhead(page), { timeout: 20_000 })
      .toBeCloseTo(12, 0)
    expect(new URL(page.url()).searchParams.has('t')).toBe(false)
    await expect(
      page.getByRole('button', { name: 'Play', exact: true }).first(),
    ).toBeVisible()
    // Paused: the playhead stays where it landed.
    const landed = await playhead(page)
    await page.waitForTimeout(1000)
    expect(await playhead(page)).toBeCloseTo(landed, 1)
  })
})

/** The mixer tour's step titles for a song without lyrics, in order
 *  (STEM_MIXER_TOUR_STEPS): Sync the timing and Organize & export point at
 *  the lyrics panel's own buttons, which a song without lyrics does not
 *  have, so those two steps drop out. */
const MIXER_TOUR = [
  'Mix the stems',
  'Transport & seek',
  'A–B loop',
  'Playback speed',
  'Sing along, get scored',
  'Song overview',
  'Synced lyrics',
  'Get lyrics in',
  'See your pitch',
  'Songs and playlists',
  'Pitch analysis',
  'Full-screen focus',
  'Karaoke Night',
]

for (const size of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
]) {
  test.describe(`the mixer tour at ${size.width}x${size.height}`, () => {
    test('lands every step on something on screen', async ({ page }) => {
      test.setTimeout(120_000)
      await openSeededSong(page, size)
      await page.getByRole('button', { name: 'Tour', exact: true }).click()

      const title = page.locator('[class*="walkthroughStepTitle"]')
      const spotlight = page.locator('[class*="walkthroughHighlight"]')
      await expect(title).toBeVisible()
      const steps: { title: string; width: number; height: number }[] = []
      for (let guard = 0; guard < 24; guard += 1) {
        // A step can open a menu and switch the layout before it measures;
        // the engine gives its target about a second.
        await page.waitForTimeout(1500)
        const name = ((await title.textContent()) ?? '').trim()
        const box = (await spotlight.isVisible())
          ? await spotlight.boundingBox()
          : null
        steps.push({
          title: name,
          width: box?.width ?? 0,
          height: box?.height ?? 0,
        })
        const finish = page.getByRole('button', { name: 'Finish', exact: true })
        if (await finish.isVisible()) {
          await finish.click()
          break
        }
        await page.getByRole('button', { name: 'Next', exact: true }).click()
      }

      expect(steps.map((step) => step.title)).toEqual(MIXER_TOUR)
      for (const step of steps) {
        expect
          .soft(step.width, `${step.title} has no spotlight`)
          .toBeGreaterThan(14)
        expect
          .soft(step.height, `${step.title} has no spotlight`)
          .toBeGreaterThan(14)
      }
    })
  })
}

test.describe('the mixer tour starting at 1440x900', () => {
  test('goes to the fixed layout without opening a menu', async ({ page }) => {
    await openSeededSong(page, { width: 1440, height: 900 })
    // From another layout, so the tour has to switch before it starts.
    const layout = page.getByTestId('mixer-layout')
    await layout.click()
    await page.getByRole('menuitemradio', { name: 'Single column' }).click()
    await expect(layout).toHaveAttribute('title', 'Layout: Single column')

    await page.evaluate(() => {
      const seen = window as unknown as { __menusOpened: number }
      seen.__menusOpened = 0
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (
              node instanceof Element &&
              (node.matches('[role="menu"]') ||
                node.querySelector('[role="menu"]') !== null)
            )
              seen.__menusOpened += 1
          }
        }
      }).observe(document.body, { childList: true, subtree: true })
    })
    await page.getByRole('button', { name: 'Tour', exact: true }).click()

    await expect(layout).toHaveAttribute('title', 'Layout: Two columns fixed')
    const stems = page.locator('[data-tour="mixer.stems"]')
    const spotlight = page.locator('[class*="walkthroughHighlight"]')
    await expect
      .poll(async () => {
        const target = await stems.boundingBox()
        const lit = await spotlight.boundingBox()
        return (
          target !== null &&
          lit !== null &&
          Math.abs(target.x - lit.x) < 12 &&
          Math.abs(target.y - lit.y) < 12
        )
      })
      .toBe(true)
    expect(
      await page.evaluate(
        () => (window as unknown as { __menusOpened: number }).__menusOpened,
      ),
    ).toBe(0)
  })
})

/** The mixer's saved layout choices, as the next mount will read them. */
const savedSidebarHidden = (page: Page) =>
  page.evaluate(
    () =>
      (
        JSON.parse(
          localStorage.getItem('pitchperfect_workspace_prefs') ?? '{}',
        ) as { sidebarHidden?: boolean }
      ).sidebarHidden ?? null,
  )

test.describe('the mixer tour with the stem sidebar hidden', () => {
  // Owner report, 2026-10-21: with the stem controls hidden, the tour's first
  // step had nothing to spotlight and its card floated mid-screen.
  test('shows the sidebar for the tour without changing the saved choice', async ({
    page,
  }) => {
    await openSeededSong(page, { width: 1440, height: 900 })
    const sidebar = page.locator('aside.sm-sidebar')
    await page.getByRole('button', { name: 'Mixer sidebar' }).click()
    await expect(sidebar).toHaveClass(/sm-sidebar-hidden/)
    await expect.poll(() => savedSidebarHidden(page)).toBe(true)

    await page.getByRole('button', { name: 'Tour', exact: true }).click()
    await expect(page.locator('[class*="walkthroughStepTitle"]')).toHaveText(
      'Mix the stems',
    )
    await expect(sidebar).not.toHaveClass(/sm-sidebar-hidden/)

    // The spotlight lands on the whole stem panel, not on the sliver the
    // sidebar was a frame into sliding open.
    const stems = page.locator('[data-tour="mixer.stems"]')
    const spotlight = page.locator('[class*="walkthroughHighlight"]')
    await expect
      .poll(async () => {
        const target = await stems.boundingBox()
        const lit = await spotlight.boundingBox()
        return (
          target !== null &&
          lit !== null &&
          target.width > 150 &&
          Math.abs(target.x - lit.x) < 12 &&
          Math.abs(target.width - lit.width) < 24
        )
      })
      .toBe(true)
    // Shown for the tour, never written: a mixer remounted under the tour
    // would still read the singer's own choice.
    expect(await savedSidebarHidden(page)).toBe(true)

    await page.keyboard.press('Escape')
    await expect(page.locator('[class*="walkthroughOverlay"]')).toHaveCount(0)
    await expect(sidebar).toHaveClass(/sm-sidebar-hidden/)
    expect(await savedSidebarHidden(page)).toBe(true)
  })
})

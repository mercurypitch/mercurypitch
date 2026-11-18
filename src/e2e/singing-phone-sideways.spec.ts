// ============================================================
// The Singing tab on a phone held on its side
// ============================================================
//
// A phone on its side is wider than the 768 px breakpoint, so the tab drew
// its desktop panel there: the sidebar, the top bar, the Vocal Guide header
// and the Performance monitor took the height, and at 844x390 the notes had
// 8 px. The narrower phones on their side had the phone stage already, in
// its portrait column, which left the notes 97 px of 360. Now every phone
// on its side gets the phone stage in two columns (src/App.tsx,
// SingingMobileStage): the song, the scrubber and the transport down the
// left, the notes the full height beside them; the sidebar folds into the
// header's menu, as it does upright; and the notices stand at the foot, as
// a phone's do, at its right end beside the stage's column. Upright, on a
// tablet and at a desk nothing changes.
//
// Geometry, so only a browser can tell. A phone's user agent and touch,
// because a coarse pointer is half of what makes a phone on its side: a
// desk's window of the same size keeps the desktop panel.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { hitArea, neighbourAreas, sharePress } from './helpers/hit-area'
import { dismissOverlays } from './helpers/ui'

const PHONE = {
  hasTouch: true,
  isMobile: true,
  userAgent:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
}

/** Phones on their side, as their browsers report them: two large, two small. */
const SIDEWAYS = [
  { width: 844, height: 390 },
  { width: 932, height: 430 },
  { width: 740, height: 360 },
  { width: 667, height: 375 },
] as const

const STAGE = '[data-testid="singing-mobile-stage"]'

/** The Singing tab, this server only, nothing over it. */
async function openSinging(
  page: Page,
  viewport: { width: number; height: number },
): Promise<void> {
  await page.setViewportSize(viewport)
  await page.route(
    (url) => url.hostname !== '127.0.0.1' && url.hostname !== 'localhost',
    (route) => route.abort(),
  )
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  await page.goto('/#/singing')
  // The welcome and the plan are spent in storage, and a fresh load reads
  // them: the welcome's dialog, hidden, still takes the taps it covers.
  await dismissOverlays(page)
  await page.reload()
}

interface Sideways {
  /** The notes' height, as a share of the window's. */
  notesShare: number
  /** The transport ends left of where the notes begin. */
  besideTheControls: boolean
  /** The notes end above the tab bar, where there is one. */
  clearOfTheTabBar: boolean
  /** The document's sideways scroll, and the body's: the body can be slid
   *  by a script although no finger can scroll it. */
  sidewaysScroll: number
  pageScroll: number
  /** Each control a singer needs: in the window, and a tap on it lands on it. */
  unreachable: string[]
}

/** What a singer reaches for before a run, by the names the stage gives. */
const BEFORE_A_RUN = [
  'Choose a song',
  'Key, scale and playback options',
  'Start the mic',
  'Play',
  'Practice options',
]

/** And during one: the run's own controls, and the session's. */
const DURING_A_RUN = [
  'Choose a song',
  'Start the mic',
  'Pause',
  'Stop',
  'Practice options',
  'Skip',
  'End',
]

function measureStage(
  page: Page,
  names: string[] = BEFORE_A_RUN,
): Promise<Sideways> {
  return page.evaluate(
    ([sel, names]) => {
      const stage = document.querySelector<HTMLElement>(sel)
      if (stage === null) throw new Error('no phone stage')
      const notes = stage
        .querySelector<HTMLElement>('[data-stage-canvas]')
        ?.getBoundingClientRect()
      const transport = stage
        .querySelector<HTMLElement>('[data-testid="mobile-transport-bar"]')
        ?.getBoundingClientRect()
      if (notes === undefined || transport === undefined) {
        throw new Error('the stage has no notes or no transport')
      }
      const bar = document
        .querySelector('[data-tour="mobile-tabbar"]')
        ?.getBoundingClientRect()
      const scroller = document.scrollingElement ?? document.documentElement
      const unreachable = names.filter((name) => {
        const button = [...stage.querySelectorAll('button')].find(
          (element) =>
            (element.getAttribute('aria-label') ??
              element.textContent?.trim()) === name,
        )
        if (button === undefined) return true
        const r = button.getBoundingClientRect()
        const hit = document.elementFromPoint(
          r.left + r.width / 2,
          r.top + r.height / 2,
        )
        return !(
          r.top >= 0 &&
          r.bottom <= innerHeight &&
          r.left >= 0 &&
          r.right <= innerWidth &&
          hit !== null &&
          button.contains(hit)
        )
      })
      return {
        notesShare: notes.height / innerHeight,
        besideTheControls: transport.right <= notes.left + 0.5,
        clearOfTheTabBar:
          bar === undefined ||
          bar.height === 0 ||
          notes.bottom <= bar.top + 0.5,
        sidewaysScroll:
          scroller.scrollWidth -
          scroller.clientWidth +
          document.body.scrollLeft,
        pageScroll: scroller.scrollHeight - scroller.clientHeight,
        unreachable,
      }
    },
    [STAGE, names] as const,
  )
}

/** Where the first notice stands, at rest. */
interface NoticePlace {
  /** Its box, rounded: left, top, right, bottom. */
  box: number[]
  /** Inside the window, whole. */
  inTheWindow: boolean
  /** On the foot: within 24 px of the tab bar where there is one, else of
   *  the window's edge. */
  atTheFoot: boolean
  /** What it lies over, of the header, the tab bar and the stage's column
   *  of controls (from the header down to the transport's foot, as wide as
   *  the transport). */
  over: string[]
}

async function noticePlace(page: Page): Promise<NoticePlace> {
  const notice = page
    .getByRole('region', { name: 'Notifications' })
    .locator('> div')
    .first()
  await expect(notice).toBeVisible()
  // At rest: it slides into place as it comes.
  await notice.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
  )
  return notice.evaluate((el, sel) => {
    const r = el.getBoundingClientRect()
    const header = document.querySelector('header')?.getBoundingClientRect()
    const bar = document
      .querySelector('[data-tour="mobile-tabbar"]')
      ?.getBoundingClientRect()
    const transport = document
      .querySelector(`${sel} [data-testid="mobile-transport-bar"]`)
      ?.getBoundingClientRect()
    const near: Array<[string, DOMRect | undefined]> = [
      ['the header', header],
      ['the tab bar', bar],
      [
        "the stage's column",
        transport === undefined || header === undefined
          ? undefined
          : new DOMRect(
              0,
              header.bottom,
              transport.right,
              transport.bottom - header.bottom,
            ),
      ],
    ]
    const floor = bar === undefined || bar.height === 0 ? innerHeight : bar.top
    return {
      box: [r.left, r.top, r.right, r.bottom].map(Math.round),
      inTheWindow:
        r.left >= 0 &&
        r.top >= 0 &&
        r.right <= innerWidth &&
        r.bottom <= innerHeight,
      atTheFoot: r.bottom <= floor && r.bottom >= floor - 24,
      over: near
        .filter(
          ([, b]) =>
            b !== undefined &&
            b.width > 0 &&
            r.left < b.right &&
            b.left < r.right &&
            r.top < b.bottom &&
            b.top < r.bottom,
        )
        .map(([name]) => name),
    }
  }, STAGE)
}

test.describe('a phone on its side', () => {
  test.use(PHONE)

  test('gives the notes at least 60% of the window, and nothing scrolls sideways @smoke', async ({
    page,
  }) => {
    await openSinging(page, SIDEWAYS[0])
    await expect(page.locator(STAGE)).toBeVisible()

    const stage = await measureStage(page)

    expect(stage.notesShare).toBeGreaterThanOrEqual(0.6)
    expect(stage.sidewaysScroll).toBe(0)
  })

  for (const size of SIDEWAYS) {
    test(`at ${size.width}x${size.height}, lays the notes the full height beside the controls, every control in reach`, async ({
      page,
    }) => {
      await openSinging(page, size)
      await expect(page.locator(STAGE)).toBeVisible()
      // Not the desktop panel's stage, which held the notes at 8 px.
      await expect(page.locator('#canvas-container')).toHaveCount(0)

      const stage = await measureStage(page)

      expect(stage.notesShare).toBeGreaterThanOrEqual(0.6)
      expect({
        besideTheControls: stage.besideTheControls,
        clearOfTheTabBar: stage.clearOfTheTabBar,
        sidewaysScroll: stage.sidewaysScroll,
        pageScroll: stage.pageScroll,
        unreachable: stage.unreachable,
      }).toEqual({
        besideTheControls: true,
        clearOfTheTabBar: true,
        sidewaysScroll: 0,
        pageScroll: 0,
        unreachable: [],
      })
    })
  }

  // A run brings the session pill into the column, under the 48 px header
  // and, narrower than 768 px, over the tab bar: the key's chip steps aside
  // for it, and the column still ends above the bar.
  for (const size of SIDEWAYS) {
    test(`at ${size.width}x${size.height}, keeps the run's controls and the session's in reach while it plays`, async ({
      page,
    }) => {
      // The first run with the mic off offers the mic once ever, in a toast
      // at the foot, over the transport, upright as well: spent here, so the
      // run's own controls are what is measured.
      await page.addInitScript(() => {
        localStorage.setItem('pitchperfect_mic_practice_offered', 'true')
      })
      await openSinging(page, size)
      const stage = page.locator(STAGE)
      await stage.getByRole('button', { name: 'Play', exact: true }).tap()
      await expect(
        stage.getByRole('button', { name: 'Stop', exact: true }),
      ).toBeVisible()
      await expect(
        stage.getByRole('button', { name: 'End', exact: true }),
      ).toBeVisible()

      const run = await measureStage(page, DURING_A_RUN)

      expect(run.notesShare).toBeGreaterThanOrEqual(0.6)
      expect({
        clearOfTheTabBar: run.clearOfTheTabBar,
        pageScroll: run.pageScroll,
        unreachable: run.unreachable,
      }).toEqual({ clearOfTheTabBar: true, pageScroll: 0, unreachable: [] })
    })
  }

  // The first run with the mic off offers the mic, in a notice. The desk's
  // corner put it over the header's mic and heart at 844x390 and 932x430,
  // and the phone's full-width banner over the transport at 740x360 and
  // 667x375. On its side it stands at the foot's right end, beside the
  // stage's column.
  for (const size of SIDEWAYS) {
    test(`at ${size.width}x${size.height}, offers the mic at the foot, clear of the header, the tab bar and the transport`, async ({
      page,
    }) => {
      await openSinging(page, size)
      await page
        .locator(STAGE)
        .getByRole('button', { name: 'Play', exact: true })
        .tap()
      await expect(
        page.getByRole('region', { name: 'Notifications' }),
      ).toContainText('Your mic is off')

      const { box, ...place } = await noticePlace(page)

      expect(place, `the notice at ${box.join(', ')}`).toEqual({
        inTheWindow: true,
        atTheFoot: true,
        over: [],
      })
    })
  }

  // The header's last two controls take a finger's press on every phone on
  // its side, inside the header's row, and leave each other theirs. The
  // docked mic took 31 x 31 px wider than 768 px, and a 39 px row put a
  // press 1 px off the top of the screen.
  for (const size of SIDEWAYS) {
    test(`at ${size.width}x${size.height}, the heart and the voice pill's mic take a 44 px press each`, async ({
      page,
    }) => {
      await openSinging(page, size)
      await expect(page.locator(STAGE)).toBeVisible()
      const controls = {
        Heart: page.getByTestId('support-heart'),
        Mic: page
          .locator('header')
          .getByRole('button', { name: /^Turn voice control on/ }),
      }
      const wrong: string[] = []
      for (const [name, control] of Object.entries(controls)) {
        await expect(control, name).toBeVisible()
        const own = await hitArea(control)
        if (own.hit[0] < 44 || own.hit[1] < 44) {
          wrong.push(`${name} takes ${own.hit.join('x')}`)
        }
        for (const near of await neighbourAreas(control)) {
          if (sharePress(own.rect, near.rect)) {
            wrong.push(`${name} shares a press`)
          }
        }
      }

      expect(wrong).toEqual([])
    })
  }

  // The Guide's Singing and Toolbar sections pick their steps as the tour
  // starts. By the width alone, a phone on its side wider than 768 px got
  // the desk's: fourteen bubbles in the middle of the screen with nothing
  // lit, since the stage they point at is the phone's. And the phone's step
  // for the bottom tab bar has nothing to light there: the top bar stays.
  for (const size of SIDEWAYS.slice(0, 2)) {
    test(`at ${size.width}x${size.height}, the Guide's Singing and Toolbar tours light something at every step`, async ({
      page,
    }) => {
      // A step can open the drawer, unfold a section and wait about a second
      // for its target: twelve of them are most of a minute.
      test.slow()
      await page.addInitScript(() => {
        localStorage.setItem('pitchperfect_page_tour_offered_singing', 'true')
      })
      await openSinging(page, size)
      await expect(page.locator(STAGE)).toBeVisible()

      const unlit: string[] = []
      for (const section of ['Singing', 'Toolbar']) {
        await page.getByRole('button', { name: 'Menu', exact: true }).tap()
        await page.getByTitle('Interactive guide tours').first().tap()
        await page
          .locator('[class*="guideSectionName"]', {
            hasText: new RegExp(`^${section}$`),
          })
          .first()
          .tap()
        const title = page.locator('[class*="walkthroughStepTitle"]')
        const light = page.locator('[class*="walkthroughHighlight"]')
        await expect(title).toBeVisible()
        for (let guard = 0; guard < 20; guard += 1) {
          await page.waitForTimeout(1500)
          const name = ((await title.textContent()) ?? '').trim()
          const box = (await light.isVisible())
            ? await light.boundingBox()
            : null
          if (box === null || box.width <= 14 || box.height <= 14) {
            unlit.push(`${section}: ${name}`)
          }
          const finish = page.getByRole('button', {
            name: 'Finish',
            exact: true,
          })
          if (await finish.isVisible()) {
            await finish.click()
            break
          }
          await page.getByRole('button', { name: 'Next', exact: true }).click()
        }
        await expect(title).toHaveCount(0)
      }

      expect(unlit).toEqual([])
    })
  }

  test('folds the sidebar into the menu, as upright', async ({ page }) => {
    await openSinging(page, SIDEWAYS[0])
    const sidebar = page.locator('aside.app-sidebar')
    const leftEdge = async (): Promise<number> =>
      Math.round((await sidebar.boundingBox())?.x ?? Number.NaN)

    // Off the page, not beside the stage.
    expect((await sidebar.boundingBox())?.x ?? 0).toBeLessThan(0)

    await page.getByRole('button', { name: 'Menu', exact: true }).tap()
    await expect.poll(leftEdge).toBe(0)

    await page
      .locator('.sidebar-backdrop')
      .tap({ position: { x: 600, y: 200 } })
    await expect.poll(leftEdge).toBeLessThan(0)
  })

  test('keeps the same stage as the phone turns, so the notes are not drawn again', async ({
    page,
  }) => {
    await openSinging(page, { width: 390, height: 844 })
    await expect(page.locator(STAGE)).toBeVisible()
    await page
      .locator(STAGE)
      .evaluate((stage) => stage.setAttribute('data-was-upright', ''))

    await page.setViewportSize(SIDEWAYS[0])

    await expect(page.locator(`${STAGE}[data-was-upright]`)).toBeVisible()
    expect((await measureStage(page)).besideTheControls).toBe(true)
  })
})

test.describe('everywhere else, nothing changes', () => {
  test.describe('a phone upright', () => {
    test.use(PHONE)

    test('keeps one column: the chips, the notes, then the transport', async ({
      page,
    }) => {
      await openSinging(page, { width: 390, height: 844 })
      await expect(page.locator(STAGE)).toBeVisible()

      const column = await page.evaluate((sel) => {
        const stage = document.querySelector<HTMLElement>(sel)!
        const box = (selector: string): DOMRect =>
          stage.querySelector(selector)!.getBoundingClientRect()
        const notes = box('[data-stage-canvas]')
        const chips = box('[data-tour="singing-mobile-chips"]')
        const transport = box('[data-testid="mobile-transport-bar"]')
        return {
          fullWidth: Math.round(notes.width) === innerWidth,
          notesUnderTheChips: notes.top >= chips.bottom - 0.5,
          transportUnderTheNotes: transport.top >= notes.bottom - 0.5,
        }
      }, STAGE)

      expect(column).toEqual({
        fullWidth: true,
        notesUnderTheChips: true,
        transportUnderTheNotes: true,
      })
    })

    test("keeps the notices at the foot, the window's width, on the tab bar", async ({
      page,
    }) => {
      await openSinging(page, { width: 390, height: 844 })
      await page
        .locator(STAGE)
        .getByRole('button', { name: 'Play', exact: true })
        .tap()

      const place = await noticePlace(page)

      expect({
        atTheFoot: place.atTheFoot,
        edges: [place.box[0], 390 - place.box[2]],
      }).toEqual({ atTheFoot: true, edges: [8, 8] })
    })
  })

  test.describe('a tablet on its side', () => {
    test.use({ hasTouch: true, isMobile: true })

    test('keeps the desktop panel beside the sidebar', async ({ page }) => {
      await openSinging(page, { width: 1024, height: 768 })

      await expect(page.locator('#practice-panel')).toBeVisible()
      await expect(page.locator(STAGE)).toHaveCount(0)
      expect((await page.locator('aside.app-sidebar').boundingBox())?.x).toBe(0)
    })
  })

  test.describe('a desk', () => {
    for (const size of [
      { width: 1440, height: 900 },
      // As short as a phone on its side, with a mouse: still a desk.
      { width: 844, height: 390 },
    ]) {
      test(`keeps the desktop panel at ${size.width}x${size.height}`, async ({
        page,
      }) => {
        await openSinging(page, size)

        await expect(page.locator('#practice-panel')).toBeVisible()
        await expect(page.locator(STAGE)).toHaveCount(0)
        await expect(
          page.getByRole('button', { name: 'Menu', exact: true }),
        ).toBeHidden()
      })
    }

    test('keeps the notices in the top right corner', async ({ page }) => {
      await openSinging(page, { width: 1440, height: 900 })
      await page.getByTestId('play-btn').click()

      const place = await noticePlace(page)

      expect({
        top: place.box[1] <= 20,
        right: place.box[2] >= 1440 - 20,
        width: place.box[2] - place.box[0],
      }).toEqual({ top: true, right: true, width: 340 })
    })
  })
})

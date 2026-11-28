// Studio lane menus — a right-click on a lane's header opens the lane's menu with Hear yourself in it, a right-click on empty lane space opens the Studio's, both instead of the browser's menu; the keys move through them, Escape closes them and gives the focus back to the lane, a scroll closes them, Remove track leaves the focus where Ctrl+Z undoes it, a long press on a header or its arm button opens them on touch without arming the lane, and the lane's details switch Hear yourself too.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { importStudioAudio, openArrangement, studioRegion, timelineViewport, } from './helpers/dedicatedstudio-fixture'

/** Every `contextmenu` the page sees, and whether something kept the browser's menu from opening. */
async function watchContextMenus(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: boolean[] = []
    ;(window as unknown as { __contextMenus: boolean[] }).__contextMenus = seen
    // Bubbling to the window comes after every handler in the page.
    window.addEventListener('contextmenu', (event) => {
      seen.push(event.defaultPrevented)
    })
  })
}

async function lastContextMenu(page: Page): Promise<boolean | undefined> {
  return page.evaluate(() =>
    (window as unknown as { __contextMenus: boolean[] }).__contextMenus.at(-1),
  )
}

function laneName(page: Page): Locator {
  return studioRegion(page).getByRole('button', {
    name: 'Phrase details',
    exact: true,
  })
}

function hearYourself(menu: Locator): Locator {
  return menu.getByRole('menuitemcheckbox', { name: /^Hear yourself/ })
}

/** The Sound panel's own switch for the same setting. */
async function soundPanelMonitor(page: Page): Promise<Locator> {
  await studioRegion(page)
    .getByRole('button', { name: 'Sound', exact: true })
    .click()
  return studioRegion(page).getByRole('checkbox', {
    name: 'Monitor through headphones',
  })
}

test.describe('on a computer', () => {
  test.beforeEach(async ({ page }) => {
    await watchContextMenus(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await openArrangement(page)
  })

  test('A right-click on a lane header opens its menu, and Hear yourself there turns monitoring on @smoke', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await laneName(page).click({ button: 'right' })
    const menu = page.getByRole('menu', { name: 'Phrase' })
    await expect(menu).toBeVisible()
    expect(await lastContextMenu(page)).toBe(true)

    // It holds the lane's own actions, with their keys where they have one.
    const item = hearYourself(menu)
    await expect(item).toHaveAttribute('aria-checked', 'false')
    await expect(item).toBeFocused()
    await expect(
      menu.getByRole('menuitemcheckbox', { name: /^Mute/ }),
    ).toHaveAttribute('aria-keyshortcuts', 'M')
    await expect(
      menu.getByRole('menuitemcheckbox', { name: /^Solo/ }),
    ).toHaveAttribute('aria-keyshortcuts', 'S')
    await expect(
      menu.getByRole('menuitem', { name: /^Track details/ }),
    ).toBeVisible()

    await item.click()
    await expect(menu).toBeHidden()
    await expect(await soundPanelMonitor(page)).toBeChecked()

    // Open again: it says so, and Escape closes it, back on the lane's name.
    await laneName(page).click({ button: 'right' })
    await expect(hearYourself(menu)).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(laneName(page)).toBeFocused()
  })

  test('The lane menu works from the keys alone @smoke', async ({ page }) => {
    test.setTimeout(90_000)
    await laneName(page).focus()
    await page.keyboard.press('Shift+F10')
    const menu = page.getByRole('menu', { name: 'Phrase' })
    await expect(menu).toBeVisible()
    const items = menu.locator('[role^="menuitem"]:not([disabled])')
    await expect(items.first()).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(items.nth(1)).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowUp')
    await expect(items.last()).toBeFocused()
    await page.keyboard.press('Home')
    await expect(items.first()).toBeFocused()
    // Enter chooses: Hear yourself turns on.
    await page.keyboard.press('Enter')
    await expect(menu).toBeHidden()
    await expect(laneName(page)).toBeFocused()
    await expect(await soundPanelMonitor(page)).toBeChecked()
  })

  test('A right-click on empty lane space opens the Studio menu inside the window, and nowhere else is the browser menu taken @smoke', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const lane = studioRegion(page).locator('[data-studio-lane-audio]').first()
    const box = (await lane.boundingBox())!
    // Near the window's right edge, past the clip.
    await page.mouse.click(1436, box.y + box.height / 2, { button: 'right' })
    const menu = page.getByRole('menu', { name: 'Studio' })
    await expect(menu).toBeVisible()
    expect(await lastContextMenu(page)).toBe(true)
    await expect(
      menu.getByRole('menuitem', { name: /^Zoom in/ }),
    ).toHaveAttribute('aria-keyshortcuts', '=')
    const placed = (await menu.boundingBox())!
    expect(placed.x).toBeGreaterThanOrEqual(8)
    expect(placed.x + placed.width).toBeLessThanOrEqual(1440 - 8)
    expect(placed.y + placed.height).toBeLessThanOrEqual(900 - 8)
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()

    // The transport is not a lane: the browser keeps its menu there.
    await studioRegion(page)
      .getByRole('button', { name: 'Sound', exact: true })
      .click({ button: 'right' })
    expect(await lastContextMenu(page)).toBe(false)
    await expect(page.getByRole('menu')).toHaveCount(0)
  })

  test("The lane's details switch the same Hear yourself @smoke", async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await laneName(page).click()
    const details = studioRegion(page).getByRole('checkbox', {
      name: /^Hear yourself/,
    })
    await expect(details).not.toBeChecked()
    await details.check()
    await laneName(page).click({ button: 'right' })
    await expect(
      hearYourself(page.getByRole('menu', { name: 'Phrase' })),
    ).toHaveAttribute('aria-checked', 'true')
  })
  test("Escape after a right-click between a header's buttons gives the focus back to the lane's name @smoke", async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const head = studioRegion(page).locator('[data-studio-lane-head]').first()
    // A point on the header that no button or slider covers.
    const gap = await head.evaluate((element) => {
      const box = element.getBoundingClientRect()
      for (let y = box.top + 2; y < box.bottom - 2; y += 3)
        for (let x = box.left + 2; x < box.right - 2; x += 3) {
          const hit = document.elementFromPoint(x, y)
          if (hit && element.contains(hit) && !hit.closest('button, input'))
            return { x, y }
        }
      return null
    })
    expect(gap).not.toBeNull()
    await page.mouse.click(gap!.x, gap!.y, { button: 'right' })
    const menu = page.getByRole('menu', { name: 'Phrase' })
    await expect(menu).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(laneName(page)).toBeFocused()
  })

  test('A scroll of the lanes closes the menu, which would no longer sit by them @smoke', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const lane = studioRegion(page).locator('[data-studio-lane-audio]').first()
    const box = (await lane.boundingBox())!
    await page.mouse.click(box.x + 400, box.y + box.height / 2, {
      button: 'right',
    })
    const menu = page.getByRole('menu', { name: 'Studio' })
    await expect(menu).toBeVisible()
    const viewport = timelineViewport(page)
    await viewport.evaluate((element) => {
      element.scrollLeft += 300
    })
    await expect
      .poll(() => viewport.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(0)
    await expect(menu).toBeHidden()
  })

  test('Remove track in the menu leaves the focus on the next lane, and Ctrl+Z brings the lane back @smoke', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await importStudioAudio(page, 'Second')
    const lanes = studioRegion(page).locator('[data-studio-track]')
    await expect(lanes).toHaveCount(2)
    await laneName(page).click({ button: 'right' })
    await page
      .getByRole('menu', { name: 'Phrase' })
      .getByRole('menuitem', { name: /^Remove track/ })
      .click()
    await expect(lanes).toHaveCount(1)
    await expect(
      studioRegion(page).getByRole('button', {
        name: 'Second details',
        exact: true,
      }),
    ).toBeFocused()

    await page.keyboard.press('Control+z')
    await expect(lanes).toHaveCount(2)
    await expect(laneName(page)).toBeVisible()
  })

  test("Remove track in the lane's details, the song's last lane, leaves the focus where Ctrl+Z brings it back @smoke", async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const lanes = studioRegion(page).locator('[data-studio-track]')
    await expect(lanes).toHaveCount(1)
    await laneName(page).click()
    await studioRegion(page)
      .getByRole('button', { name: 'Remove track', exact: true })
      .click()
    await expect(lanes).toHaveCount(0)
    await expect(
      studioRegion(page).locator('[data-tour="studio.workspace"]'),
    ).toBeFocused()

    await page.keyboard.press('Control+z')
    await expect(lanes).toHaveCount(1)
  })
})

test.describe('on a tablet', () => {
  test.use({ hasTouch: true, isMobile: true })

  test('A long press on a lane header opens its menu, and the lift does not press the header @smoke', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await watchContextMenus(page)
    await page.setViewportSize({ width: 1024, height: 768 })
    await openArrangement(page)
    const name = laneName(page)
    const box = (await name.boundingBox())!
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }
    const session = await page.context().newCDPSession(page)
    try {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [point],
      })
      const menu = page.getByRole('menu', { name: 'Phrase' })
      await expect(menu).toBeVisible()
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      })
      await expect(menu).toBeVisible()
      // The name opens the lane's details on a tap; a long press is not a tap.
      await expect(
        studioRegion(page).getByRole('combobox', { name: 'Sound role' }),
      ).toHaveCount(0)
      await hearYourself(menu).tap()
      await expect(menu).toBeHidden()
      await expect(await soundPanelMonitor(page)).toBeChecked()
    } finally {
      await session.detach()
    }
  })

  test('A long press on the arm button opens the lane menu only: the lane stays disarmed and its details stay shut @smoke', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width: 1024, height: 768 })
    await openArrangement(page)
    const arm = studioRegion(page).getByRole('button', {
      name: 'Arm Phrase for recording',
      exact: true,
    })
    await expect(arm).toHaveAttribute('aria-pressed', 'false')
    const box = (await arm.boundingBox())!
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }
    const session = await page.context().newCDPSession(page)
    try {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [point],
      })
      const menu = page.getByRole('menu', { name: 'Phrase' })
      await expect(menu).toBeVisible()
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      })
      await expect(menu).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(menu).toBeHidden()
    } finally {
      await session.detach()
    }
    // The lift was not a tap: nothing armed, and Track details did not open.
    await expect(arm).toHaveAttribute('aria-pressed', 'false')
    await expect(
      studioRegion(page).locator('[data-studio-record]:visible'),
    ).not.toHaveAttribute('data-phase', 'armed')
    await expect(
      studioRegion(page).getByRole('combobox', { name: 'Sound role' }),
    ).toHaveCount(0)
  })

  test('After a long press, a key on the lane still presses it where no click follows the lift @smoke', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width: 1024, height: 768 })
    await openArrangement(page)
    const name = laneName(page)
    const box = (await name.boundingBox())!
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }
    // Some browsers send no click after a long press: keep this one's from
    // the page, as they would.
    await page.evaluate(() => {
      window.addEventListener(
        'click',
        (event) => event.stopImmediatePropagation(),
        { capture: true, once: true },
      )
    })
    const session = await page.context().newCDPSession(page)
    try {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [point],
      })
      const menu = page.getByRole('menu', { name: 'Phrase' })
      await expect(menu).toBeVisible()
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      })
      await page.keyboard.press('Escape')
      await expect(menu).toBeHidden()
      await expect(name).toBeFocused()
    } finally {
      await session.detach()
    }
    await page.keyboard.press('Enter')
    await expect(
      studioRegion(page).getByRole('combobox', { name: 'Sound role' }),
    ).toHaveCount(1)
  })
})

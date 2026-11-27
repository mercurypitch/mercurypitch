// Studio lane menus — a right-click on a lane's header opens the lane's menu with Hear yourself in it, a right-click on empty lane space opens the Studio's, both instead of the browser's menu; the keys move through them, Escape closes them, a long press opens them on touch, and the lane's details switch Hear yourself too.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'

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
})

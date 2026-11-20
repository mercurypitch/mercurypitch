// Studio songs in the sidebar — a row switches songs with the real mouse or the keyboard, its hover is drawn without moving the row, and a phone's drawer folds away after a pick.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { openArrangement, studioClip, studioRegion, } from './helpers/dedicatedstudio-fixture'

function rail(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Studio songs' })
}

function railSong(page: Page, title: string): Locator {
  return rail(page).getByRole('button', { name: new RegExp(`^${title},`) })
}

/** The open song's name, read from Song options. */
async function openSongTitle(page: Page): Promise<string> {
  const studio = studioRegion(page)
  await studio.getByRole('button', { name: 'Song options' }).click()
  const title = await studio
    .getByRole('textbox', { name: 'Project name' })
    .inputValue()
  await studio.getByRole('button', { name: 'Song options' }).click()
  return title
}

/**
 * Two songs: "Window seat", with a four-second take on one lane, and a new
 * empty "Untitled song", which is left open.
 */
async function twoSongs(page: Page): Promise<void> {
  await openArrangement(page)
  const studio = studioRegion(page)
  await studio.getByRole('button', { name: 'Song options' }).click()
  const title = studio.getByRole('textbox', { name: 'Project name' })
  await title.fill('Window seat')
  await title.press('Tab')
  await expect(
    studio.getByText('Saved in this browser', { exact: true }),
  ).toBeVisible()
  await studio.getByRole('button', { name: 'All songs' }).click()
  await studio.getByRole('button', { name: 'New song', exact: true }).click()
  await expect(
    studio.getByRole('button', { name: 'Close Add takes' }),
  ).toBeVisible()
  await studio.getByRole('button', { name: 'Close Add takes' }).click()
  expect(await openSongTitle(page)).toBe('Untitled song')
}

/** The Studio starts with its rail collapsed, for the lanes: open it. */
async function expandRail(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: 'Expand sidebar', exact: true })
    .click()
  await expect(railSong(page, 'Untitled song')).toHaveAttribute(
    'aria-current',
    'true',
  )
}

/** The hover's two marks: the row's surface layer and the glyph's lift. */
function hoverMarks(row: Locator) {
  return row.evaluate((element) => ({
    surface: getComputedStyle(element, '::before').opacity,
    glyph: getComputedStyle(element.querySelector('span')!).transform,
  }))
}

test('Studio songs in the sidebar switch songs by mouse and keyboard @smoke', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await twoSongs(page)
  await expandRail(page)

  const windowSeat = railSong(page, 'Window seat')
  await expect(windowSeat).toContainText('0:04')
  await expect(windowSeat).toContainText('1 lane')
  await expect(windowSeat).toContainText('Today')
  await expect(windowSeat).not.toHaveAttribute('aria-current', 'true')
  await expect(railSong(page, 'Untitled song')).toContainText('Empty')
  await expect(railSong(page, 'Untitled song')).toContainText('Open')

  // The real mouse: the surface fades in and the glyph lifts, and the row
  // itself stays exactly where it was.
  const before = await windowSeat.boundingBox()
  expect(await hoverMarks(windowSeat)).toEqual({
    surface: '0',
    glyph: 'none',
  })
  await windowSeat.hover()
  await expect
    .poll(() => hoverMarks(windowSeat).then((m) => m.surface))
    .toBe('1')
  await expect
    .poll(() => hoverMarks(windowSeat).then((m) => m.glyph))
    .not.toBe('none')
  expect(await windowSeat.boundingBox()).toEqual(before)

  await windowSeat.click()
  await expect(studioClip(page, 'Phrase')).toHaveCount(1)
  await expect(windowSeat).toHaveAttribute('aria-current', 'true')
  await expect(railSong(page, 'Untitled song')).not.toHaveAttribute(
    'aria-current',
  )
  expect(await openSongTitle(page)).toBe('Window seat')

  // The keyboard: Tab reaches the other row with a visible ring, and Enter
  // opens its song.
  const untitled = railSong(page, 'Untitled song')
  const rows = rail(page).getByRole('button')
  const names = await rows.evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute('aria-label') ?? ''),
  )
  const at = names.findIndex((name) => name.startsWith('Untitled song,'))
  if (at > 0) {
    await rows.nth(at - 1).focus()
    await page.keyboard.press('Tab')
  } else {
    await rows.nth(1).focus()
    await page.keyboard.press('Shift+Tab')
  }
  await expect(untitled).toBeFocused()
  expect(
    await untitled.evaluate((element) => ({
      visible: element.matches(':focus-visible'),
      outline: getComputedStyle(element).outlineStyle,
    })),
  ).toEqual({ visible: true, outline: 'solid' })
  await page.keyboard.press('Enter')
  await expect(untitled).toHaveAttribute('aria-current', 'true')
  await expect(studioClip(page, 'Phrase')).toHaveCount(0)
  expect(await openSongTitle(page)).toBe('Untitled song')
})

test('Studio songs in the sidebar keep still under reduced motion', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await twoSongs(page)
  await expandRail(page)

  const windowSeat = railSong(page, 'Window seat')
  await windowSeat.hover()
  // The surface still marks the row, at once; nothing moves.
  expect(await hoverMarks(windowSeat)).toEqual({ surface: '1', glyph: 'none' })
})

test('Studio songs in the phone drawer fold it away after a pick', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await twoSongs(page)

  await expect(rail(page)).toHaveCount(0)
  await page.locator('.sidebar-toggle-btn').click()
  const windowSeat = railSong(page, 'Window seat')
  await expect(windowSeat).toBeInViewport()
  const box = (await windowSeat.boundingBox())!
  expect(box.height).toBeGreaterThanOrEqual(44)

  await windowSeat.click()
  await expect(rail(page)).toHaveCount(0)
  await expect(studioClip(page, 'Phrase')).toHaveCount(1)
})

test('The Studio tour opens the collapsed Studio rail for its song list, and closes it after', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => {
    localStorage.setItem('pitchperfect_page_tour_offered_studio', 'true')
  })
  await openArrangement(page)
  await page
    .getByRole('button', { name: 'Expand sidebar', exact: true })
    .click()
  await page.getByTitle('Take a guided tour of this page').click()
  const step = page.locator('[class*="walkthroughStepTitle"]')
  await expect(step).toHaveText('Song options')
  // The rail collapses under the running tour, as the Studio's rail starts
  // on a visit whose tour starts from its offer. The overlay covers the
  // button, so it is pressed from the page.
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>('button[title="Collapse sidebar"]')!
      .click(),
  )
  await expect(page.locator('.app-sidebar.collapsed')).toHaveCount(1)

  await page.getByRole('button', { name: 'Next', exact: true }).click()

  await expect(step).toHaveText('Switch songs')
  await expect(page.locator('.app-sidebar.collapsed')).toHaveCount(0)
  await expect(page.locator('[data-tour="studio.rail-songs"]')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(step).toHaveCount(0)
  await expect(page.locator('.app-sidebar.collapsed')).toHaveCount(1)
})

// Studio songs in the sidebar — a row switches songs with the real mouse or the keyboard, its hover is drawn without moving the row, New song above the list makes a song and opens it unless a take holds it, and a phone's drawer folds away after a pick or a new song.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { openArrangement, studioClip, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { fakeMicArgs, TONE_HZ, writeToneWav } from './helpers/tone-wav'

// A take holds New song: the fake microphone it records from is a launch
// option, which Playwright takes for a whole file only.
test.use({
  launchOptions: { args: fakeMicArgs(writeToneWav(TONE_HZ, 20)) },
  permissions: ['microphone'],
})

function rail(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Studio songs' })
}

function railSong(page: Page, title: string): Locator {
  return rail(page).getByRole('button', { name: new RegExp(`^${title},`) })
}

/** The Your songs section: New song, the hold line and the list. */
function railSection(page: Page): Locator {
  return page.locator('[data-tour="studio.rail-songs"]')
}

function railNewSong(page: Page): Locator {
  return railSection(page).getByRole('button', {
    name: 'New song',
    exact: true,
  })
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

/** Keep every text the rail's live region says, from now on. */
async function keepRailSays(page: Page): Promise<() => Promise<string[]>> {
  await page.evaluate(() => {
    const status = document.querySelector(
      '[data-tour="studio.rail-songs"] [role="status"]',
    )!
    const said: string[] = []
    ;(window as unknown as { __railSaid: string[] }).__railSaid = said
    new MutationObserver(() => said.push(status.textContent ?? '')).observe(
      status,
      { childList: true, characterData: true, subtree: true },
    )
  })
  return () =>
    page.evaluate(
      () => (window as unknown as { __railSaid: string[] }).__railSaid,
    )
}

test('New song in the sidebar makes a song and opens it, the song that was open stays listed, and a song picked after it opens without Add takes @smoke', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await twoSongs(page)
  await expandRail(page)
  // Window seat open, so the new song is the only Untitled song that can be.
  // The page's own New song asked for Add takes; a song picked after it
  // opens without it.
  await railSong(page, 'Window seat').click()
  await expect(railSong(page, 'Window seat')).toHaveAttribute(
    'aria-current',
    'true',
  )
  await expect(studioClip(page, 'Phrase')).toHaveCount(1)
  await expect(page.locator('[data-studio-panel]')).toHaveCount(0)

  // Above the list and outside its scroll.
  const newSong = railNewSong(page)
  const button = (await newSong.boundingBox())!
  const list = (await rail(page).boundingBox())!
  expect(button.y + button.height).toBeLessThanOrEqual(list.y)
  expect(button.height).toBeGreaterThanOrEqual(44)
  // The real mouse brings the hover surface in.
  await newSong.hover()
  await expect
    .poll(() =>
      newSong.evaluate(
        (element) => getComputedStyle(element, '::before').opacity,
      ),
    )
    .toBe('1')

  const said = await keepRailSays(page)
  await newSong.click()

  const studio = studioRegion(page)
  await expect(
    studio.getByRole('button', { name: 'Close Add takes' }),
  ).toBeVisible()
  await expect(rail(page).getByRole('button')).toHaveCount(3)
  const current = rail(page).locator('button[aria-current="true"]')
  await expect(current).toHaveCount(1)
  await expect(current).toHaveAccessibleName(/^Untitled song, empty,/)
  await expect(
    rail(page).getByRole('button', { name: /^Untitled song,/ }),
  ).toHaveCount(2)
  await expect(railSong(page, 'Window seat')).not.toHaveAttribute(
    'aria-current',
  )
  await studio.getByRole('button', { name: 'Close Add takes' }).click()
  await expect(studioClip(page, 'Phrase')).toHaveCount(0)
  expect(await openSongTitle(page)).toBe('Untitled song')

  // The rail's New song asked for Add takes too; Window seat, picked
  // after it, opens without it.
  await railSong(page, 'Window seat').click()
  await expect(studioClip(page, 'Phrase')).toHaveCount(1)
  await expect(page.locator('[data-studio-panel]')).toHaveCount(0)
  // The page's own work on the new song is no hold to read out.
  expect((await said()).filter((text) => text !== '')).toEqual([])
})

test('New song in the phone drawer folds it away and opens the new song', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await twoSongs(page)

  await expect(railNewSong(page)).toHaveCount(0)
  await page.locator('.sidebar-toggle-btn').click()
  const newSong = railNewSong(page)
  await expect(newSong).toBeInViewport()
  expect((await newSong.boundingBox())!.height).toBeGreaterThanOrEqual(44)

  await newSong.click()
  await expect(rail(page)).toHaveCount(0)
  await expect(
    studioRegion(page).getByRole('button', { name: 'Close Add takes' }),
  ).toBeVisible()
  await page.locator('.sidebar-toggle-btn').click()
  await expect(rail(page).getByRole('button')).toHaveCount(3)
})

test.describe('New song in the sidebar while a take runs', () => {
  test('is held, says why, and makes no song', async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width: 1440, height: 900 })
    await twoSongs(page)
    await expandRail(page)
    await railSong(page, 'Window seat').click()
    await expect(studioClip(page, 'Phrase')).toHaveCount(1)

    const studio = studioRegion(page)
    const record = studio.locator('[data-studio-record]')
    await expect(record).toHaveAttribute('data-phase', 'idle')
    await studio
      .getByRole('button', { name: 'Arm Phrase for recording', exact: true })
      .click()
    await expect(record).toHaveAttribute('data-phase', 'armed', {
      timeout: 15_000,
    })
    await record.click()
    await expect(record).toHaveAccessibleName('Stop recording', {
      timeout: 10_000,
    })

    const newSong = railNewSong(page)
    await expect(newSong).toHaveAttribute('aria-disabled', 'true')
    await expect(railSection(page).getByRole('status')).toHaveText(
      'Stop the take to switch songs.',
    )
    // aria-disabled, not disabled: the real mouse still lands on it.
    await newSong.click({ force: true })
    await expect(rail(page).getByRole('button')).toHaveCount(2)
    await expect(railSong(page, 'Window seat')).toHaveAttribute(
      'aria-current',
      'true',
    )

    await record.click()
    await expect(record).toHaveAccessibleName('Record', { timeout: 30_000 })
    await expect(newSong).not.toHaveAttribute('aria-disabled')
    await expect(railSection(page).getByRole('status')).toHaveText('')
    await expect(rail(page).getByRole('button')).toHaveCount(2)
  })
})

const RAIL_KEY = 'sidebar-studio-rail-open'

function railChoice(page: Page): Promise<string | null> {
  return page.evaluate((key) => localStorage.getItem(key), RAIL_KEY)
}

function collapsedRail(page: Page): Locator {
  return page.locator('.app-sidebar.collapsed')
}

test('The Studio sidebar remembers being expanded or collapsed across a reload', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openArrangement(page)
  // A first visit gives the lanes the width.
  await expect(collapsedRail(page)).toHaveCount(1)
  expect(await railChoice(page)).toBeNull()

  await page
    .getByRole('button', { name: 'Expand sidebar', exact: true })
    .click()
  await page.reload()

  await expect(rail(page)).toBeVisible()
  await expect(collapsedRail(page)).toHaveCount(0)
  expect(await railChoice(page)).toBe('true')

  await page.getByTitle('Collapse sidebar', { exact: true }).click()
  await page.reload()

  await expect(studioRegion(page)).toBeVisible()
  await expect(collapsedRail(page)).toHaveCount(1)
  expect(await railChoice(page)).toBe('false')
})

/** Start the Studio's tour and step to Switch songs. */
async function tourToSwitchSongs(
  page: Page,
  collapseFirst: boolean,
): Promise<Locator> {
  await page.getByTitle('Take a guided tour of this page').click()
  const step = page.locator('[class*="walkthroughStepTitle"]')
  await expect(step).toHaveText('Song options')
  if (collapseFirst) {
    // The rail collapses under the running tour, as a visit whose tour
    // starts from its offer has it. The overlay covers the button, so it
    // is pressed from the page.
    await page.evaluate(() =>
      document
        .querySelector<HTMLButtonElement>('button[title="Collapse sidebar"]')!
        .click(),
    )
    await expect(collapsedRail(page)).toHaveCount(1)
  }
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(step).toHaveText('Switch songs')
  await expect(collapsedRail(page)).toHaveCount(0)
  await expect(page.locator('[data-tour="studio.rail-songs"]')).toBeVisible()
  return step
}

for (const collapsed of [true, false]) {
  test(`The Studio tour shows its song list and leaves the sidebar ${collapsed ? 'collapsed' : 'expanded'}, as it found it`, async ({
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

    const step = await tourToSwitchSongs(page, collapsed)
    // The tour's opening is not the person's choice.
    expect(await railChoice(page)).toBe(collapsed ? 'false' : 'true')
    await page.keyboard.press('Escape')

    await expect(step).toHaveCount(0)
    await expect(collapsedRail(page)).toHaveCount(collapsed ? 1 : 0)
    expect(await railChoice(page)).toBe(collapsed ? 'false' : 'true')
  })
}

test('The Studio tour keeps its Switch songs step when Your songs is collapsed, opens it, and folds it back after', async ({
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
  const section = page.locator('[data-collapsible="sidebar-studio-songs-open"]')
  await section.click()
  await expect(rail(page)).toHaveCount(0)

  const step = await tourToSwitchSongs(page, false)
  await expect(rail(page)).toBeVisible()
  await page.keyboard.press('Escape')

  await expect(step).toHaveCount(0)
  await expect(rail(page)).toHaveCount(0)
  await expect(section).toBeVisible()
})

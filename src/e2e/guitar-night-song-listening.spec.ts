// Song Listening reuses the score route fan beside playback, without passive hardware access.
// ============================================================

import { expect, test } from '@playwright/test'
import { join } from 'node:path'

import { audioActivity, guardPassiveAudio } from './helpers/guitar-night-amp'
import { enterSong } from './helpers/guitar-night-song'

for (const width of [1440, 390, 320]) {
  test(`song Listening opens its shared route fan above the bottom-left control at ${width}px @smoke`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const cabinetRequests = await guardPassiveAudio(page)
    await enterSong(page, 2)
    const baseline = await audioActivity(page)
    // The shared control's identity is intentionally identical in both hosts.
    const listening = page.getByTestId('guitar-night-listening-cycle')
    await expect(listening).toHaveAttribute('data-state', 'off')
    const box = await listening.boundingBox()
    if (box === null) throw new Error('Listening has no pointer target')
    expect(box.x).toBeLessThan(40)
    expect(box.y).toBeGreaterThan(450)
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
    const rail = await page
      .getByRole('slider', { name: 'Song position', exact: true })
      .boundingBox()
    const play = await page
      .getByRole('button', { name: 'Play backing', exact: true })
      .boundingBox()
    if (rail === null || play === null)
      throw new Error('Song transport has no layout')
    expect(rail.width).toBeGreaterThanOrEqual(90)
    expect(rail.x).toBeGreaterThanOrEqual(box.x + box.width)
    expect(
      rail.y + rail.height <= play.y || rail.x + rail.width <= play.x,
    ).toBe(true)
    await expect(
      page.getByRole('button', {
        name: 'A — start the loop at the playhead',
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', {
        name: 'B — end the loop at the playhead',
        exact: true,
      }),
    ).toBeVisible()

    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, {
      button: 'right',
    })

    const picker = page.getByRole('menu', {
      name: 'Listening route',
      exact: true,
    })
    await expect(picker).toBeVisible()
    for (const label of ['Room mic', 'Direct input', 'MIDI']) {
      await expect(
        picker.getByRole('menuitemradio', {
          name: new RegExp(`Listen with ${label}`),
        }),
      ).toBeVisible()
    }
    // The shared fan measures and clamps itself on the next animation frame.
    // Assert its settled geometry, not the unpositioned first paint.
    await expect(async () => {
      const menuBox = await picker.boundingBox()
      const anchorBox = await listening.boundingBox()
      if (menuBox === null || anchorBox === null)
        throw new Error('Listening picker has no layout')
      expect(menuBox.x).toBeGreaterThanOrEqual(7)
      expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(width - 7)
      expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(anchorBox.y)
    }).toPass({ timeout: 5000 })
    expect(await audioActivity(page)).toEqual(baseline)
    expect(cabinetRequests).toEqual([])
    const directory = process.env.GUITAR_SONG_LISTENING_ARTIFACTS
    const name = `song-listening-fan-${width}.png`
    const path =
      directory === undefined
        ? test.info().outputPath(name)
        : join(directory, name)
    await page.screenshot({ path })
    await test.info().attach(name, { path, contentType: 'image/png' })
    await page.keyboard.press('Escape')
    await expect(picker).toBeHidden()
    await expect(listening).toBeFocused()

    await page
      .getByRole('button', { name: 'Session controls', exact: true })
      .click()
    const session = page.getByRole('dialog', { name: 'Session', exact: true })
    const input = session.getByRole('region', {
      name: 'Listening input',
      exact: true,
    })
    for (const label of ['Room mic', 'Direct input', 'MIDI']) {
      await expect(
        input.getByRole('button', { name: label, exact: true }),
      ).toBeVisible()
    }
    expect(
      await input.evaluate((element) => element.closest('details') === null),
    ).toBe(true)
    await input
      .getByRole('button', { name: 'Direct input', exact: true })
      .click()
    await expect(
      input.getByRole('button', { name: 'Direct input', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(listening).toHaveAttribute('data-route', 'interface')
    await expect(listening).toHaveAttribute('data-state', 'off')
    await expect(
      session.getByRole('button', { name: 'Turn on Listening', exact: true }),
    ).toBeVisible()
    const sessionName = `song-listening-session-${width}.png`
    const sessionPath =
      directory === undefined
        ? test.info().outputPath(sessionName)
        : join(directory, sessionName)
    await page.screenshot({ path: sessionPath })
    await test
      .info()
      .attach(sessionName, { path: sessionPath, contentType: 'image/png' })
    await session
      .getByRole('button', { name: 'Close Session', exact: true })
      .click()
    const dockMix = page.getByRole('group', {
      name: 'Song playback mix',
      exact: true,
    })
    await expect(dockMix).toBeVisible()
    await expect(
      dockMix.getByRole('button', { name: 'Mute backing', exact: true }),
    ).toBeEnabled()
    await expect(
      dockMix.getByRole('button', {
        name: 'Turn on your monitoring',
        exact: true,
      }),
    ).toBeDisabled()
    const dockBox = await dockMix.boundingBox()
    // Selecting Direct input changes the compact dock's row height. Compare
    // both current boxes, not the earlier Room-mic position before Session.
    const currentListeningBox = await listening.boundingBox()
    if (dockBox === null || currentListeningBox === null)
      throw new Error('Song mix has no layout')
    expect(dockBox.y).toBeGreaterThanOrEqual(
      currentListeningBox.y + currentListeningBox.height,
    )
    expect(dockBox.x).toBeLessThan(40)
    const dockPath = test.info().outputPath(`song-mix-dock-${width}.png`)
    await page.screenshot({ path: dockPath })
    await test
      .info()
      .attach('Song mix dock', { path: dockPath, contentType: 'image/png' })
    await listening.click({ button: 'right' })
    const controls = page.getByRole('group', {
      name: 'Direct input quick controls',
    })
    await expect(
      controls.getByRole('button', { name: 'Turn on Listening', exact: true }),
    ).toBeEnabled()
    await expect(
      controls.getByRole('button', {
        name: 'Turn on your monitoring',
        exact: true,
      }),
    ).toBeDisabled()
    await controls
      .getByRole('button', { name: 'Mute backing', exact: true })
      .click()
    await expect(
      controls.getByRole('button', { name: 'Unmute backing', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false')
    await controls
      .getByRole('button', { name: 'Unmute backing', exact: true })
      .click()
    await expect(async () => {
      const quickBox = await controls.boundingBox()
      const anchorBox = await listening.boundingBox()
      if (quickBox === null || anchorBox === null)
        throw new Error('Quick Listening controls have no layout')
      expect(quickBox.x).toBeGreaterThanOrEqual(7)
      expect(quickBox.x + quickBox.width).toBeLessThanOrEqual(width - 7)
      expect(quickBox.y + quickBox.height).toBeLessThanOrEqual(anchorBox.y)
    }).toPass({ timeout: 5000 })
    for (const toggle of await controls.getByRole('button').all()) {
      const toggleBox = await toggle.boundingBox()
      expect(toggleBox?.width).toBeGreaterThanOrEqual(44)
      expect(toggleBox?.height).toBeGreaterThanOrEqual(44)
    }
    const quickPath =
      directory === undefined
        ? test.info().outputPath(`song-quick-mix-${width}.png`)
        : join(directory, `song-quick-mix-${width}.png`)
    await page.screenshot({ path: quickPath })
    await test.info().attach('Direct input quick controls', {
      path: quickPath,
      contentType: 'image/png',
    })
    await page.keyboard.press('Escape')
    await expect(controls).toBeHidden()
    await expect(listening).toBeFocused()
    expect(await audioActivity(page)).toEqual(baseline)
    expect(cabinetRequests).toEqual([])
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1)
  })
}

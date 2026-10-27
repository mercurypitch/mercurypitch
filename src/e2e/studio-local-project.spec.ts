// Studio local projects — real file imports, durable reloads and portable backup ownership.
import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { dismissOverlays, openNavTab, waitForNav } from './helpers/ui'

function audioFixture(durationSeconds = 1, frequency = 220): Buffer {
  const frames = 48_000 * durationSeconds
  const bytes = Buffer.alloc(44 + frames * 2)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(48_000, 24)
  bytes.writeUInt32LE(96_000, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(frames * 2, 40)
  for (let i = 0; i < frames; i++)
    bytes.writeInt16LE(
      Math.round(
        Math.sin((i * Math.PI * frequency * 2) / 48_000) *
          8_000 *
          (0.35 + 0.65 * Math.sin((i / 48_000) * 3) ** 2),
      ),
      44 + i * 2,
    )
  return bytes
}

async function openStudio(page: Page, direct = false): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
  })
  await page.goto(direct ? '/studio-night' : '/')
  await waitForNav(page, 30_000)
  await dismissOverlays(page)
  if (!direct) await openNavTab(page, 'tab-studio-night')
  await expect(
    page.getByRole('region', { name: 'Studio', exact: true }),
  ).toBeVisible()
}

test('Studio imports audio, reloads and restores a backup in a fresh browser @smoke', async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openStudio(page)
  const studio = page.getByRole('region', { name: 'Studio', exact: true })
  await studio
    .getByRole('button', { name: 'Create project', exact: true })
    .click()
  await studio.getByRole('button', { name: 'Close Add takes' }).click()
  await studio.getByRole('button', { name: 'Song options' }).click()
  const title = studio.getByRole('textbox', { name: 'Project name' })
  await expect(title).toBeEnabled()
  await title.fill('First Studio song')
  await title.press('Tab')
  await expect(
    studio.getByText('Saved in this browser', { exact: true }),
  ).toBeVisible()
  await studio.locator('input[type=file][accept^="audio/"]').setInputFiles({
    name: 'Guitar idea.wav',
    mimeType: 'audio/wav',
    buffer: audioFixture(),
  })
  await expect(
    studio.getByRole('button', { name: 'Guitar idea details', exact: true }),
  ).toBeVisible()
  await expect(
    studio.getByText('Saved in this browser', { exact: true }),
  ).toBeVisible()
  await studio.getByRole('button', { name: 'Add takes', exact: true }).click()
  await expect(
    studio.getByRole('region', { name: 'Add takes', exact: true }),
  ).toBeVisible()
  await expect(
    studio.getByRole('region', { name: 'Add takes', exact: true }),
  ).toContainText('Keep a recording in the app')
  await page.reload()
  await expect(
    studio.getByRole('button', { name: /First Studio song/ }),
  ).toBeEnabled()
  await studio.getByRole('button', { name: /First Studio song/ }).click()
  // Unload cannot guarantee an async lease release. A fresh document must
  // explicitly take over the remaining lease instead of silently stealing it.
  const resumeEditing = studio.getByRole('button', { name: 'Edit in this tab' })
  await studio.getByRole('button', { name: 'Song options' }).click()
  await expect(
    studio.getByRole('textbox', { name: 'Project name' }),
  ).toHaveValue('First Studio song')
  if (await resumeEditing.isVisible()) {
    await resumeEditing.click()
    await expect(
      studio.getByText('Saved in this browser', { exact: true }),
    ).toBeVisible()
    await studio.getByRole('button', { name: 'Song options' }).click()
  }
  await expect(
    studio.getByRole('button', { name: 'Guitar idea details', exact: true }),
  ).toBeVisible()
  await expect(
    studio.getByText('Saved in this browser', { exact: true }),
  ).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await studio
    .getByRole('button', { name: 'Save project backup', exact: true })
    .click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('First Studio song.mpstudio')
  const backupPath = testInfo.outputPath('first-studio-song.mpstudio')
  await download.saveAs(backupPath)
  const backup = await readFile(backupPath)
  expect(backup.length).toBeGreaterThan(44)
  const restoredContext = await browser.newContext({
    baseURL,
    ignoreHTTPSErrors: true,
    timezoneId: 'UTC',
  })
  try {
    const restoredPage = await restoredContext.newPage()
    await openStudio(restoredPage, true)
    const restored = restoredPage.getByRole('region', {
      name: 'Studio',
      exact: true,
    })
    await expect(
      restored.getByText('No songs yet', { exact: true }),
    ).toBeVisible()
    await restored
      .locator('input[type=file][accept=".mpstudio"]')
      .setInputFiles({
        name: download.suggestedFilename(),
        mimeType: 'application/zip',
        buffer: backup,
      })
    await restored.getByRole('button', { name: 'Song options' }).click()
    await expect(
      restored.getByRole('textbox', { name: 'Project name' }),
    ).toHaveValue('First Studio song')
    await expect(
      restored.getByRole('button', {
        name: 'Guitar idea details',
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      restored.getByText('Saved in this browser', { exact: true }),
    ).toBeVisible()
  } finally {
    await restoredContext.close()
  }
  expect(errors).toEqual([])
})

test('Studio makes a second tab read only until explicit takeover @smoke', async ({
  page,
  context,
}) => {
  test.setTimeout(60_000)
  await openStudio(page, true)
  const studio = page.getByRole('region', { name: 'Studio', exact: true })
  await studio
    .getByRole('button', { name: 'Create project', exact: true })
    .click()
  await studio.getByRole('button', { name: 'Close Add takes' }).click()
  await studio.getByRole('button', { name: 'Song options' }).click()
  const title = studio.getByRole('textbox', { name: 'Project name' })
  await expect(title).toBeEnabled()
  await title.fill('Two tabs')
  await title.press('Tab')
  await expect(
    studio.getByText('Saved in this browser', { exact: true }),
  ).toBeVisible()
  const second = await context.newPage()
  try {
    await openStudio(second, true)
    const other = second.getByRole('region', { name: 'Studio', exact: true })
    await other.getByRole('button', { name: /Two tabs/ }).click()
    await other.getByRole('button', { name: 'Song options' }).click()
    await expect(
      other.getByRole('textbox', { name: 'Project name' }),
    ).toBeDisabled()
    await expect(other.getByText('Read only', { exact: true })).toBeVisible()
    await other.getByRole('button', { name: 'Edit in this tab' }).click()
    await expect(
      other.getByText('Saved in this browser', { exact: true }),
    ).toBeVisible()
    await other.getByRole('button', { name: 'Song options' }).click()
    await expect(
      other.getByRole('textbox', { name: 'Project name' }),
    ).toBeEnabled()
    await expect(
      studio.getByRole('textbox', { name: 'Project name' }),
    ).toBeDisabled({ timeout: 15_000 })
  } finally {
    await second.close()
  }
})

test('Studio shows both themes and edits a real take with one set of track controls @smoke', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openStudio(page, true)
  const studio = page.getByRole('region', { name: 'Studio', exact: true })
  await studio
    .getByRole('button', { name: 'Create project', exact: true })
    .click()
  await expect(
    studio.getByRole('button', { name: 'Close Add takes' }),
  ).toBeVisible()
  await studio.locator('input[type=file][accept^="audio/"]').setInputFiles({
    name: 'Vocal.wav',
    mimeType: 'audio/wav',
    buffer: audioFixture(),
  })
  await expect(
    studio.getByRole('button', { name: 'Vocal details', exact: true }),
  ).toBeVisible()
  await expect(
    studio.getByText('Saved in this browser', { exact: true }),
  ).toBeVisible()
  await expect(studio.locator('canvas')).toBeVisible()
  const mute = studio.getByRole('button', { name: 'Mute Vocal', exact: true })
  await expect(mute).toHaveCount(1)
  const originalIcon = await mute.locator('svg').innerHTML()
  await mute.click()
  const unmute = studio.getByRole('button', {
    name: 'Unmute Vocal',
    exact: true,
  })
  await expect(unmute).toHaveAttribute('aria-pressed', 'true')
  expect(await unmute.locator('svg').innerHTML()).not.toBe(originalIcon)
  await studio.getByRole('button', { name: /^Undo / }).click()
  await expect(mute).toHaveAttribute('aria-pressed', 'false')
  await studio.getByRole('button', { name: 'Solo Vocal', exact: true }).click()
  await expect(
    studio.getByRole('button', { name: 'Solo Vocal', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  const pan = studio.getByRole('slider', { name: 'Vocal pan', exact: true })
  await pan.focus()
  await pan.press('ArrowRight')
  await expect(pan).toHaveValue('0.01')
  const ruler = studio.getByRole('radiogroup', { name: 'Timeline ruler' })
  await ruler.getByRole('radio', { name: 'Beats', exact: true }).click()
  await expect(
    ruler.getByRole('radio', { name: 'Beats', exact: true }),
  ).toBeChecked()
  await expect(
    studio.getByRole('spinbutton', { name: 'Tempo in beats per minute' }),
  ).toBeVisible()
  await ruler.getByRole('radio', { name: 'Time', exact: true }).click()
  await expect(
    ruler.getByRole('radio', { name: 'Time', exact: true }),
  ).toBeChecked()
  const playhead = studio.getByRole('spinbutton', {
    name: 'Playhead in seconds',
  })
  await playhead.fill('0.5')
  await playhead.press('Tab')
  await studio.getByRole('button', { name: /^Vocal, Vocal.wav,/ }).click()
  await studio.getByRole('button', { name: 'Split', exact: true }).click()
  await expect(
    studio.getByRole('button', { name: /^Vocal, Vocal.wav,/ }),
  ).toHaveCount(2)
  await studio.getByRole('button', { name: /^Undo / }).click()
  await expect(
    studio.getByRole('button', { name: /^Vocal, Vocal.wav,/ }),
  ).toHaveCount(1)
  await studio.getByRole('button', { name: 'Details', exact: true }).click()
  await studio.getByRole('spinbutton', { name: /^Start(?: s)?$/ }).fill('2')
  await studio.getByRole('spinbutton', { name: /^Start(?: s)?$/ }).press('Tab')
  await expect(
    studio.getByRole('button', { name: /^Vocal, Vocal.wav,/ }),
  ).toHaveAttribute('aria-label', /0:02/)
  await studio.getByRole('button', { name: 'Close Clip details' }).click()
  for (const theme of ['dark', 'light']) {
    await page.evaluate(
      (value) => document.documentElement.setAttribute('data-theme', value),
      theme,
    )
    // The Studio paints with the app's own theme tokens.
    await expect(studio).toHaveCSS(
      'background-color',
      theme === 'dark' ? 'rgb(13, 17, 23)' : 'rgb(243, 244, 246)',
    )
    await page.screenshot({
      path: testInfo.outputPath(`studio-${theme}.png`),
      fullPage: true,
    })
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  )
  expect(overflow).toBe(false)
  expect(errors).toEqual([])
})

test('Studio keeps tablet controls and phone mixing reachable with touch @smoke', async ({
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(120_000)
  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({
      baseURL,
      ignoreHTTPSErrors: true,
      viewport,
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 1,
    })
    try {
      const page = await context.newPage()
      await openStudio(page, true)
      const studio = page.getByRole('region', { name: 'Studio', exact: true })
      await studio
        .getByRole('button', { name: 'Create project', exact: true })
        .tap()
      await studio.locator('input[type=file][accept^="audio/"]').setInputFiles({
        name: 'Keys.wav',
        mimeType: 'audio/wav',
        buffer: audioFixture(),
      })
      await expect(
        studio.getByRole('button', { name: 'Keys details', exact: true }),
      ).toBeVisible()
      if (viewport.width < 600) {
        await expect(
          studio.getByRole('button', { name: 'Mute Keys' }),
        ).toHaveCount(0)
        await studio.getByRole('button', { name: 'Mix', exact: true }).tap()
      }
      const mute = studio.getByRole('button', {
        name: 'Mute Keys',
        exact: true,
      })
      const bounds = await mute.boundingBox()
      expect(bounds?.width).toBeGreaterThanOrEqual(44)
      expect(bounds?.height).toBeGreaterThanOrEqual(44)
      await mute.tap()
      await expect(
        studio.getByRole('button', { name: 'Unmute Keys' }),
      ).toHaveAttribute('aria-pressed', 'true')
      await studio.getByRole('button', { name: 'Solo Keys', exact: true }).tap()
      await expect(
        studio.getByRole('button', { name: 'Solo Keys' }),
      ).toHaveAttribute('aria-pressed', 'true')
      await expect(
        studio.getByRole('slider', { name: 'Keys volume', exact: true }),
      ).toHaveCount(1)
      if (viewport.width < 600)
        await studio
          .getByRole('button', { name: 'Close Mix', exact: true })
          .tap()
      await studio.getByRole('button', { name: 'Add takes', exact: true }).tap()
      const dialog = studio.getByRole('dialog', {
        name: 'Add takes',
        exact: true,
      })
      await expect(dialog).toBeVisible()
      await expect(
        studio.getByRole('button', { name: 'Choose file' }),
      ).toBeVisible()
      await studio
        .getByRole('button', { name: 'Close Add takes', exact: true })
        .tap()
      await expect(dialog).toHaveCount(0)
      await expect(
        studio.getByRole('button', { name: 'Play song' }),
      ).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false)
      await page.screenshot({
        path: testInfo.outputPath(`studio-touch-${viewport.width}.png`),
        fullPage: true,
      })
    } finally {
      await context.close()
    }
  }
})

test('Studio plays four owned audio lanes and stops after reopening @smoke', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000)
  await openStudio(page, true)
  const studio = page.getByRole('region', { name: 'Studio', exact: true })
  await studio
    .getByRole('button', { name: 'Create project', exact: true })
    .click()
  await studio.getByRole('button', { name: 'Close Add takes' }).click()
  await studio.getByRole('button', { name: 'Song options' }).click()
  await studio
    .getByRole('textbox', { name: 'Project name' })
    .fill('Window seat')
  await studio.getByRole('textbox', { name: 'Project name' }).press('Tab')
  await studio.getByRole('button', { name: 'Close Song', exact: true }).click()
  for (const [name, frequency] of [
    ['Voice', 220],
    ['Guitar', 330],
    ['Piano', 440],
    ['Drums', 110],
  ] as const) {
    await studio.locator('input[type=file][accept^="audio/"]').setInputFiles({
      name: `${name}.wav`,
      mimeType: 'audio/wav',
      buffer: audioFixture(8, frequency),
    })
    await expect(
      studio.getByRole('button', { name: `${name} details`, exact: true }),
    ).toBeVisible()
    await expect(
      studio.getByText('Saved in this browser', { exact: true }),
    ).toBeVisible()
  }
  for (const theme of ['dark', 'light']) {
    await page.evaluate(
      (value) => document.documentElement.setAttribute('data-theme', value),
      theme,
    )
    await expect(
      studio.getByRole('radiogroup', { name: 'Timeline ruler' }),
    ).toHaveCSS(
      'background-color',
      theme === 'dark' ? 'rgb(33, 38, 45)' : 'rgb(221, 225, 230)',
    )
    await page.screenshot({
      path: testInfo.outputPath(`studio-song-${theme}.png`),
      fullPage: true,
    })
  }
  await studio.getByRole('button', { name: 'Play song', exact: true }).click()
  await expect(
    studio.getByRole('button', { name: 'Pause song', exact: true }),
  ).toBeVisible()
  await expect
    .poll(async () =>
      Number(
        await studio
          .getByRole('meter', { name: 'Output sample peak' })
          .getAttribute('aria-valuenow'),
      ),
    )
    .toBeGreaterThan(-60)
  await studio.getByRole('button', { name: 'Pause song', exact: true }).click()
  const position = studio.getByLabel('Song position')
  const paused = await position.textContent()
  await expect(
    studio.getByRole('button', { name: 'Play song', exact: true }),
  ).toBeEnabled()
  await expect(
    studio.getByRole('meter', { name: 'Output sample peak' }),
  ).toHaveAttribute('aria-valuenow', '-60')
  await expect(position).toHaveText(paused!)
  await page.reload()
  await studio.getByRole('button', { name: /Window seat/ }).click()
  await expect(
    studio.getByRole('button', { name: 'Play song', exact: true }),
  ).toBeVisible()
  await expect(
    studio.getByRole('button', { name: 'Pause song', exact: true }),
  ).toHaveCount(0)
  await expect(
    studio.getByRole('meter', { name: 'Output sample peak' }),
  ).toHaveAttribute('aria-valuenow', '-60')
})

// Studio local projects — real file imports, durable reloads and portable backup ownership.
import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { dismissOverlays, openNavTab } from './helpers/ui'

function audioFixture(): Buffer {
  const frames = 48_000
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
      Math.round(Math.sin((i * Math.PI * 440) / 48_000) * 8_000),
      44 + i * 2,
    )
  return bytes
}

async function openStudio(page: Page, direct = false): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
  })
  await page.goto(direct ? '/studio-night' : '/')
  await page.waitForSelector('#app-tabs', { timeout: 30_000 })
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
    studio.getByRole('list', { name: 'Project tracks' }),
  ).toContainText('Guitar idea')
  await expect(
    studio.getByText('Saved in this browser', { exact: true }),
  ).toBeVisible()
  await studio.getByRole('button', { name: 'Add take', exact: true }).click()
  await expect(studio.getByRole('region', { name: 'Kept takes' })).toBeVisible()
  await expect(
    studio.getByRole('region', { name: 'Kept takes' }),
  ).toContainText('Your kept recordings appear here')
  await page.reload()
  await expect(
    studio.getByRole('button', { name: /First Studio song/ }),
  ).toBeEnabled()
  await studio.getByRole('button', { name: /First Studio song/ }).click()
  // Unload cannot guarantee an async lease release. A fresh document must
  // explicitly take over the remaining lease instead of silently stealing it.
  const resumeEditing = studio.getByRole('button', { name: 'Edit in this tab' })
  await expect(
    studio.getByRole('textbox', { name: 'Project name' }),
  ).toHaveValue('First Studio song')
  if (await resumeEditing.isVisible()) await resumeEditing.click()
  await expect(
    studio.getByRole('list', { name: 'Project tracks' }),
  ).toContainText('Guitar idea')
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
      restored.getByText('No projects yet.', { exact: true }),
    ).toBeVisible()
    await restored
      .locator('input[type=file][accept=".mpstudio"]')
      .setInputFiles({
        name: download.suggestedFilename(),
        mimeType: 'application/zip',
        buffer: backup,
      })
    await expect(
      restored.getByRole('textbox', { name: 'Project name' }),
    ).toHaveValue('First Studio song')
    await expect(
      restored.getByRole('list', { name: 'Project tracks' }),
    ).toContainText('Guitar idea')
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
    await expect(
      other.getByRole('textbox', { name: 'Project name' }),
    ).toBeDisabled()
    await expect(other.getByText('Read only', { exact: true })).toBeVisible()
    await other.getByRole('button', { name: 'Edit in this tab' }).click()
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

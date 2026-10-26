// Studio finishing proof — real native rendering, explicit downloads and revision-safe sound controls.
import { expect, test, type Download } from '@playwright/test'
import { importStudioAudio, openArrangement, readStudioProject, studioRegion, } from './helpers/dedicatedstudio-fixture'

async function downloadedBytes(download: Download): Promise<Buffer> {
  const stream = await download.createReadStream()
  if (!stream) throw new Error('The browser did not provide the WAV download.')
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

test('Studio adjusts sound as one edit and exports measured stereo PCM from the current revision @smoke', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openArrangement(page)
  await importStudioAudio(page, 'Harmony')
  const studio = studioRegion(page)
  await studio.getByRole('button', { name: 'Sound', exact: true }).click()
  const before = await readStudioProject(page)
  const tone = studio.getByRole('slider', { name: 'Tone', exact: true })
  // The Sound panel scrolls at shorter desktop heights; raw mouse coordinates do not.
  await tone.scrollIntoViewIfNeeded()
  await expect(tone).toBeInViewport({ ratio: 1 })
  await tone.click({ trial: true })
  const box = await tone.boundingBox()
  if (!box) throw new Error('Tone control is not visible.')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2, {
    steps: 8,
  })
  expect((await readStudioProject(page)).revision).toBe(before.revision)
  await page.mouse.up()
  await expect
    .poll(async () => (await readStudioProject(page)).revision)
    .toBe(before.revision + 1)
  expect((await readStudioProject(page)).mix.macros.tone).toBeGreaterThan(20)
  await studio.getByRole('button', { name: 'Close Sound', exact: true }).click()
  await studio.getByRole('button', { name: /^Undo / }).click()
  await expect
    .poll(async () => (await readStudioProject(page)).mix.macros.tone)
    .toBe(before.mix.macros.tone)

  await studio.getByRole('button', { name: 'Export', exact: true }).click()
  let automaticDownloads = 0
  page.on('download', () => automaticDownloads++)
  await studio.getByRole('button', { name: 'Export WAV', exact: true }).click()
  const downloadButton = studio.getByRole('button', {
    name: 'Download WAV',
    exact: true,
  })
  await expect(downloadButton).toBeVisible({ timeout: 90_000 })
  expect(automaticDownloads).toBe(0)
  for (const theme of ['dark', 'light']) {
    await page.evaluate(
      (value) => document.documentElement.setAttribute('data-theme', value),
      theme,
    )
    await page.screenshot({
      path: test.info().outputPath(`studio-export-${theme}.png`),
      fullPage: true,
    })
  }
  await expect(studio.getByLabel('Measured WAV output')).toContainText('LUFS')
  await expect(studio.getByLabel('Measured WAV output')).not.toContainText('−∞')
  const downloaded = page.waitForEvent('download')
  await downloadButton.click()
  const download = await downloaded
  expect(download.suggestedFilename()).toMatch(/\.wav$/)
  const bytes = await downloadedBytes(download)
  await test.info().attach('studio-render.wav', {
    body: bytes,
    contentType: 'audio/wav',
  })
  expect(bytes.toString('ascii', 0, 4)).toBe('RIFF')
  expect(bytes.toString('ascii', 8, 12)).toBe('WAVE')
  expect(bytes.readUInt16LE(20)).toBe(1)
  expect(bytes.readUInt16LE(22)).toBe(2)
  expect(bytes.readUInt32LE(24)).toBe(48_000)
  expect(bytes.readUInt16LE(34)).toBe(16)
  expect(bytes.readUInt32LE(40)).toBe(bytes.length - 44)
  expect((bytes.length - 44) / 4 / 48_000).toBeGreaterThanOrEqual(4)
  let peak = 0
  let energy = 0
  for (let offset = 44; offset < bytes.length; offset += 2) {
    const sample = bytes.readInt16LE(offset) / 32_768
    peak = Math.max(peak, Math.abs(sample))
    energy += sample * sample
  }
  expect(energy).toBeGreaterThan(1)
  expect(20 * Math.log10(peak)).toBeLessThan(-1.4)
  await expect(studio.getByLabel('Measured WAV output')).toContainText(
    (20 * Math.log10(peak)).toFixed(1),
  )

  await studio
    .getByRole('button', { name: 'Close Export', exact: true })
    .click()
  await studio
    .getByRole('button', { name: 'Song options', exact: true })
    .click()
  await studio
    .getByRole('textbox', { name: 'Project name', exact: true })
    .fill('Finished demo')
  await studio
    .getByRole('textbox', { name: 'Project name', exact: true })
    .press('Tab')
  await studio.getByRole('button', { name: 'Close Song', exact: true }).click()
  await studio.getByRole('button', { name: 'Export', exact: true }).click()
  await expect(downloadButton).toHaveCount(0)
  await expect(
    studio.getByRole('button', { name: 'Export WAV', exact: true }),
  ).toBeEnabled()
  await expect(
    studio.getByText('Measured when you export.', { exact: true }),
  ).toBeVisible()
})

test('Studio cancels an export without a late download or a lost arrangement @smoke', async ({
  page,
}) => {
  await openArrangement(page)
  const studio = studioRegion(page)
  const before = await readStudioProject(page)
  let downloads = 0
  page.on('download', () => downloads++)
  await studio.getByRole('button', { name: 'Export', exact: true }).click()
  await studio.getByRole('button', { name: 'Export WAV', exact: true }).click()
  await studio
    .getByRole('button', { name: 'Cancel export', exact: true })
    .click()
  await expect(
    studio.getByRole('button', { name: 'Export WAV', exact: true }),
  ).toBeEnabled({ timeout: 60_000 })
  await expect(
    studio.getByRole('button', { name: 'Download WAV', exact: true }),
  ).toHaveCount(0)
  expect(downloads).toBe(0)
  expect((await readStudioProject(page)).clips).toEqual(before.clips)
  await studio
    .getByRole('button', { name: 'Close Export', exact: true })
    .click()
  await expect(
    studio.getByRole('button', { name: 'Play song', exact: true }),
  ).toBeEnabled()
})

test('Studio keeps Sound and Export reachable on tablet and phone @smoke', async ({
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
    })
    context.setDefaultTimeout(15_000)
    try {
      const page = await context.newPage()
      await openArrangement(page)
      const studio = studioRegion(page)
      await studio.getByRole('button', { name: 'Sound', exact: true }).tap()
      const panel = studio.getByRole('dialog', { name: 'Sound', exact: true })
      await expect(panel).toHaveAttribute('aria-modal', 'true')
      const tone = panel.getByRole('slider', { name: 'Tone', exact: true })
      await tone.scrollIntoViewIfNeeded()
      await expect(tone).toBeEnabled()
      await tone.focus()
      await tone.press('ArrowRight')
      await expect
        .poll(async () => (await readStudioProject(page)).mix.macros.tone)
        .toBe(1)
      for (const theme of ['dark', 'light']) {
        await page.evaluate(
          (value) => document.documentElement.setAttribute('data-theme', value),
          theme,
        )
        await page.screenshot({
          path: testInfo.outputPath(
            `studio-sound-${viewport.width}-${theme}.png`,
          ),
          fullPage: true,
        })
      }
      await panel
        .getByRole('button', { name: 'Close Sound', exact: true })
        .tap()
      await studio.getByRole('button', { name: 'Export', exact: true }).tap()
      const exportPanel = studio.getByRole('dialog', {
        name: 'Export',
        exact: true,
      })
      await exportPanel
        .getByRole('button', { name: 'Export WAV', exact: true })
        .tap()
      const download = exportPanel.getByRole('button', {
        name: 'Download WAV',
        exact: true,
      })
      await expect(download).toBeEnabled({ timeout: 60_000 })
      await download.scrollIntoViewIfNeeded()
      const box = await download.boundingBox()
      expect(box?.height).toBeGreaterThanOrEqual(44)
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
      const received = page.waitForEvent('download')
      await download.tap()
      expect((await received).suggestedFilename()).toMatch(/\.wav$/)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false)
      await page.screenshot({
        path: testInfo.outputPath(`studio-export-${viewport.width}.png`),
        fullPage: true,
      })
      await exportPanel
        .getByRole('button', { name: 'Close Export', exact: true })
        .tap()
      await expect(
        studio.getByRole('button', { name: 'Export', exact: true }),
      ).toBeFocused()
    } finally {
      await context.close()
    }
  }
})

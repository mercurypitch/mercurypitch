// Lead adoption and passive monitoring diagnostics preserve the two Guitar Night hosts.
// ============================================================

import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { audioActivity, guardPassiveAudio, openSongAmp, reloadSongAmp, STORAGE_V1, STORAGE_V2, storedAmp, } from './helpers/guitar-night-amp'
import { seedAuthoredGuitarScore } from './helpers/guitar-night-score'
import { enterSong } from './helpers/guitar-night-song'

async function expectStudioLead(amp: Locator): Promise<void> {
  await expect(
    amp.getByText('Studio · Lead head', { exact: true }),
  ).toBeVisible()
  await expect(
    amp.getByText('Cabinet IR · Jester Cookie Monster', { exact: true }),
  ).toBeVisible()
  await expect(
    amp.getByRole('slider', { name: 'Guitar amp character', exact: true }),
  ).toBeHidden()
}

test('choosing Lead adopts the Studio head across reload without starting audio @smoke', async ({
  page,
}) => {
  const cabinetRequests = await guardPassiveAudio(page)
  await enterSong(page, 2)
  const baseline = await audioActivity(page)
  const amp = await openSongAmp(page)

  await amp
    .getByRole('combobox', { name: 'Guitar amp preset', exact: true })
    .selectOption('lead')

  await expectStudioLead(amp)
  await expect
    .poll(() => storedAmp(page))
    .toMatchObject({
      version: 2,
      presetId: 'lead',
      engine: 'studio',
      head: 'lead',
    })
  expect(await audioActivity(page)).toEqual(baseline)
  expect(cabinetRequests).toEqual([])

  const restored = await reloadSongAmp(page)
  await expectStudioLead(restored)
  await expect(
    restored.getByRole('combobox', { name: 'Guitar amp preset', exact: true }),
  ).toHaveValue('lead')
  expect(await audioActivity(page)).toMatchObject({
    sourceStarts: 0,
    mediaPlays: 0,
    microphoneRequests: 0,
  })
  expect(cabinetRequests).toEqual([])
})

for (const version of [1, 2] as const) {
  test(`keeps V${version} Lite Lead sound as Custom until explicitly choosing Studio Lead @smoke`, async ({
    page,
  }) => {
    const legacy = {
      version,
      presetId: 'lead',
      enabled: true,
      drive: 0.84,
      bass: -0.1,
      mid: 0.38,
      treble: -0.22,
      presence: 0.08,
      output: 0.25,
      cabinet: 'dark',
      asymmetry: 0.46,
      ...(version === 2
        ? { engine: 'lite', head: 'definition', character: 1 }
        : {}),
    }
    const storageKey = version === 1 ? STORAGE_V1 : STORAGE_V2
    const cabinetRequests = await guardPassiveAudio(page)
    await page.addInitScript(
      ({ key, settings }) => {
        if (localStorage.getItem(key) === null)
          localStorage.setItem(key, JSON.stringify(settings))
      },
      { key: storageKey, settings: legacy },
    )
    await enterSong(page, 2)
    const baseline = await audioActivity(page)
    const amp = await openSongAmp(page)
    const preset = amp.getByRole('combobox', {
      name: 'Guitar amp preset',
      exact: true,
    })

    await expect(preset).toHaveValue('custom')
    await expect(
      amp.getByText('Lite amp · Filtered cabinet', { exact: true }),
    ).toBeVisible()
    await expect(
      amp.getByRole('slider', { name: 'Guitar amp drive', exact: true }),
    ).toHaveValue('0.84')
    await expect(
      amp.getByRole('slider', { name: 'Guitar amp character', exact: true }),
    ).toBeHidden()
    expect(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
        storageKey,
      ),
    ).toEqual(legacy)

    // Persist through a real user action: every untouched sound parameter,
    // including hidden asymmetry, must survive the migration unchanged.
    await amp
      .getByRole('button', { name: 'Bypass guitar amp', exact: true })
      .click()
    await expect
      .poll(() => storedAmp(page))
      .toEqual({
        ...legacy,
        version: 2,
        presetId: 'custom',
        enabled: false,
        engine: 'lite',
        head: 'definition',
        character: 1,
      })
    await preset.selectOption('lead')
    await expectStudioLead(amp)
    await expect
      .poll(() => storedAmp(page))
      .toMatchObject({
        presetId: 'lead',
        enabled: false,
        engine: 'studio',
        head: 'lead',
      })
    expect(await audioActivity(page)).toEqual(baseline)
    expect(cabinetRequests).toEqual([])
  })
}

async function openHostSession(
  page: Page,
  host: 'song' | 'score',
  includeBacking = false,
): Promise<Locator> {
  if (host === 'song') {
    await enterSong(page, 2)
    await openSongAmp(page)
    return page.getByRole('dialog', { name: 'Session', exact: true })
  }

  const songId = `lead-monitor-${test.info().testId}`
  await seedAuthoredGuitarScore(page, songId, includeBacking, {
    electric: true,
  })
  await page.goto(`/guitar-night?song=${encodeURIComponent(songId)}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page
    .getByRole('button', { name: 'Practice with tab', exact: true })
    .click()
  // Two transport hosts share the document; this identifies the score owner.
  const room = page.getByTestId('guitar-night-score-room')
  await room.getByLabel('Session controls', { exact: true }).click()
  return room.locator('details[open]').filter({
    has: page.getByRole('region', { name: 'Guitar amp', exact: true }),
  })
}

for (const width of [1440, 390]) {
  test(`score quick mix mirrors backing state without opening input at ${width}px @smoke`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const cabinetRequests = await guardPassiveAudio(page)
    const panel = await openHostSession(page, 'score', true)
    const baseline = await audioActivity(page)
    await panel
      .getByRole('button', { name: 'Direct input', exact: true })
      .click()
    const room = page.getByTestId('guitar-night-score-room')
    await room.getByLabel('Session controls', { exact: true }).click()
    const cycle = room.getByTestId('guitar-night-listening-cycle')
    const dockMix = room.getByRole('group', {
      name: 'Listening playback mix',
      exact: true,
    })
    await expect(
      dockMix.getByRole('button', {
        name: 'Turn on your monitoring',
        exact: true,
      }),
    ).toBeDisabled()
    await expect(
      dockMix.getByRole('button', { name: 'Hear target guide', exact: true }),
    ).toBeVisible()
    const dockPath = test.info().outputPath(`score-mix-dock-${width}.png`)
    await page.screenshot({ path: dockPath })
    await test
      .info()
      .attach('Score mix dock', { path: dockPath, contentType: 'image/png' })
    await cycle.click({ button: 'right' })
    await expect(cycle).toHaveAttribute('aria-expanded', 'true')
    // The shared picker is portalled above both room layouts and the recorder.
    const quick = page
      .getByRole('dialog', { name: 'Listening controls', exact: true })
      .getByRole('group', {
        name: 'Direct input quick controls',
        exact: true,
      })
    await expect(
      quick.getByRole('button', { name: 'Turn on Listening', exact: true }),
    ).toBeEnabled()
    await expect(
      quick.getByRole('button', {
        name: 'Turn on your monitoring',
        exact: true,
      }),
    ).toBeDisabled()
    await quick
      .getByRole('button', { name: 'Mute backing', exact: true })
      .click()
    await expect(
      quick.getByRole('button', { name: 'Unmute backing', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false')
    // The shared picker clamps its position on the next animation frame.
    await expect(async () => {
      const box = await quick.boundingBox()
      if (box === null) throw new Error('Score quick mix has no layout')
      expect(box.x).toBeGreaterThanOrEqual(7)
      expect(box.x + box.width).toBeLessThanOrEqual(width - 7)
    }).toPass({ timeout: 1500 })
    const path = test.info().outputPath(`score-quick-mix-${width}.png`)
    await page.screenshot({ path })
    await test
      .info()
      .attach('Score quick mix', { path, contentType: 'image/png' })
    await page.keyboard.press('Escape')
    const backing = room.getByRole('button', {
      name: 'Hear backing parts',
      exact: true,
    })
    await expect(backing).toHaveAttribute('aria-pressed', 'false')
    await backing.click()
    await cycle.click({ button: 'right' })
    await expect(
      quick.getByRole('button', { name: 'Mute backing', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(await audioActivity(page)).toEqual(baseline)
    expect(cabinetRequests).toEqual([])
  })
}

for (const host of ['song', 'score'] as const) {
  for (const width of [1440, 390]) {
    test(`${host} monitoring details stay unmeasured and inert at ${width}px @smoke`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      const cabinetRequests = await guardPassiveAudio(page)
      const panel = await openHostSession(page, host)
      const baseline = await audioActivity(page)
      const summary = panel
        .locator('summary')
        .filter({ hasText: 'Monitoring latency' })
      const details = summary.locator('..')

      await expect(summary).toContainText('Monitoring off')
      await summary.click()

      await expect(
        details.getByText('Round trip not measured', { exact: true }),
      ).toBeVisible()
      await expect(
        details.getByRole('button', { name: 'Download report', exact: true }),
      ).toBeDisabled()
      await expect(
        details.getByText(/browser and system audio buffer settings/),
      ).toBeVisible()
      await expect(details.getByText(/clicks or dropouts/)).toBeVisible()
      expect(await audioActivity(page)).toEqual(baseline)
      expect(baseline).toMatchObject({
        sourceStarts: 0,
        mediaPlays: 0,
        microphoneRequests: 0,
      })
      expect(cabinetRequests).toEqual([])
      const fit = await details.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        return {
          left: bounds.left,
          right: bounds.right,
          viewport: document.documentElement.clientWidth,
          overflow: element.scrollWidth - element.clientWidth,
          pageOverflow:
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        }
      })
      expect(fit.left).toBeGreaterThanOrEqual(-1)
      expect(fit.right).toBeLessThanOrEqual(fit.viewport + 1)
      expect(fit.overflow).toBeLessThanOrEqual(1)
      expect(fit.pageOverflow).toBeLessThanOrEqual(1)
      await details.scrollIntoViewIfNeeded()
      const name = `${host}-monitor-${width}.png`
      const path = test.info().outputPath(name)
      await page.screenshot({ path })
      await test.info().attach(name, {
        path,
        contentType: 'image/png',
      })
    })
  }
}

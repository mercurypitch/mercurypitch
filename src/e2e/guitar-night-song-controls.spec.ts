// Guitar song controls retain compact channel rows and uninterrupted pointer gestures.
// ============================================================

import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { enterSong, SONG_TITLE } from './helpers/guitar-night-song'

const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }

function mixerTrigger(page: Page): Locator {
  return page.getByRole('button', {
    name: `Open track mixer for ${SONG_TITLE}`,
    exact: true,
  })
}

async function openMixer(page: Page): Promise<Locator> {
  await mixerTrigger(page).click()
  const panel = page.getByRole('dialog', {
    name: `Track mixer for ${SONG_TITLE}`,
    exact: true,
  })
  await expect(panel).toBeVisible()
  return panel
}

async function expectInsideViewport(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible()
  const geometry = await locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return {
      left: bounds.left,
      top: bounds.top,
      right: bounds.right,
      bottom: bounds.bottom,
      width: innerWidth,
      height: innerHeight,
    }
  })
  expect(geometry.left).toBeGreaterThanOrEqual(-1)
  expect(geometry.top).toBeGreaterThanOrEqual(-1)
  expect(geometry.right).toBeLessThanOrEqual(geometry.width + 1)
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.height + 1)
}

test('keeps song A/B reachable without opening Session @smoke', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  await enterSong(page, 2)

  const deck = page.getByTestId('guitar-night-deck')
  await expectInsideViewport(
    deck.getByRole('button', {
      name: 'A — start the loop at the playhead',
      exact: true,
    }),
  )
  await expectInsideViewport(
    deck.getByRole('button', {
      name: 'B — end the loop at the playhead',
      exact: true,
    }),
  )
})

for (const count of [2, 6] as const) {
  for (const viewport of [DESKTOP, PHONE]) {
    test(`keeps ${count} stem rows compact at ${viewport.width}px @smoke`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await enterSong(page, count)

      // The legacy selector lets the pre-fix run measure the reported stretch,
      // rather than failing merely because the new mixer does not exist yet.
      const legacy = page.getByLabel(
        `Band, loop, and input controls, ${count} tracks`,
        { exact: true },
      )
      await mixerTrigger(page).or(legacy).click()
      const rows = page.locator(
        '[data-testid="guitar-night-mixer-channel"], [data-testid="guitar-night-band-panel"] [class*="channelStrip"] > button',
      )
      await expect(rows).toHaveCount(count)
      const sizes = await rows.evaluateAll((elements) =>
        elements.map((element) => ({
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height,
          overflow: element.scrollWidth - element.clientWidth,
        })),
      )
      for (const size of sizes) {
        expect(size.height).toBeLessThanOrEqual(104)
        expect(size.width).toBeGreaterThanOrEqual(220)
        expect(size.overflow).toBeLessThanOrEqual(1)
      }
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      ).toBeLessThanOrEqual(1)
      await page.screenshot({
        path: test.info().outputPath(`mixer-${count}-${viewport.width}.png`),
      })
    })
  }
}

test('keeps a stem fader connected through a real held drag @smoke', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  await enterSong(page, 2)
  const panel = await openMixer(page)
  const level = panel.getByRole('slider', { name: 'Vocals level', exact: true })
  const original = await level.elementHandle()
  if (original === null) throw new Error('Vocals fader is absent')
  const bounds = await level.boundingBox()
  if (bounds === null) throw new Error('Vocals fader has no pointer bounds')
  const current = Number(await level.inputValue())
  const min = Number(await level.getAttribute('min'))
  const max = Number(await level.getAttribute('max'))
  const currentFraction = (current - min) / (max - min)
  const y = bounds.y + bounds.height / 2

  await page.mouse.move(bounds.x + 8 + currentFraction * (bounds.width - 16), y)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width * 0.25, y, { steps: 6 })
  await expect
    .poll(async () => Number(await level.inputValue()))
    .toBeLessThan(current)
  expect(await original.evaluate((element) => element.isConnected)).toBe(true)
  await page.mouse.move(bounds.x + bounds.width * 0.6, y, { steps: 6 })
  await page.mouse.up()

  expect(await original.evaluate((element) => element.isConnected)).toBe(true)
  await expect
    .poll(async () => Number(await level.inputValue()))
    .toBeGreaterThan(min + (max - min) * 0.45)
  const chosen = await level.inputValue()
  await panel.getByRole('button', { name: 'Mute Vocals', exact: true }).click()
  await expect(level).toHaveValue(chosen)
  await panel.getByRole('button', { name: 'Solo Backing', exact: true }).click()
  await expect(level).toHaveValue(chosen)
  await expect(
    panel.getByRole('button', { name: 'Unmute Vocals', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
})

test('edits song loop boundaries with real pointer and keyboard @smoke', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  await enterSong(page, 2)
  const deck = page.getByTestId('guitar-night-deck')
  const position = deck.getByRole('slider', {
    name: 'Song position',
    exact: true,
  })
  await deck
    .getByRole('button', {
      name: 'A — start the loop at the playhead',
      exact: true,
    })
    .click()
  await position.focus()
  await page.keyboard.press('End')
  await deck
    .getByRole('button', {
      name: 'B — end the loop at the playhead',
      exact: true,
    })
    .click()
  const marker = page.getByTestId('guitar-night-song-loop-marker-b')
  await expect(marker).toBeVisible()
  const initial = Number(await marker.getAttribute('aria-valuenow'))
  const bounds = await marker.boundingBox()
  if (bounds === null) throw new Error('B marker has no pointer bounds')

  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(bounds.x - 120, bounds.y + bounds.height / 2, {
    steps: 8,
  })
  await page.mouse.up()
  await expect
    .poll(async () => Number(await marker.getAttribute('aria-valuenow')))
    .toBeLessThan(initial)
  const afterPointer = Number(await marker.getAttribute('aria-valuenow'))
  await marker.focus()
  await page.keyboard.press('ArrowLeft')
  await expect
    .poll(async () => Number(await marker.getAttribute('aria-valuenow')))
    .toBeLessThan(afterPointer)
})

test('returns mixer focus on Escape without starting playback @smoke', async ({
  page,
}) => {
  await page.setViewportSize(PHONE)
  await enterSong(page, 6)
  const trigger = mixerTrigger(page)
  const panel = await openMixer(page)
  const level = panel.getByRole('slider', { name: 'Vocals level', exact: true })
  await level.focus()

  await page.keyboard.press('Escape')

  await expect(panel).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect(
    page.getByRole('button', { name: 'Play backing', exact: true }),
  ).toBeVisible()
  await expectInsideViewport(page.getByTestId('guitar-night-deck'))
})

test('keeps expanded Session settings inside phone and desktop dialogs @smoke', async ({
  page,
}) => {
  await page.setViewportSize(PHONE)
  await enterSong(page, 2)
  const trigger = page.getByRole('button', {
    name: 'Session controls',
    exact: true,
  })
  await trigger.click()
  const session = page.getByRole('dialog', { name: 'Session', exact: true })
  await expectInsideViewport(session)
  const close = session.getByRole('button', {
    name: 'Close Session',
    exact: true,
  })
  const latencySummary = session.locator('summary').filter({
    hasText: 'Monitoring latency',
  })
  await close.focus()
  await page.keyboard.press('Shift+Tab')
  await expect(latencySummary).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(close).toBeFocused()
  await page.screenshot({ path: test.info().outputPath('session-phone.png') })

  await session.getByText('Shape tone & cabinet', { exact: true }).click()

  await expectInsideViewport(session)
  const preset = session.getByRole('combobox', {
    name: 'Guitar amp preset',
    exact: true,
  })
  const cabinet = session.getByRole('combobox', {
    name: 'Guitar cabinet voicing',
    exact: true,
  })
  await expect(preset).toHaveValue('tight')
  await expect(cabinet).toHaveCount(0)
  await expect(
    session.getByText('Cabinet IR · Jester Cookie Monster', { exact: true }),
  ).toBeVisible()
  for (const name of ['bass', 'mid', 'treble', 'presence', 'output']) {
    const control = session.getByRole('slider', {
      name: `Guitar amp ${name}`,
      exact: true,
    })
    await control.scrollIntoViewIfNeeded()
    await expectInsideViewport(control)
  }
  await expect(
    session.getByRole('slider', { name: 'Guitar amp output', exact: true }),
  ).toHaveAttribute('aria-valuetext', '0 dB')

  await preset.selectOption('edge')
  await expect(preset).toHaveValue('edge')
  await expect(
    session.getByText('Lite amp · Filtered cabinet', { exact: true }),
  ).toBeVisible()
  await cabinet.scrollIntoViewIfNeeded()
  await expectInsideViewport(cabinet)
  expect(
    await session.evaluate(
      (element) => element.scrollWidth - element.clientWidth,
    ),
  ).toBeLessThanOrEqual(1)
  await expect(session.getByTestId('guitar-night-mixer-channel')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(session).toHaveCount(0)
  await expect(trigger).toBeFocused()

  await page.setViewportSize(DESKTOP)
  await trigger.click()
  await expectInsideViewport(session)
  await page.screenshot({ path: test.info().outputPath('session-desktop.png') })
})

test('keeps every song dialog control reachable in short landscape @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await enterSong(page, 6)

  async function expectReachableControls(dialog: Locator): Promise<void> {
    await expectInsideViewport(dialog)
    const controls = dialog.locator('button, input, select, summary')
    expect(await controls.count()).toBeGreaterThan(0)
    const undersized: string[] = []
    for (const control of await controls.all()) {
      if (!(await control.isVisible())) continue
      await control.scrollIntoViewIfNeeded()
      await expectInsideViewport(control)
      const bounds = await control.boundingBox()
      const label =
        (await control.getAttribute('aria-label')) ??
        (await control.innerText())
      if ((bounds?.width ?? 0) < 44 || (bounds?.height ?? 0) < 44) {
        undersized.push(
          `${label}: ${bounds?.width ?? 0}×${bounds?.height ?? 0}`,
        )
      }
      if (await control.isEnabled()) await control.click({ trial: true })
    }
    expect(undersized, 'Every dialog control needs a 44px target').toEqual([])
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth - element.clientWidth,
      ),
    ).toBeLessThanOrEqual(1)
  }

  const mixer = await openMixer(page)
  await expectReachableControls(mixer)
  await page.screenshot({
    path: test.info().outputPath('mixer-landscape.png'),
  })
  await page.keyboard.press('Escape')
  await page
    .getByRole('button', { name: 'Session controls', exact: true })
    .click()
  const session = page.getByRole('dialog', { name: 'Session', exact: true })
  await session.getByText('Shape tone & cabinet', { exact: true }).click()
  await expectReachableControls(session)
  await page.screenshot({
    path: test.info().outputPath('session-landscape.png'),
  })
})

// Archive Hush integration — real microphone PCM, visible cover ownership and released manual controls.
import { expect, test } from '@playwright/test'
import { renderMuseumCheckpoint, restoreMuseumRaster, } from './helpers/museum-raster-checkpoints'
import { archivePlayer, expectArchiveMicrophoneOff, openArchiveHush, setArchiveVoice, walkArchiveTo, } from './helpers/glass-archive-hush'

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
test.setTimeout(90_000)
test.afterEach(async ({ page }, testInfo) => {
  try {
    if (!page.isClosed())
      await testInfo.attach('hush-runtime', {
        body: JSON.stringify(
          await page.evaluate(() => {
            const canvas = document.querySelector(
              '[data-testid="glass-adventure"] canvas',
            ) as HTMLCanvasElement | null
            const gl = canvas?.getContext('webgl2')
            const extension = gl?.getExtension('WEBGL_debug_renderer_info')
            return {
              renderer:
                gl && extension
                  ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)
                  : null,
              raster: window.museumRasterCheckpoints?.read(),
              capture: window.archiveHushPcm?.read(),
              draw: window.archiveHushDraw?.read(),
            }
          }),
          null,
          2,
        ),
        contentType: 'application/json',
      })
  } finally {
    try {
      if (!page.isClosed())
        await page.evaluate(() => window.archiveHushPcm?.dispose())
    } finally {
      await restoreMuseumRaster(page)
    }
  }
})

test('Hush earns two shields through real PCM and completes the covered chime with intact glass @smoke', async ({
  page,
}, testInfo) => {
  const errors = await openArchiveHush(page)
  const panel = page.getByTestId('archive-hush-panel')
  const rail = page.getByRole('slider', { name: 'Move glass cover' })
  await expect(panel).toContainText('A3')
  await expect
    .poll(() => page.evaluate(() => window.archiveHushDraw.read().labels))
    .toEqual(['A3', 'A3', 'A3'])
  // Real mouse and keyboard changes preserve left-to-right display ownership.
  const box = await rail.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await expect(panel).toHaveAttribute('data-cover', '1')
  await expect
    .poll(() => page.evaluate(() => window.archiveHushDraw.read().coverX))
    .toBeCloseTo(0, 1)
  await rail.press('End')
  await expect(panel).toHaveAttribute('data-cover', '2')
  await expect
    .poll(() => page.evaluate(() => window.archiveHushDraw.read().coverX))
    .toBeCloseTo(-1.35, 1)
  await renderMuseumCheckpoint(page)
  await page
    .getByRole('button', { name: 'Start listening', exact: true })
    .click()
  await expect(panel).toHaveAttribute('data-mode', 'listening', {
    timeout: 12_000,
  })
  await setArchiveVoice(page, 60, 0.1)
  // More than the one-second shield duration, through the real detector.
  await page.waitForTimeout(1800)
  await expect(panel).toHaveAttribute('data-shields', '0')
  await expect(
    page.getByRole('progressbar', { name: 'Hum shield' }),
  ).toHaveAttribute('aria-valuenow', '0')
  await setArchiveVoice(page, 57, 0.1)
  await expect(panel).toHaveAttribute('data-shields', '1', { timeout: 10_000 })
  await page.getByTestId('archive-aim-1').click()
  await expect(panel).toHaveAttribute('data-shields', '2', { timeout: 10_000 })
  await setArchiveVoice(page, 57, 0)
  await page
    .getByRole('button', { name: 'Ring the chime', exact: true })
    .click()
  await expect(panel).toHaveAttribute('data-phase', 'telegraph')
  await expect(rail).toBeDisabled()
  await expect(panel).toHaveAttribute('data-mode', 'complete', {
    timeout: 8000,
  })
  await expectArchiveMicrophoneOff(page)
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-completed',
    '3',
  )
  expect(
    await page.evaluate(() => window.archiveHushDraw.read().vessels),
  ).toEqual(
    Array.from({ length: 3 }, () => ({
      intact: true,
      shards: 0,
      shardsVisible: false,
    })),
  )
  await renderMuseumCheckpoint(page)
  await testInfo.attach('hush-complete', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  expect(errors).toEqual([])
})

test('native touch cover and movement stay independent while listening and release to rest @smoke', async ({
  page,
  context,
}) => {
  const errors = await openArchiveHush(page)
  const panel = page.getByTestId('archive-hush-panel')
  const rail = page.getByRole('slider', { name: 'Move glass cover' })
  const railBox = await rail.boundingBox()
  expect(railBox).not.toBeNull()
  expect(railBox!.height).toBeGreaterThanOrEqual(44)
  const cdp = await context.newCDPSession(page)
  let touchActive = false
  const origin = {
    id: 1,
    x: railBox!.x + railBox!.width - 10,
    y: railBox!.y + railBox!.height / 2,
  }
  try {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [origin],
    })
    touchActive = true
    for (const fraction of [0.75, 0.5, 0.25, 0])
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          { ...origin, x: railBox!.x + 10 + fraction * (railBox!.width - 20) },
        ],
      })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
    touchActive = false
    await expect(panel).toHaveAttribute('data-cover', '0')
    await expect(rail).toHaveAttribute('aria-valuetext', 'Laurel goblet')
    await expect
      .poll(() => page.evaluate(() => window.archiveHushDraw.read().coverX))
      .toBeCloseTo(1.35, 1)
    await renderMuseumCheckpoint(page)
    await page
      .getByRole('button', { name: 'Start listening', exact: true })
      .click()
    await expect(panel).toHaveAttribute('data-mode', 'listening', {
      timeout: 12_000,
    })
    const before = await archivePlayer(page)
    const stick = await page
      .getByRole('group', { name: 'Move Merc' })
      .boundingBox()
    expect(stick).not.toBeNull()
    const touch = {
      id: 2,
      x: stick!.x + stick!.width / 2,
      y: stick!.y + stick!.height / 2,
    }
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [touch],
    })
    touchActive = true
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ ...touch, x: touch.x + 28 }],
    })
    await expect
      .poll(async () => {
        const current = await archivePlayer(page)
        return Math.hypot(current.x - before.x, current.z - before.z)
      })
      .toBeGreaterThan(0.12)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
    touchActive = false
    await page.waitForTimeout(350)
    const released = await archivePlayer(page)
    await page.waitForTimeout(400)
    const resting = await archivePlayer(page)
    expect(resting.x).toBeCloseTo(released.x, 3)
    expect(resting.z).toBeCloseTo(released.z, 3)
    expect(resting.yaw).toBeCloseTo(released.yaw, 3)
    await expect(panel).toHaveAttribute('data-mode', 'listening')
    expect(await page.evaluate(() => window.archiveHushPcm.read().live)).toBe(1)
    await page
      .getByRole('button', { name: 'Stop listening', exact: true })
      .click()
    await expect(panel).toHaveAttribute('data-mode', 'paused')
    await expectArchiveMicrophoneOff(page)
    expect(errors).toEqual([])
  } finally {
    if (touchActive)
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      })
    await cdp.detach()
  }
})

test('fresh calibration writes the same note shown in the room and can change without restarting capture @smoke', async ({
  page,
}) => {
  const errors = await openArchiveHush(page, false)
  const panel = page.getByTestId('archive-hush-panel')
  await expect(panel).toContainText('Find your note')
  await page
    .getByRole('button', { name: 'Start listening', exact: true })
    .click()
  await expect(panel).toHaveAttribute('data-mode', 'finding', {
    timeout: 12_000,
  })
  await setArchiveVoice(page, 57, 0.1)
  await expect(panel).toHaveAttribute('data-mode', 'listening', {
    timeout: 10_000,
  })
  await setArchiveVoice(page, 57, 0)
  await expect(panel).toContainText('A3')
  await expect
    .poll(() => page.evaluate(() => window.archiveHushDraw.read().labels))
    .toEqual(['A3', 'A3', 'A3'])
  expect(
    await page.evaluate(() =>
      localStorage.getItem('beside-cue:glass-adventure:comfortable-note'),
    ),
  ).toBe('57')
  await page.getByRole('button', { name: 'Change note', exact: true }).click()
  await expect(panel).toHaveAttribute('data-mode', 'finding')
  await setArchiveVoice(page, 60, 0.1)
  await expect(panel).toHaveAttribute('data-mode', 'listening', {
    timeout: 10_000,
  })
  await setArchiveVoice(page, 60, 0)
  await expect(panel).toContainText('C4')
  await expect
    .poll(() => page.evaluate(() => window.archiveHushDraw.read().labels))
    .toEqual(['C4', 'C4', 'C4'])
  expect(await page.evaluate(() => window.archiveHushPcm.read())).toMatchObject(
    { acquired: 1, live: 1 },
  )
  await page
    .getByRole('button', { name: 'Stop listening', exact: true })
    .click()
  await expectArchiveMicrophoneOff(page)
  await renderMuseumCheckpoint(page)
  expect(errors).toEqual([])
})

test('Settings and help stop Hush capture and require an explicit listening resume @smoke', async ({
  page,
}) => {
  const errors = await openArchiveHush(page)
  const panel = page.getByTestId('archive-hush-panel')
  await page
    .getByRole('button', { name: 'Start listening', exact: true })
    .click()
  await expect(panel).toHaveAttribute('data-mode', 'listening', {
    timeout: 12_000,
  })
  await setArchiveVoice(page, 57, 0.1)
  await expect(panel).toHaveAttribute('data-shields', '1', { timeout: 10_000 })
  await page.getByRole('button', { name: 'Open settings', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Settings', exact: true }),
  ).toBeVisible()
  await expectArchiveMicrophoneOff(page)
  await page
    .getByRole('button', { name: 'Close settings', exact: true })
    .click()
  await expect(panel).toHaveAttribute('data-mode', 'paused')
  await expectArchiveMicrophoneOff(page)

  await page
    .getByRole('button', { name: 'Resume listening', exact: true })
    .click()
  await expect(panel).toHaveAttribute('data-mode', 'listening', {
    timeout: 12_000,
  })
  await setArchiveVoice(page, 57, 0)
  expect(await page.evaluate(() => window.archiveHushPcm.read())).toMatchObject(
    { acquired: 2, live: 1 },
  )
  await page.getByRole('button', { name: 'Open settings', exact: true }).click()
  await expectArchiveMicrophoneOff(page)
  await page.getByRole('tab', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: 'How to play', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Skip tutorial', exact: true }),
  ).toBeVisible()
  await expectArchiveMicrophoneOff(page)
  await page.getByRole('button', { name: 'Skip tutorial', exact: true }).click()
  await page
    .getByRole('button', { name: 'Close settings', exact: true })
    .click()
  await expect(panel).toHaveAttribute('data-mode', 'paused')
  await expectArchiveMicrophoneOff(page)
  expect(await page.evaluate(() => window.archiveHushPcm.read().acquired)).toBe(
    2,
  )
  expect(
    await page.evaluate(() => window.archiveHushDraw.read().vessels),
  ).toEqual(
    Array.from({ length: 3 }, () => ({
      intact: true,
      shards: 0,
      shardsVisible: false,
    })),
  )
  expect(errors).toEqual([])
})

test('three protected rooms open real doors and a walkable escape, with a failed curtain attempt and saved checkpoint @smoke', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000)
  const errors = await openArchiveHush(page)
  const panel = page.getByTestId('archive-hush-panel')
  const root = page.getByTestId('glass-adventure')
  const centerZs = [0, 14.942239828, 29.884479656]
  const rooms = ['diadem', 'tide', 'lotus']
  // CI renders each protected room. Extra approach/retry/exit captures belong
  // to the continuous GPU run so software screenshots do not consume the route deadline.
  const captureRoom = async (name: string, supplemental = false) => {
    if (supplemental && process.env.GLASS_E2E_FULL_RASTER !== '1') return
    await renderMuseumCheckpoint(page)
    await testInfo.attach(name, {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
  }
  const solve = async (curtain: boolean) => {
    await page
      .getByRole('button', { name: 'Start listening', exact: true })
      .click()
    await expect(panel).toHaveAttribute('data-mode', 'listening', {
      timeout: 12_000,
    })
    await setArchiveVoice(page, 57, 0.1)
    await expect(panel).toHaveAttribute('data-shields', '1', {
      timeout: 10_000,
    })
    await page.getByTestId('archive-aim-1').click()
    await expect(panel).toHaveAttribute('data-shields', '2', {
      timeout: 10_000,
    })
    await setArchiveVoice(page, 57, 0)
    if (curtain)
      await page.getByRole('button', { name: /^Close curtain/ }).click()
    await page
      .getByRole('button', { name: 'Ring the chime', exact: true })
      .click()
    await expect(panel.getByRole('status')).toHaveText(
      /^Chime in [123]\. Watch your displays\.$/,
    )
    await expect(panel.getByRole('status')).toBeInViewport({ ratio: 1 })
  }
  for (let index = 0; index < rooms.length; index++) {
    await expect(panel).toHaveAttribute('data-room', rooms[index]!)
    await expect(panel).toHaveAttribute('data-mode', 'off')
    await expectArchiveMicrophoneOff(page)
    await walkArchiveTo(page, 0, centerZs[index]! - 0.8)
    await page.getByTestId('archive-aim-0').click()
    await captureRoom(`room-${index + 1}-entry`, true)
    if (index === 1) {
      await solve(false)
      await expect(panel).toHaveAttribute('data-mode', 'retry', {
        timeout: 8_000,
      })
      await expect(root).toHaveAttribute('data-completed', '3')
      await expectArchiveMicrophoneOff(page)
      await captureRoom('room-2-open-curtain-retry', true)
      await page.getByRole('button', { name: 'Reset this arrangement' }).click()
    }
    await solve(index > 0)
    if (index > 0) {
      await expect(
        page.getByRole('button', { name: /^Open curtain/ }),
      ).toBeDisabled()
      await expect(panel).toHaveAttribute('data-curtain', 'true')
    }
    await expect(panel).toHaveAttribute('data-mode', 'complete', {
      timeout: 8_000,
    })
    await expectArchiveMicrophoneOff(page)
    await captureRoom(`room-${index + 1}-protected`)
    await expect(root).toHaveAttribute(
      'data-completed',
      String([3, 7, 12][index]),
    )
    expect(
      await page.evaluate(() => window.archiveHushDraw.read().vessels),
    ).toEqual(
      Array.from({ length: [3, 4, 5][index] }, () => ({
        intact: true,
        shards: 0,
        shardsVisible: false,
      })),
    )
    // The protection result opens a door but does not skip the walk to the exit.
    await expect(
      page.getByRole('heading', { name: 'The archive is safe', exact: true }),
    ).toBeHidden()
    await walkArchiveTo(page, -2.3, centerZs[index]! - 0.8)
    await walkArchiveTo(page, -2.3, centerZs[index]! + 2.4)
    await walkArchiveTo(page, 0, centerZs[index]! + 2.4)
    if (index < 2) {
      await walkArchiveTo(page, 0, centerZs[index + 1]! - 0.8)
      await expect(root).toHaveAttribute(
        'data-checkpoint',
        new RegExp(`/${rooms[index + 1]}/checkpoint/entry$`),
      )
      await testInfo.attach(`room-${index + 2}-saved-state`, {
        body: JSON.stringify(
          await page.evaluate(() =>
            Object.fromEntries(
              Object.entries(localStorage).filter(([key]) =>
                key.startsWith('beside-cue:glass-adventure:'),
              ),
            ),
          ),
        ),
        contentType: 'application/json',
      })
      if (index === 0) {
        await page.reload()
        await expect(root).toHaveAttribute('data-ready', 'true', {
          timeout: 60_000,
        })
        await expect(root).toHaveAttribute('data-completed', '3')
        await expectArchiveMicrophoneOff(page)
      }
    }
  }
  // Walk beyond the portal centre, not merely into its approach bounds.
  await walkArchiveTo(page, 0, 39.55, true)
  await expect(
    page.getByRole('heading', { name: 'The archive is safe', exact: true }),
  ).toBeVisible({ timeout: 10_000 })
  expect((await archivePlayer(page)).z).toBeGreaterThan(39.305)
  await expectArchiveMicrophoneOff(page)
  await captureRoom('archive-escaped', true)
  expect(errors).toEqual([])
})

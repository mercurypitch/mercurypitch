// Studio arrangement gestures — browser pointer coordinates must produce one reversible durable edit.
import { expect, test } from '@playwright/test'
import { dragMouse, dragTouch, importStudioAudio, openArrangement, readStudioProject, setClipStart, setStudioZoom, STUDIO_RATE, studioClip, studioRegion, timelineViewport, } from './helpers/dedicatedstudio-fixture'

// This suite isolates editing from service-worker navigation. The local-project
// suite separately exercises the app entry, reload, backups and editor leases.
test.use({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } })

test('Studio moves a clip at zoom after horizontal scroll as one undoable gesture @smoke', async ({
  page,
}, testInfo) => {
  await openArrangement(page)
  await setStudioZoom(page, 120)
  await setClipStart(page, 8)
  const viewport = timelineViewport(page)
  await viewport.hover({ position: { x: 600, y: 180 } })
  await page.mouse.wheel(720, 0)
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollLeft))
    .toBe(720)
  const before = await readStudioProject(page)
  await expect(studioClip(page)).toBeVisible()
  await dragMouse(page, studioClip(page), 120)
  await page.screenshot({ path: testInfo.outputPath('move-after-scroll.png') })
  await expect
    .poll(async () => (await readStudioProject(page)).clips[0].startFrame)
    .toBe(9 * STUDIO_RATE)
  const moved = await readStudioProject(page)
  expect(moved.revision).toBe(before.revision + 1)
  expect(moved.clips[0].sourceInFrame).toBe(before.clips[0].sourceInFrame)
  expect(moved.clips[0].sourceOutFrame).toBe(before.clips[0].sourceOutFrame)
  await studioRegion(page)
    .getByRole('button', { name: /^Undo / })
    .click()
  await expect
    .poll(async () => (await readStudioProject(page)).clips[0].startFrame)
    .toBe(8 * STUDIO_RATE)
  expect((await readStudioProject(page)).revision).toBe(before.revision + 2)
  await dragMouse(page, studioClip(page), 180, 0, true)
  expect((await readStudioProject(page)).clips[0].startFrame).toBe(
    8 * STUDIO_RATE,
  )
  expect((await readStudioProject(page)).revision).toBe(before.revision + 2)
})

test('Studio rejects an occupied drop and accepts the explicit new lane target @smoke', async ({
  page,
}) => {
  await openArrangement(page)
  await importStudioAudio(page, 'Reply')
  await setStudioZoom(page, 120)
  const before = await readStudioProject(page)
  const moving = studioClip(page)
  const destination = studioClip(page, 'Reply')
  const sourceBox = await moving.boundingBox()
  const targetBox = await destination.boundingBox()
  if (!sourceBox || !targetBox)
    throw new Error('Both audio lanes must be visible before a drop.')
  await dragMouse(page, moving, 0, targetBox.y - sourceBox.y)
  await expect(
    studioRegion(page)
      .getByRole('status')
      .filter({ hasText: /overlap|occupied|another clip/i }),
  ).toBeVisible()
  const rejected = await readStudioProject(page)
  expect(rejected.revision).toBe(before.revision)
  expect(rejected.tracks).toEqual(before.tracks)
  expect(rejected.clips).toEqual(before.clips)
  const newLane = studioRegion(page).getByLabel('New lane', { exact: true })
  const newLaneBox = await newLane.boundingBox()
  if (!newLaneBox)
    throw new Error('The explicit new lane drop target must be visible.')
  await dragMouse(
    page,
    moving,
    0,
    newLaneBox.y + newLaneBox.height / 2 - sourceBox.y - sourceBox.height / 2,
  )
  await expect
    .poll(async () => (await readStudioProject(page)).tracks.length)
    .toBe(3)
  const after = await readStudioProject(page)
  const dropped = after.clips.find((clip) => clip.id === before.clips[0].id)!
  const occupied = before.clips[1]
  expect(after.revision).toBe(before.revision + 1)
  expect(dropped.startFrame).toBe(0)
  expect(dropped.trackId).not.toBe(occupied.trackId)
  expect(dropped.trackId).not.toBe(before.clips[0].trackId)
  expect(after.clips.find((clip) => clip.id === occupied.id)).toEqual(occupied)
  await studioRegion(page)
    .getByRole('button', { name: /^Undo / })
    .click()
  await expect
    .poll(async () => (await readStudioProject(page)).tracks.length)
    .toBe(2)
  expect((await readStudioProject(page)).clips).toEqual(before.clips)
})

test('Studio fine nudges and pastes copied audio at the playhead with one undo @smoke', async ({
  page,
}) => {
  await openArrangement(page)
  const before = await readStudioProject(page)
  const clip = studioClip(page)
  await clip.click()
  await clip.press('Alt+ArrowRight')
  await expect
    .poll(async () => (await readStudioProject(page)).clips[0].startFrame)
    .toBe(48)
  await clip.press('ControlOrMeta+c')
  const playhead = studioRegion(page).getByRole('spinbutton', {
    name: 'Playhead in seconds',
  })
  await playhead.fill('2')
  await playhead.press('Tab')
  await clip.focus()
  await clip.press('ControlOrMeta+v')
  await expect
    .poll(async () => (await readStudioProject(page)).clips.length)
    .toBe(2)
  const pasted = await readStudioProject(page)
  const added = pasted.clips.find((item) => item.id !== before.clips[0].id)!
  expect(added.startFrame).toBe(2 * STUDIO_RATE)
  expect(added.assetId).toBe(before.clips[0].assetId)
  expect(added.sourceInFrame).toBe(before.clips[0].sourceInFrame)
  expect(added.sourceOutFrame).toBe(before.clips[0].sourceOutFrame)
  expect(added.trackId).not.toBe(before.clips[0].trackId)
  expect(pasted.revision).toBe(before.revision + 2)
  await page.keyboard.press('ControlOrMeta+z')
  await expect
    .poll(async () => (await readStudioProject(page)).clips.length)
    .toBe(1)
  expect((await readStudioProject(page)).clips[0].startFrame).toBe(48)
  await expect(studioRegion(page).locator(':focus')).toHaveCount(1)
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect
    .poll(async () => (await readStudioProject(page)).clips.length)
    .toBe(2)
  expect(
    (await readStudioProject(page)).clips.find((item) => item.id === added.id),
  ).toEqual(added)
})

test('Studio trims source bounds without jumping at an expanded handle grab @smoke', async ({
  page,
}) => {
  await openArrangement(page)
  await setStudioZoom(page, 120)
  await setClipStart(page, 2)
  await studioClip(page).click()
  const arrangement = studioRegion(page).locator(
    '[aria-label="Song arrangement"]',
  )
  const head = arrangement.getByLabel(/^Trim start(?: |$)/)
  await expect(head).toBeVisible()
  const handle = await head.boundingBox()
  const originalBox = await studioClip(page).boundingBox()
  if (!handle || !originalBox)
    throw new Error('The selected clip and trim handle must be visible.')
  expect(handle.width).toBeGreaterThanOrEqual(28)
  expect(handle.height).toBeGreaterThanOrEqual(28)
  const before = await readStudioProject(page)
  const x = handle.x + handle.width / 2 + 6
  const y = handle.y + handle.height / 2
  await page.keyboard.down('Alt')
  await page.mouse.move(x, y)
  await page.mouse.down()
  try {
    expect((await studioClip(page).boundingBox())?.x).toBe(originalBox.x)
    await page.mouse.move(x + 60, y, { steps: 10 })
  } finally {
    await page.mouse.up()
    await page.keyboard.up('Alt')
  }
  await expect
    .poll(async () => (await readStudioProject(page)).clips[0].sourceInFrame)
    .toBe(STUDIO_RATE / 2)
  const headTrimmed = await readStudioProject(page)
  expect(headTrimmed.clips[0].startFrame).toBe(2.5 * STUDIO_RATE)
  expect(headTrimmed.clips[0].sourceOutFrame).toBe(4 * STUDIO_RATE)
  expect(headTrimmed.revision).toBe(before.revision + 1)
  await dragMouse(page, arrangement.getByLabel(/^Trim end(?: |$)/), -60)
  await expect
    .poll(async () => (await readStudioProject(page)).clips[0].sourceOutFrame)
    .toBe(3.5 * STUDIO_RATE)
  const trimmed = await readStudioProject(page)
  expect(trimmed.clips[0].startFrame).toBe(headTrimmed.clips[0].startFrame)
  expect(trimmed.clips[0].sourceInFrame).toBe(
    headTrimmed.clips[0].sourceInFrame,
  )
  expect(trimmed.revision).toBe(before.revision + 2)
  await studioRegion(page)
    .getByRole('button', { name: /^Undo / })
    .click()
  await expect
    .poll(async () => (await readStudioProject(page)).clips[0].sourceOutFrame)
    .toBe(4 * STUDIO_RATE)
  expect((await readStudioProject(page)).clips[0].sourceInFrame).toBe(
    STUDIO_RATE / 2,
  )
})

test('Studio fade handles persist source-anchored fades through a later trim @smoke', async ({
  page,
}) => {
  await openArrangement(page)
  await setStudioZoom(page, 120)
  await setClipStart(page, 2)
  await studioClip(page).click()
  const arrangement = studioRegion(page).locator(
    '[aria-label="Song arrangement"]',
  )
  const fadeIn = arrangement.getByLabel(/^Fade in(?: |$)/)
  const fadeOut = arrangement.getByLabel(/^Fade out(?: |$)/)
  await expect(fadeIn).toBeVisible()
  const before = await readStudioProject(page)
  await dragMouse(page, fadeIn, 60)
  await expect
    .poll(async () => (await readStudioProject(page)).clips[0].fades.in)
    .toEqual({ fromSourceFrame: 0, toSourceFrame: STUDIO_RATE / 2 })
  await dragMouse(page, fadeOut, -90)
  await expect
    .poll(async () => (await readStudioProject(page)).clips[0].fades.out)
    .toEqual({
      fromSourceFrame: 3.25 * STUDIO_RATE,
      toSourceFrame: 4 * STUDIO_RATE,
    })
  const faded = await readStudioProject(page)
  expect(faded.revision).toBe(before.revision + 2)
  await dragMouse(page, arrangement.getByLabel(/^Trim start(?: |$)/), 60)
  await expect
    .poll(async () => (await readStudioProject(page)).clips[0].sourceInFrame)
    .toBe(STUDIO_RATE / 2)
  expect((await readStudioProject(page)).clips[0].fades).toEqual(
    faded.clips[0].fades,
  )
})

test('Studio completes an extreme trim before hiding handles on the narrow result @smoke', async ({
  page,
}) => {
  await openArrangement(page)
  await setStudioZoom(page, 120)
  await setClipStart(page, 2)
  await studioClip(page).click()
  const arrangement = studioRegion(page).locator(
    '[aria-label="Song arrangement"]',
  )
  const tail = arrangement.getByLabel('Trim end', { exact: true })
  await expect(tail).toBeVisible()
  const before = await readStudioProject(page)
  await dragMouse(page, tail, -468)
  await expect
    .poll(async () => (await readStudioProject(page)).clips[0].sourceOutFrame)
    .toBe(4800)
  const trimmed = await readStudioProject(page)
  expect(trimmed.revision).toBe(before.revision + 1)
  expect(trimmed.clips[0].startFrame).toBe(2 * STUDIO_RATE)
  expect(trimmed.clips[0].sourceInFrame).toBe(0)
  await expect(tail).toHaveCount(0)
  await expect(studioClip(page)).toBeFocused()
  await page.keyboard.press('ControlOrMeta+z')
  await expect
    .poll(async () => (await readStudioProject(page)).clips[0].sourceOutFrame)
    .toBe(4 * STUDIO_RATE)
})

test.describe('Tablet arrangement touch', () => {
  test.use({
    viewport: { width: 1024, height: 900 },
    hasTouch: true,
    isMobile: true,
  })

  test('Studio scrolls an unselected clip and drags only after selecting it @smoke', async ({
    page,
  }) => {
    await openArrangement(page)
    await setStudioZoom(page, 120)
    await setClipStart(page, 4)
    // Numeric editing selected this clip. A blank lane click clears selection.
    const viewport = timelineViewport(page)
    await viewport.tap({ position: { x: 300, y: 100 } })
    await expect(studioClip(page)).toHaveAttribute('aria-pressed', 'false')
    const before = await readStudioProject(page)
    await dragTouch(page, studioClip(page), -120)
    await expect
      .poll(() => viewport.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(40)
    expect((await readStudioProject(page)).revision).toBe(before.revision)
    expect((await readStudioProject(page)).clips).toEqual(before.clips)
    await viewport.evaluate(async (element) => {
      let previous = element.scrollLeft
      let stableFrames = 0
      for (let frame = 0; frame < 120 && stableFrames < 3; frame++) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        )
        stableFrames = element.scrollLeft === previous ? stableFrames + 1 : 0
        previous = element.scrollLeft
      }
    })
    await studioClip(page).tap()
    await expect(studioClip(page)).toHaveAttribute('aria-pressed', 'true')
    const scrollBefore = await viewport.evaluate(
      (element) => element.scrollLeft,
    )
    await dragTouch(page, studioClip(page), 120)
    await expect
      .poll(async () => (await readStudioProject(page)).clips[0].startFrame)
      .toBe(5 * STUDIO_RATE)
    expect((await readStudioProject(page)).revision).toBe(before.revision + 1)
    expect(await viewport.evaluate((element) => element.scrollLeft)).toBe(
      scrollBefore,
    )
  })
})

// Normal-motion record playback keeps the phone viewport and narration centered.

import type { Page, TestInfo } from '@playwright/test'
import { expect, test } from '@playwright/test'

test.use({ isMobile: true, hasTouch: true })

async function phase(page: Page, name: string): Promise<void> {
  await expect(page.locator('main[data-phase]')).toHaveAttribute(
    'data-phase',
    name,
    { timeout: 20_000 },
  )
}

async function chooseFirst(page: Page): Promise<void> {
  const radio = page.getByRole('radio').first()
  // The full choice label is the visible touch target; its radio is hidden.
  await radio.locator('..').click({ timeout: 10_000 })
  await expect(radio).toBeChecked()
}

async function verifyLayout(
  page: Page,
  name: string,
  info: TestInfo,
): Promise<void> {
  const metrics = await page.evaluate(() => {
    const director = document.querySelector<HTMLElement>('main[data-phase]')!
    const section = director.querySelector<HTMLElement>(':scope > section')!
    const header = director.querySelector<HTMLElement>(
      'header[class*="copyHeading"]',
    )!
    const heading = header.querySelector<HTMLElement>('h1')!
    const caption = header.querySelector<HTMLElement>('p')
    const rect = (element: HTMLElement) => {
      const box = element.getBoundingClientRect()
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        width: box.width,
        height: box.height,
      }
    }
    const visual = section.querySelector<HTMLElement>(':scope > div')!
    const record = section.querySelector<HTMLElement>('[class*="recordFrame"]')
    return {
      phase: director.dataset.phase,
      viewportWidth: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      viewportScale: visualViewport?.scale ?? 1,
      viewportOffsetLeft: visualViewport?.offsetLeft ?? 0,
      scrollX,
      director: rect(director),
      section: rect(section),
      visual: rect(visual),
      record: record === null ? null : rect(record),
      header: rect(header),
      heading: rect(heading),
      caption: caption === null ? null : rect(caption),
    }
  })
  await info.attach(`${name}-layout`, {
    body: JSON.stringify(metrics, null, 2),
    contentType: 'application/json',
  })
  await page.screenshot({ path: info.outputPath(`${name}.png`) })
  expect
    .soft(metrics.documentWidth, `${name}: document stays at the device width`)
    .toBeLessThanOrEqual(metrics.viewportWidth)
  expect
    .soft(metrics.viewportScale, `${name}: no viewport zoom`)
    .toBeCloseTo(1, 2)
  expect
    .soft(metrics.viewportOffsetLeft, `${name}: no viewport pan`)
    .toBeCloseTo(0, 1)
  expect.soft(metrics.scrollX, `${name}: no horizontal scroll`).toBe(0)
  if (metrics.phase !== 'B06_STOP_SAVE_HOLD') {
    expect
      .soft(metrics.caption, `${name}: narration caption is present`)
      .not.toBeNull()
  }
  for (const [label, box] of Object.entries({
    header: metrics.header,
    heading: metrics.heading,
    caption: metrics.caption,
  })) {
    if (box === null) continue
    const leftGap = box.left
    const rightGap = metrics.viewportWidth - box.right
    expect
      .soft(
        Math.abs(leftGap - rightGap),
        `${name}: ${label} has equal side margins`,
      )
      .toBeLessThanOrEqual(2)
  }
  if (metrics.record !== null) {
    expect
      .soft(
        metrics.record.width,
        `${name}: record surface keeps the viewport width`,
      )
      .toBeCloseTo(metrics.visual.width, 1)
    expect
      .soft(metrics.record.left, `${name}: record surface stays registered`)
      .toBeCloseTo(metrics.visual.left, 1)
  }
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 390, height: 664 },
]) {
  test(`record scenes preserve phone layout at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, info) => {
    test.setTimeout(90_000)
    await page.setViewportSize(viewport)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    await page.getByRole('button', { name: 'Mute audio', exact: true }).click()
    await page
      .getByRole('button', { name: 'Tap to begin', exact: true })
      .click()
    await phase(page, 'B03_PULL_CHOICE_HOLD')
    await chooseFirst(page)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await phase(page, 'B04_CUE_CONTEXT_HOLD')
    await chooseFirst(page)
    await page
      .getByRole('button', { name: 'Choose Side B', exact: true })
      .click()
    await phase(page, 'B05_SIDE_B_CHOICE_HOLD')
    await chooseFirst(page)
    await verifyLayout(page, 'before-record', info)
    await page
      .getByRole('button', { name: 'Start the record', exact: true })
      .click()
    await phase(page, 'B06_CORKY_STARTS_RECORD')
    const recordVideo = page.locator(
      '[data-v2-media-target="record:start"] video',
    )
    await expect
      .poll(() =>
        recordVideo.evaluate(
          (video: HTMLVideoElement) =>
            video.readyState >= 2 && !video.paused && video.currentTime > 0,
        ),
      )
      .toBe(true)
    await verifyLayout(page, 'record-start-playing', info)
    await phase(page, 'B06_STOP_SAVE_HOLD')
    await verifyLayout(page, 'record-stop-hold', info)
    await page
      .getByRole('button', { name: 'Stop and save plan', exact: true })
      .click()
    await phase(page, 'B07_REMINDER_HOLD')
    await verifyLayout(page, 'after-record-reminder', info)
  })
}

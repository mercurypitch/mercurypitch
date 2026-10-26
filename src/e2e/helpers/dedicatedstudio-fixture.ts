// Studio arrangement fixtures — import real PCM and inspect durable edits without an application bridge.
import { expect, type Locator, type Page } from '@playwright/test'
import type { StudioProject } from '../../lib/studio/model/types'
import { dismissOverlays, waitForNav } from './ui'

export const STUDIO_RATE = 48_000

export function audioFixture(seconds = 4): Buffer {
  const frames = Math.round(STUDIO_RATE * seconds)
  const bytes = Buffer.alloc(44 + frames * 2)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(STUDIO_RATE, 24)
  bytes.writeUInt32LE(STUDIO_RATE * 2, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(frames * 2, 40)
  for (let frame = 0; frame < frames; frame++) {
    const envelope = 0.4 + 0.3 * Math.sin((frame * Math.PI) / STUDIO_RATE)
    bytes.writeInt16LE(
      Math.round(
        Math.sin((frame * Math.PI * 440) / STUDIO_RATE) * 8_000 * envelope,
      ),
      44 + frame * 2,
    )
  }
  return bytes
}

export function studioRegion(page: Page): Locator {
  return page.getByRole('region', { name: 'Studio', exact: true })
}

export function studioClip(page: Page, name = 'Phrase'): Locator {
  return studioRegion(page).getByRole('button', {
    name: new RegExp(`^${name}, `),
  })
}

export function timelineViewport(page: Page): Locator {
  return studioRegion(page).locator('[data-studio-timeline-viewport]')
}

export async function openArrangement(page: Page): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
  })
  await page.goto('/studio-night')
  await waitForNav(page, 30_000)
  await dismissOverlays(page)
  await studioRegion(page)
    .getByRole('button', { name: 'Create project', exact: true })
    .click()
  await importStudioAudio(page)
}

export async function importStudioAudio(
  page: Page,
  name = 'Phrase',
  seconds = 4,
): Promise<void> {
  await studioRegion(page)
    .getByLabel('Upload audio', { exact: true })
    .setInputFiles({
      name: `${name}.wav`,
      mimeType: 'audio/wav',
      buffer: audioFixture(seconds),
    })
  await expect(
    studioRegion(page).getByRole('button', {
      name: `${name} details`,
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    studioRegion(page).getByText('Saved in this browser', { exact: true }),
  ).toBeVisible()
  await expect(studioClip(page, name)).toHaveCount(1)
}

export async function readStudioProject(page: Page): Promise<StudioProject> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('MercuryPitchDB')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const projects = await new Promise<unknown[]>((resolve, reject) => {
        const request = database
          .transaction('studioProjects', 'readonly')
          .objectStore('studioProjects')
          .getAll()
        request.onsuccess = () => resolve(request.result as unknown[])
        request.onerror = () => reject(request.error)
      })
      if (projects.length !== 1)
        throw new Error(
          `Expected one isolated Studio project, found ${projects.length}.`,
        )
      return projects[0] as StudioProject
    } finally {
      database.close()
    }
  })
}

export async function setStudioZoom(
  page: Page,
  pixelsPerSecond: number,
): Promise<void> {
  const zoom = studioRegion(page).getByRole('slider', {
    name: 'Timeline zoom',
    exact: true,
  })
  await zoom.focus()
  await zoom.press('Home')
  for (let value = 10; value < pixelsPerSecond; value += 5)
    await zoom.press('ArrowRight')
  await expect(zoom).toHaveValue(String(pixelsPerSecond))
}

export async function setClipStart(
  page: Page,
  seconds: number,
  name = 'Phrase',
): Promise<void> {
  await studioClip(page, name).dblclick()
  const field = studioRegion(page).getByRole('spinbutton', {
    name: /^Start(?: s)?$/,
  })
  await field.fill(String(seconds))
  await field.press('Tab')
  await studioRegion(page)
    .getByRole('button', { name: 'Close Clip details', exact: true })
    .click()
  await expect
    .poll(
      async () =>
        (await readStudioProject(page)).clips.find(
          (clip) => clip.startFrame === seconds * STUDIO_RATE,
        )?.startFrame,
    )
    .toBe(seconds * STUDIO_RATE)
}

export async function center(
  locator: Locator,
): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('The Studio interaction target is not visible.')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

export async function dragMouse(
  page: Page,
  target: Locator,
  deltaX: number,
  deltaY = 0,
  cancel = false,
): Promise<void> {
  const point = await center(target)
  await page.keyboard.down('Alt')
  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  try {
    await page.mouse.move(point.x + deltaX, point.y + deltaY, { steps: 12 })
    if (cancel) await page.keyboard.press('Escape')
  } finally {
    await page.mouse.up()
    await page.keyboard.up('Alt')
  }
}

/** CDP input passes through Chromium's native touch and scrolling pipeline. */
export async function dragTouch(
  page: Page,
  target: Locator,
  deltaX: number,
): Promise<void> {
  const point = await center(target)
  const session = await page.context().newCDPSession(page)
  try {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: point.x, y: point.y, id: 1 }],
    })
    for (let step = 1; step <= 12; step++) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: point.x + (deltaX * step) / 12, y: point.y, id: 1 }],
      })
    }
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
  } finally {
    await session.detach()
  }
}

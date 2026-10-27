// Studio drop and repeat acceptance — batch-owned audio and continuous playback use real local projects.
import { expect, test } from '@playwright/test'
import { audioFixture, openArrangement, readStudioProject, studioRegion, } from './helpers/dedicatedstudio-fixture'

test.use({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } })

test('Studio drops files into new lanes in one reversible import @smoke', async ({
  page,
}) => {
  await openArrangement(page)
  const before = await readStudioProject(page)
  // Below the lanes: a drop there starts new lanes, one per file.
  const audio = studioRegion(page).locator('[data-studio-new-lane]')
  const lane = studioRegion(page).locator('[data-studio-lane-audio]').first()
  const laneBounds = await lane.boundingBox()
  const bounds = await audio.boundingBox()
  if (!bounds || !laneBounds)
    throw new Error('The new lane row must be visible.')
  const transfer = await page.evaluateHandle((encoded) => {
    const data = new DataTransfer()
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))
    data.items.add(new File([bytes], 'Harmony.wav', { type: 'audio/wav' }))
    data.items.add(new File([bytes], 'Double.wav', { type: 'audio/wav' }))
    return data
  }, audioFixture(2).toString('base64'))
  try {
    const coordinates = {
      clientX: laneBounds.x + 160,
      clientY: bounds.y + bounds.height / 2,
    }
    await audio.dispatchEvent('dragover', {
      dataTransfer: transfer,
      ...coordinates,
    })
    await expect(
      studioRegion(page).getByText(
        'Drop on a lane, or below the lanes for a new one',
        {
          exact: true,
        },
      ),
    ).toBeVisible()
    await audio.dispatchEvent('drop', {
      dataTransfer: transfer,
      ...coordinates,
    })
    await expect
      .poll(async () => (await readStudioProject(page)).tracks.length)
      .toBe(3)
    const imported = await readStudioProject(page)
    expect(imported.revision).toBe(before.revision + 1)
    expect(
      imported.clips.filter((clip) => clip.startFrame === 192000),
    ).toHaveLength(2)
    expect(
      imported.clips.find((clip) => clip.id === before.clips[0].id),
    ).toEqual(before.clips[0])
    await studioRegion(page)
      .getByRole('button', { name: /^Undo / })
      .click()
    await expect
      .poll(async () => (await readStudioProject(page)).tracks.length)
      .toBe(1)
  } finally {
    await transfer.dispose()
  }
})

test('Studio repeats a song without stopping at its end @smoke', async ({
  page,
}) => {
  await openArrangement(page)
  const studio = studioRegion(page)
  await studio.getByRole('button', { name: 'Repeat song', exact: true }).click()
  await expect(
    studio.getByRole('button', { name: 'Repeat song', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await studio.getByRole('button', { name: 'Play song', exact: true }).click()
  await expect(
    studio.getByRole('button', { name: 'Pause song', exact: true }),
  ).toBeVisible()
  let previous = 0
  await expect
    .poll(
      async () => {
        const text = await studio
          .getByLabel('Song position', { exact: true })
          .textContent()
        const seconds = Number(text?.split(':')[1] ?? 0)
        const wrapped = previous > 3 && seconds < 1
        previous = seconds
        return wrapped
      },
      { timeout: 12000, intervals: [100] },
    )
    .toBe(true)
  await expect(
    studio.getByRole('button', { name: 'Pause song', exact: true }),
  ).toBeVisible()
  await studio.getByRole('button', { name: 'Pause song', exact: true }).click()
  await expect(
    studio.getByRole('button', { name: 'Play song', exact: true }),
  ).toBeVisible()
})

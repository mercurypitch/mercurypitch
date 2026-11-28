// Studio clip takes for browser tests: two takes sung from the same start on one lane, the older turned all the way down, and what the song plays from its start (studio-takes.spec.ts).
import { expect, type Page } from '@playwright/test'
import type { StudioAsset, StudioClip, StudioProject, } from '../../lib/studio/model/types'
import { openArrangement, readStudioProject, studioRegion, } from './dedicatedstudio-fixture'
import { armLane, recordTake } from './studio-arming'
import { tapOutput, traceLevel } from './studio-output'

async function readAssets(page: Page): Promise<StudioAsset[]> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('MercuryPitchDB')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      return await new Promise<StudioAsset[]>((resolve, reject) => {
        const request = database
          .transaction('studioAssets', 'readonly')
          .objectStore('studioAssets')
          .getAll()
        // The row keeps the asset beside its project and digest (studio-records.ts).
        request.onsuccess = () =>
          resolve(
            (request.result as { asset: StudioAsset }[]).map(
              (row) => row.asset,
            ),
          )
        request.onerror = () => reject(request.error)
      })
    } finally {
      database.close()
    }
  })
}

/** The stored id of the take kept as `title`. */
async function takeId(page: Page, title: string): Promise<string> {
  const asset = (await readAssets(page)).find(
    (each) => each.originalName === `${title}.wav`,
  )
  if (!asset) throw new Error(`No take called ${title} in the song.`)
  return asset.id
}

/** The clip a lane plays from song frame 0, as stored. */
export const firstClip = (project: StudioProject, trackId: string) =>
  project.clips.find(
    (clip) => clip.trackId === trackId && clip.startFrame === 0,
  ) as StudioClip

/** The output level over the second after Play song is pressed: what the song plays from its start. */
export async function levelFromStart(page: Page): Promise<number> {
  const studio = studioRegion(page)
  await studio.locator('[data-tour="studio.workspace"]').focus()
  await page.keyboard.press('Home')
  const { after } = await traceLevel(page, () =>
    studio.getByRole('button', { name: 'Play song', exact: true }).click(),
  )
  await studio.getByRole('button', { name: 'Pause song', exact: true }).click()
  return after
}

/**
 * Lane 2 of the fixture's song with two takes from its start: Take 1, three
 * seconds turned all the way down, then Take 2, two seconds at full level,
 * sung over it on the lane still armed. Only the takes sound: the fixture's
 * phrase is muted. `duringTwo` runs once Take 2 is two seconds in, while it
 * still records over Take 1, on a page `viewport` wide when one is given.
 * Returns the lane's id and both takes' audio ids.
 */
export async function recordTwoTakes(
  page: Page,
  duringTwo: () => Promise<void> = async () => undefined,
  viewport?: { width: number; height: number },
) {
  await tapOutput(page)
  await openArrangement(page)
  const studio = studioRegion(page)
  await studio
    .locator('[data-studio-track]')
    .getByRole('button', { name: 'Mute Phrase', exact: true })
    .click()
  await studio
    .getByRole('button', { name: 'New audio lane', exact: true })
    .click()
  await armLane(page, 'Lane 2')

  await recordTake(page, 'Take 1', async () => {
    await expect(studio.getByRole('timer')).toHaveText(/^0:0[3-9]/, {
      timeout: 10_000,
    })
  })
  await studio.getByRole('button', { name: /, Take 1\.wav, / }).dblclick()
  const gain = studio.getByRole('spinbutton', {
    name: 'Clip gain',
    exact: true,
  })
  await gain.fill('-60')
  await gain.press('Tab')
  await studio
    .getByRole('button', { name: 'Close Clip details', exact: true })
    .click()
  const one = await takeId(page, 'Take 1')
  await expect
    .poll(async () => {
      const project = await readStudioProject(page)
      return project.clips.find((clip) => clip.assetId === one)?.gainDb
    })
    .toBe(-60)
  const lane = (await readStudioProject(page)).tracks.find(
    (track) => track.name === 'Lane 2',
  )!.id

  if (viewport) await page.setViewportSize(viewport)
  await studio.locator('[data-tour="studio.workspace"]').focus()
  await page.keyboard.press('Home')
  await recordTake(page, 'Take 2', duringTwo)
  const two = await takeId(page, 'Take 2')
  await expect
    .poll(async () => firstClip(await readStudioProject(page), lane)?.assetId)
    .toBe(two)
  return { studio, lane, one, two }
}

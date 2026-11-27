// Studio takes: a take sung over a take on the armed lane becomes that clip's newest take instead of landing on a new lane; the newest take plays, the older one waits with its own volume, and a reload keeps both.
import { expect, type Page, test } from '@playwright/test'
import type { StudioAsset, StudioClip, StudioProject, } from '../lib/studio/model/types'
import { openArrangement, readStudioProject, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { armLane, recordTake } from './helpers/studio-arming'
import { tapOutput, traceLevel } from './helpers/studio-output'
import { fakeMicArgs, TONE_HZ, writeToneWav } from './helpers/tone-wav'

const TONE_WAV = writeToneWav(TONE_HZ, 20)

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
  viewport: { width: 1440, height: 900 },
})

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
const firstClip = (project: StudioProject, trackId: string) =>
  project.clips.find(
    (clip) => clip.trackId === trackId && clip.startFrame === 0,
  ) as StudioClip

/** The output level over the second after Play song is pressed: what the song plays from its start. */
async function levelFromStart(page: Page): Promise<number> {
  const studio = studioRegion(page)
  await studio.locator('[data-tour="studio.workspace"]').focus()
  await page.keyboard.press('Home')
  const { after } = await traceLevel(page, () =>
    studio.getByRole('button', { name: 'Play song', exact: true }).click(),
  )
  await studio.getByRole('button', { name: 'Pause song', exact: true }).click()
  return after
}

test.describe('Studio takes', () => {
  test('a take sung over a take on the armed lane is the newest take of that clip, plays alone, and outlasts a reload', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    await tapOutput(page)
    await openArrangement(page)
    const studio = studioRegion(page)
    // Only the takes sound: the fixture's phrase is muted.
    await studio
      .locator('[data-studio-track]')
      .getByRole('button', { name: 'Mute Phrase', exact: true })
      .click()
    await studio
      .getByRole('button', { name: 'New audio lane', exact: true })
      .click()
    await armLane(page, 'Lane 2')

    // Take 1, three seconds, then turned all the way down.
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

    // Take 2, two seconds, from the same start on the lane still armed.
    await studio.locator('[data-tour="studio.workspace"]').focus()
    await page.keyboard.press('Home')
    await recordTake(page, 'Take 2')
    const two = await takeId(page, 'Take 2')

    // One lane more than the fixture's, and no word of a new one.
    await expect(studio.getByText(/Added on a new lane/)).toHaveCount(0)
    await expect
      .poll(async () => firstClip(await readStudioProject(page), lane)?.assetId)
      .toBe(two)
    const project = await readStudioProject(page)
    expect(project.tracks.map((track) => track.name)).toEqual([
      'Phrase',
      'Lane 2',
    ])
    const stacked = firstClip(project, lane)
    expect(stacked).toMatchObject({
      gainDb: 0,
      activeTake: 1,
      takes: [{ assetId: one, gainDb: -60 }],
    })
    // Take 1 sang on past Take 2's end, and goes on playing there.
    const end =
      stacked.startFrame + stacked.sourceOutFrame - stacked.sourceInFrame
    expect(
      project.clips.find(
        (clip) => clip.trackId === lane && clip.startFrame === end,
      ),
    ).toMatchObject({ assetId: one, gainDb: -60 })

    // The newest take plays at full level, not the one turned down.
    expect(await levelFromStart(page)).toBeGreaterThan(-40)

    // A reload keeps both takes, the newest still playing.
    const song = studio.getByRole('button', {
      name: new RegExp(
        `^${project.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
      ),
    })
    await page.reload()
    await expect(song).toBeEnabled()
    await song.click()
    await expect(
      studio.getByRole('button', { name: /^Lane 2, Take 2\.wav, / }),
    ).toHaveCount(1)
    expect(firstClip(await readStudioProject(page), lane)).toEqual(stacked)
    expect(await levelFromStart(page)).toBeGreaterThan(-40)
  })
})

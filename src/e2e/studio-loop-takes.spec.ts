// Studio loop takes: Repeat over a range keeps a pass for each time round, and T steps through them on the clip; a second loop over the same clip stacks onto it as a take of its own, its passes counted among the clip's takes.
import { expect, type Page, test } from '@playwright/test'
import type { StudioClip } from '../lib/studio/model/types'
import { openArrangement, readStudioProject, setClipStart, studioClip, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { fakeMicArgs, TONE_HZ, writeToneWav } from './helpers/tone-wav'

const TONE_WAV = writeToneWav(TONE_HZ, 60)
const RATE = 48_000
/** The range: the Phrase clip, moved to 6 s, four seconds long. */
const IN = 6 * RATE

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
  viewport: { width: 1440, height: 900 },
})

/** The clip Lane 2 plays from the range's start, as stored. */
async function loopClip(page: Page): Promise<StudioClip | undefined> {
  const project = await readStudioProject(page)
  const lane = project.tracks.find((track) => track.name === 'Lane 2')
  return project.clips.find(
    (clip) => clip.trackId === lane?.id && clip.startFrame === IN,
  )
}

/** Records from the count-in through two whole passes and into a third, then stops. */
async function recordLoop(page: Page): Promise<void> {
  const studio = studioRegion(page)
  const record = studio.locator('[data-studio-record]')
  await studio.locator('[data-tour="studio.workspace"]').focus()
  await page.keyboard.press('r')
  await expect(record).toHaveAccessibleName('Stop recording', {
    timeout: 15_000,
  })
  const status = studio.locator('[data-studio-record-status="recording"]')
  await expect(status).toContainText('Recording pass 1 on Lane 2')
  await expect(status).toContainText('Recording pass 3 on Lane 2', {
    timeout: 15_000,
  })
  await page.keyboard.press('r')
  await expect(record).toHaveAccessibleName('Record', { timeout: 30_000 })
  await expect(
    studio.getByText('Saved in this browser', { exact: true }),
  ).toBeVisible({ timeout: 30_000 })
}

test.describe('Studio loop takes', () => {
  test('T steps through the passes of a loop take, and a second loop over its clip stacks on it as a take', async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await openArrangement(page)
    const studio = studioRegion(page)
    // The range over the Phrase clip, moved to 6 s; Repeat on; a new lane.
    await setClipStart(page, 6)
    await studioClip(page, 'Phrase').click()
    await studio
      .getByRole('toolbar', { name: 'Selected clip' })
      .getByRole('button', { name: 'Range', exact: true })
      .click()
    await expect(
      studio.getByRole('slider', { name: 'Range end', exact: true }),
    ).toHaveAttribute('aria-valuetext', '0:10.000')
    await studio
      .getByRole('button', { name: 'New audio lane', exact: true })
      .click()
    const repeat = studio.getByRole('button', {
      name: 'Repeat range',
      exact: true,
    })
    await repeat.click()
    await expect(repeat).toHaveAttribute('aria-pressed', 'true')

    // The first loop: two whole passes, the second playing.
    await recordLoop(page)
    const one = await loopClip(page)
    expect(one?.passes).toMatchObject({ count: 2 })
    expect(one?.takes).toBeUndefined()
    const pass = (number: number) =>
      studio.getByRole('button', {
        name: new RegExp(`^Lane 2, Take 1, pass ${number} of 2, `),
      })
    await expect(pass(2)).toHaveCount(1)

    // T goes round the passes: from the last to the first, and on.
    await pass(2).focus()
    await page.keyboard.press('t')
    await expect(pass(1)).toBeFocused()
    await page.keyboard.press('t')
    await expect(pass(2)).toBeFocused()
    await expect
      .poll(async () => (await loopClip(page))?.sourceInFrame)
      .toBe(one!.sourceInFrame)

    // The second loop over the same clip, on the lane still armed, stacks:
    // one clip, its own two passes and the first loop's two, four steps.
    await recordLoop(page)
    await expect(studio.getByText(/Added on a new lane/)).toHaveCount(0)
    const stacked = studio.getByRole('button', {
      name: /^Lane 2, Take 2, pass 2 of 2, take 4 of 4, /,
    })
    await expect(stacked).toHaveCount(1)
    await expect(stacked.locator('[data-studio-take-badge]')).toHaveText('4/4')
    // The song saves the stack a moment after the clip shows it.
    await expect.poll(async () => (await loopClip(page))?.activeTake).toBe(1)
    const project = await readStudioProject(page)
    expect(project.tracks.map((track) => track.name)).toEqual([
      'Phrase',
      'Lane 2',
    ])
    const two = await loopClip(page)
    expect(two).toMatchObject({
      activeTake: 1,
      passes: { count: 2 },
      takes: [{ assetId: one!.assetId, passes: { count: 2 } }],
    })

    // T from the last step goes round to the first loop's first pass.
    await stacked.focus()
    await page.keyboard.press('t')
    await expect(
      studio.getByRole('button', {
        name: /^Lane 2, Take 1, pass 1 of 2, take 1 of 4, /,
      }),
    ).toBeFocused()
    await expect
      .poll(async () => (await loopClip(page))?.assetId)
      .toBe(one!.assetId)
  })
})

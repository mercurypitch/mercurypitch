// Studio takes: a take sung over a take on the armed lane becomes that clip's newest take instead of landing on a new lane; the newest take plays, the older one waits with its own volume, and a reload keeps both. The clip says which take plays, and its right-click menu, its bar's Takes list, a phone's clip note and T and Shift+T choose another. Show takes stands them in rows under the lane, where a click plays one. Crop and Explode from the bar's list leave the focus on the clip.
import { expect, test } from '@playwright/test'
import { readStudioProject, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { firstClip, levelFromStart, recordTwoTakes, } from './helpers/studio-clip-takes'
import { fakeMicArgs, TONE_HZ, writeToneWav } from './helpers/tone-wav'

const TONE_WAV = writeToneWav(TONE_HZ, 20)

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
  viewport: { width: 1440, height: 900 },
})

test.describe('Studio takes', () => {
  test('a take sung over a take on the armed lane is the newest take of that clip, plays alone, and outlasts a reload @smoke', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    const { studio, lane, one, two } = await recordTwoTakes(page)

    // One lane more than the fixture's, and no word of a new one.
    await expect(studio.getByText(/Added on a new lane/)).toHaveCount(0)
    const project = await readStudioProject(page)
    expect(project.tracks.map((track) => track.name)).toEqual([
      'Phrase',
      'Lane 2',
    ])
    const stacked = firstClip(project, lane)
    expect(stacked).toMatchObject({
      assetId: two,
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

  test('a clip of two takes says which plays, and its right-click menu, its bar, a phone and T choose another @smoke', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    const { studio, lane, one, two } = await recordTwoTakes(page)
    const clip = (take: number) =>
      studio.getByRole('button', {
        name: new RegExp(`^Lane 2, Take ${take}\\.wav, take ${take} of 2, `),
      })
    const playing = async () =>
      firstClip(await readStudioProject(page), lane)?.assetId
    await expect(clip(2).locator('[data-studio-take-badge]')).toHaveText('2/2')
    const loud = await levelFromStart(page)

    // A right-click lists the takes, the playing one checked and focused.
    await clip(2).click({ button: 'right' })
    const menu = page.getByRole('menu', { name: 'Takes', exact: true })
    const rows = menu.getByRole('menuitemradio')
    await expect(rows).toHaveText(['Take 1', 'Take 2'])
    await expect(rows.nth(1)).toHaveAttribute('aria-checked', 'true')
    await expect(rows.nth(1)).toBeFocused()
    await rows.nth(0).click()
    await expect(menu).toHaveCount(0)
    await expect(clip(1).locator('[data-studio-take-badge]')).toHaveText('1/2')
    await expect.poll(playing).toBe(one)
    expect(firstClip(await readStudioProject(page), lane)).toMatchObject({
      gainDb: -60,
      activeTake: 0,
      takes: [{ assetId: two, gainDb: 0 }],
    })
    // Take 1 was turned all the way down.
    const quiet = await levelFromStart(page)
    expect(quiet).toBeLessThan(loud - 30)

    // T plays the next take, round from the last to the first, and Shift+T
    // the one before; the clip keeps the focus.
    await clip(1).focus()
    await page.keyboard.press('t')
    await expect(clip(2)).toBeFocused()
    await page.keyboard.press('t')
    await expect(clip(1)).toBeFocused()
    await page.keyboard.press('Shift+T')
    await expect(clip(2)).toBeFocused()
    await expect.poll(playing).toBe(two)
    expect(await levelFromStart(page)).toBeGreaterThan(quiet + 30)

    // The selected clip's bar lists them too, and Undo takes a pick back.
    await clip(2).click()
    await studio.getByRole('button', { name: 'Takes', exact: true }).click()
    await expect(rows.nth(1)).toHaveAttribute('aria-checked', 'true')
    await rows.nth(0).click()
    await expect(clip(1)).toHaveCount(1)
    await studio
      .getByRole('button', { name: 'Undo choose take', exact: true })
      .click()
    await expect(clip(2)).toHaveCount(1)

    // A phone has no right-click: the selected clip's note lists them. An
    // armed lane's card stands where the note does, so disarm first.
    await studio.getByRole('button', { name: 'Disarm', exact: true }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await clip(2).click()
    await studio.getByRole('button', { name: 'Takes', exact: true }).click()
    await rows.nth(0).click()
    await expect(clip(1)).toHaveCount(1)
    await expect.poll(playing).toBe(one)
  })

  test('Show takes stands each take in a row under its lane, newest on top, moves the lane below down, and a click on a row plays its take', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    const { studio, lane, one } = await recordTwoTakes(page)
    await studio
      .getByRole('button', { name: 'New audio lane', exact: true })
      .click()
    const lanes = studio.locator('[data-studio-track]')
    // How far below Lane 2's top Lane 3 starts.
    const gap = async () =>
      (await lanes.nth(2).boundingBox())!.y -
      (await lanes.nth(1).boundingBox())!.y
    const closed = await gap()
    const loud = await levelFromStart(page)

    await studio
      .getByRole('button', { name: /^Lane 2, Take 2\.wav, take 2 of 2, / })
      .click({ button: 'right' })
    await page
      .getByRole('menuitem', { name: 'Show takes', exact: true })
      .click()
    const rows = studio.locator('[data-studio-take-row]')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toHaveAccessibleName('Take 2')
    await expect(rows.nth(0)).toHaveAttribute('aria-pressed', 'true')
    await expect(rows.nth(1)).toHaveAccessibleName('Take 1')
    await expect(rows.nth(1)).toHaveAttribute('aria-pressed', 'false')
    // Lane 3 moved down by the rows: a bar and a row a take.
    expect(await gap()).toBeGreaterThan(closed + 100)

    // A click on a row plays its take.
    await rows.nth(1).click()
    await expect(rows.nth(1)).toHaveAttribute('aria-pressed', 'true')
    await expect
      .poll(async () => firstClip(await readStudioProject(page), lane)?.assetId)
      .toBe(one)
    expect(await levelFromStart(page)).toBeLessThan(loud - 30)

    // Escape closes them, back on the clip, and Lane 3 moves back up.
    await rows.nth(1).focus()
    await page.keyboard.press('Escape')
    await expect(rows).toHaveCount(0)
    await expect(
      studio.getByRole('button', {
        name: /^Lane 2, Take 1\.wav, take 1 of 2, /,
      }),
    ).toBeFocused()
    expect(await gap()).toBe(closed)
  })

  test('Alt+Shift+T crops a clip to the take it plays, and Explode takes to new lanes moves the other take to a lane of its own under it, each one undo step @smoke', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    const { studio, lane, one, two } = await recordTwoTakes(page)
    const stacked = studio.getByRole('button', {
      name: /^Lane 2, Take 2\.wav, take 2 of 2, /,
    })
    const playing = async () => firstClip(await readStudioProject(page), lane)

    // Alt+Shift+T keeps the take that plays and drops the other.
    await stacked.focus()
    await page.keyboard.press('Alt+Shift+T')
    await expect(
      studio.getByRole('button', { name: /^Lane 2, Take 2\.wav, 0:00/ }),
    ).toHaveCount(1)
    await expect.poll(async () => (await playing())?.takes).toBeUndefined()
    expect(await playing()).toMatchObject({ assetId: two, gainDb: 0 })
    await studio
      .getByRole('button', { name: 'Undo crop to take', exact: true })
      .click()
    await expect(stacked).toHaveCount(1)
    await expect.poll(async () => (await playing())?.takes?.length).toBe(1)

    // Explode moves Take 1 to a lane of its own right under Lane 2, where
    // it sounded and as loud as it was.
    await stacked.click({ button: 'right' })
    await page
      .getByRole('menuitem', {
        name: 'Explode takes to new lanes',
        exact: true,
      })
      .click()
    await expect(studio.locator('[data-studio-track]')).toHaveCount(3)
    await expect
      .poll(async () => (await readStudioProject(page)).tracks.length)
      .toBe(3)
    const project = await readStudioProject(page)
    const lanes = [...project.tracks].sort((a, b) => a.order - b.order)
    expect(lanes.map((each) => each.name)).toEqual([
      'Phrase',
      'Lane 2',
      'Take 1',
    ])
    expect(firstClip(project, lane)).toMatchObject({ assetId: two })
    expect(firstClip(project, lane).takes).toBeUndefined()
    expect(firstClip(project, lanes[2].id)).toMatchObject({
      assetId: one,
      gainDb: -60,
    })
    await studio
      .getByRole('button', { name: 'Undo explode takes', exact: true })
      .click()
    await expect(studio.locator('[data-studio-track]')).toHaveCount(2)
    await expect(stacked).toHaveCount(1)
  })

  test('Crop to this take and Explode takes to new lanes from the bar’s Takes list leave the focus on the clip, by keyboard alone @smoke', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    const { studio } = await recordTwoTakes(page)
    const stacked = studio.getByRole('button', {
      name: /^Lane 2, Take 2\.wav, take 2 of 2, /,
    })
    const cropped = studio.getByRole('button', {
      name: /^Lane 2, Take 2\.wav, 0:00/,
    })
    const takes = studio.getByRole('button', { name: 'Takes', exact: true })
    const menu = page.getByRole('menu', { name: 'Takes', exact: true })
    const row = (name: string) =>
      menu.getByRole('menuitem', { name, exact: true })

    // Enter selects the clip, and Enter on its bar's Takes opens the list on
    // the take that plays.
    await stacked.focus()
    await page.keyboard.press('Enter')
    await takes.focus()
    await page.keyboard.press('Enter')
    await expect(menu.getByRole('menuitemradio').nth(1)).toBeFocused()

    // Crop to this take is the last row. It takes the button away with the
    // takes, and the clip has the focus.
    await page.keyboard.press('End')
    await expect(row('Crop to this take')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(takes).toHaveCount(0)
    await expect(cropped).toBeFocused()

    // Undo brings the takes back, and the button. Explode is the row above
    // Crop, and leaves the focus on the clip too.
    await page.keyboard.press('ControlOrMeta+z')
    await expect(stacked).toHaveCount(1)
    await takes.focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('End')
    await page.keyboard.press('ArrowUp')
    await expect(row('Explode takes to new lanes')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(studio.locator('[data-studio-track]')).toHaveCount(3)
    await expect(takes).toHaveCount(0)
    await expect(cropped).toBeFocused()
  })

  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ] as const)
    test(`a take recorded over a clip covers the clip's name, so only the take's own name reads, at ${width} wide @smoke`, async ({
      page,
    }) => {
      test.setTimeout(180_000)
      let covered = false
      let alone: boolean | null = null
      await recordTwoTakes(
        page,
        async () => {
          const studio = studioRegion(page)
          const live = studio.locator('[data-studio-live-take] span').first()
          await expect(live).toHaveText('Take 2')
          const under = studio
            .getByRole('button', { name: /^Lane 2, Take 1\.wav, / })
            .locator(':scope > span')
            .first()
          await expect(under).toHaveText('Take 1')
          const a = (await live.boundingBox())!
          const b = (await under.boundingBox())!
          // The take starts where Take 1 does, so the two names share a spot.
          covered =
            a.x < b.x + b.width &&
            b.x < a.x + a.width &&
            a.y < b.y + b.height &&
            b.y < a.y + a.height
          // The part of the take's name band the clip's name sits under: the
          // same pixels with that name drawn or not, when nothing reads through.
          const clip = {
            x: Math.max(a.x, b.x),
            y: Math.max(a.y, b.y),
            width: 48,
            height:
              Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
          }
          const drawn = await page.screenshot({ clip })
          await under.evaluate((name) => {
            ;(name as HTMLElement).style.color = 'transparent'
          })
          const blank = await page.screenshot({ clip })
          await under.evaluate((name) => {
            ;(name as HTMLElement).style.color = ''
          })
          alone = drawn.equals(blank)
        },
        { width, height },
      )
      expect(covered).toBe(true)
      expect(alone).toBe(true)
    })
})

// Current runner entry proof — normal navigation shares geometry and credit without moving saved checkpoints.
import { expect, test, type Page } from '@playwright/test'
import { MUSEUM_CAMPAIGN } from '../../../packages/glass-game/src/content/campaign'
import { CURRENT_SINGING_COURSE } from '../../../packages/glass-game/src/runner/current-course'
import { SINGING_CURRENT } from '../../../packages/glass-game/src/runner/first-course'
import { createRunnerTargetQuality, readSavedRunnerProgress, } from '../../../packages/glass-game/src/runner/progress'

const target = SINGING_CURRENT.targets[0]!
const earlier = {
  ...readSavedRunnerProgress(SINGING_CURRENT, null),
  completed: true,
  bestTargetQualities: [
    createRunnerTargetQuality(
      SINGING_CURRENT,
      target.id,
      3,
      target.notes.reduce(
        (total, note) => total + note.minimumReliableSeconds,
        0,
      ),
      10,
    ),
  ],
  collectedRewardIds: [
    SINGING_CURRENT.rewards.pickups[0]!.id,
    SINGING_CURRENT.rewards.finishRewardIds[0]!,
  ],
}
const earlierKey = `beside-cue:glass-adventure:runner-progress:v1:${SINGING_CURRENT.id}`
const currentKey = `beside-cue:glass-adventure:runner-progress:v1:${CURRENT_SINGING_COURSE.id}`

async function expectCurrentCourse(page: Page) {
  const runner = page.getByTestId('song-runner')
  await expect(runner).toHaveAttribute(
    'data-course-id',
    CURRENT_SINGING_COURSE.id,
  )
  await expect(runner).toHaveAttribute('data-movement-mode', 'continuous')
  await expect(runner).toHaveAttribute('data-camera-profile', 'steering-angled')
  await expect(runner).toHaveAttribute('data-course-seconds', '0.000')
  await expect(
    page.getByRole('button', { name: 'Start course', exact: true }),
  ).toBeEnabled({ timeout: 60_000 })
  await expect(
    page.getByTestId('song-runner-scene').locator('canvas'),
  ).toBeVisible()
  await expect(
    page.getByText('Earlier course record kept', { exact: true }),
  ).toBeVisible()
}

async function leaveCourse(page: Page) {
  await page
    .getByRole('dialog', { name: 'Ready when you are', exact: true })
    .getByRole('button', { name: 'Leave course', exact: true })
    .click()
  await expect(page.getByTestId('song-runner')).toHaveCount(0)
}

test.use({ viewport: { width: 390, height: 844 } })
test('default, museum and both Games entries share the current runner and preserve earlier credit @smoke', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  const obstacleLoads = new Set<string>()
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('response', (response) => {
    if (response.ok() && response.url().includes('/runner-obstacles-v1/'))
      obstacleLoads.add(new URL(response.url()).pathname.split('/').at(-1)!)
  })
  const gallery = MUSEUM_CAMPAIGN[0]!.level
  const galleryKey = `beside-cue:glass-adventure:progress:${gallery.id}`
  const gallerySave = JSON.stringify({
    version: 2,
    levelId: gallery.id,
    checkpointId: gallery.checkpoints.at(-1)!.id,
    completedBreakableIds: gallery.breakables.map((item) => item.id),
    finished: true,
  })
  await page.addInitScript(
    ({ earlierKey, earlier, galleryKey, gallerySave }) => {
      if (localStorage.getItem(earlierKey) === null)
        localStorage.setItem(earlierKey, earlier)
      if (localStorage.getItem(galleryKey) === null)
        localStorage.setItem(galleryKey, gallerySave)
      localStorage.setItem('beside-cue:glass-adventure:tutorial', 'seen')
    },
    { earlierKey, earlier: JSON.stringify(earlier), galleryKey, gallerySave },
  )

  await page.goto('/glass-game/?layout=singing-current')
  await expectCurrentCourse(page)
  await page.getByText('Earlier course record kept', { exact: true }).click()
  await expect(
    page.getByText(/This route starts at the beginning/u),
  ).toBeVisible()
  await page.screenshot({
    path: info.outputPath('current-entry-earlier-record.png'),
  })
  await leaveCourse(page)

  await page.goto('/glass-game/?campaign=1&progression=earned')
  await page
    .getByRole('button', { name: 'Play The Singing Current', exact: true })
    .click()
  await expectCurrentCourse(page)
  await leaveCourse(page)
  await expect(
    page.getByRole('button', { name: 'Play The Singing Current', exact: true }),
  ).toBeVisible()

  await page.goto('/?devSeed&cold')
  await page.getByRole('button', { name: /B-side games/u }).click()
  for (const name of [/The Singing Current/u, /Crystal Current/u]) {
    await page.getByRole('button', { name }).click()
    await expectCurrentCourse(page)
    await leaveCourse(page)
    await expect(
      page.getByRole('heading', { name: 'A small game, sung.' }),
    ).toBeVisible()
  }
  expect(obstacleLoads).toEqual(
    new Set(['glacial-bulwark.glb', 'rose-wave-hurdle.glb']),
  )
  const saved = await page.evaluate(
    ({ earlierKey, currentKey, galleryKey }) => ({
      earlier: localStorage.getItem(earlierKey),
      current: JSON.parse(localStorage.getItem(currentKey) ?? 'null'),
      gallery: localStorage.getItem(galleryKey),
      runnerKeys: Object.keys(localStorage)
        .filter((key) => key.includes('runner-progress:'))
        .sort(),
    }),
    { earlierKey, currentKey, galleryKey },
  )
  expect(saved.earlier).toBe(JSON.stringify(earlier))
  expect(saved.gallery).toBe(gallerySave)
  expect(saved.runnerKeys).toEqual([currentKey, earlierKey].sort())
  expect(saved.current.bestTargetQualities).toEqual([
    {
      ...earlier.bestTargetQualities[0],
      courseRevision: CURRENT_SINGING_COURSE.revision,
    },
  ])
  expect(saved.current.collectedRewardIds).toEqual(
    [
      CURRENT_SINGING_COURSE.rewards.pickups[0]!.id,
      CURRENT_SINGING_COURSE.rewards.finishRewardIds[0]!,
    ].sort(),
  )
  expect(saved.current.completed).toBe(true)
  expect(errors).toEqual([])
})

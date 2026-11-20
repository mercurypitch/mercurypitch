// Studio playhead steadiness — a six-lane song like a real one plays while its line and cap are read every frame: they move on with the song and never step back, with the page at full speed and slowed four times.
//
// maff's report (20 Nov 2026): on his own songs the playhead flickered back
// and forth while it played, the sound fine. The line's clock read the
// output timestamp's render time as heard now even when Chromium dated the
// stamp ahead of the call, by up to 48 ms on a six-lane song, so it jumped
// about from tick to tick (heard-clock.ts); the line started again wherever
// it read, and stood on the readouts' older frame whenever the jump passed
// 50 ms (playhead-motion.ts).
//
// PLAYHEAD_OUT starts the name of a JSON file per test (-t1.json, -t4.json)
// for every frame read, and the bundle read.
import { writeFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { createStudioTrack, summarizeStudioProject, } from '@/lib/studio/model/defaults'
import type { StudioClip, StudioProject, StudioTrack, } from '@/lib/studio/model/types'
import { readStudioProject, setStudioZoom, STUDIO_RATE, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { perfTakeWav } from './helpers/studio-perf'
import { dismissOverlays, waitForNav } from './helpers/ui'

const S = STUDIO_RATE
/** The zoom stop nearest the report's 90 px a second. */
const ZOOM = 80
const SONG_SECONDS = 90

const TAKES = [
  { name: 'test', seconds: 20, hz: 220 },
  { name: 'Lane 2', seconds: 12, hz: 330 },
  { name: 'Lane 4', seconds: 7, hz: 440 },
  { name: '18 - Broken Arrows', seconds: SONG_SECONDS, hz: 110 },
] as const

function clip(
  track: StudioTrack,
  assetId: string,
  [start, from, to]: readonly [number, number, number],
  fades: StudioClip['fades'] = { curve: 'linear-amplitude' },
): StudioClip {
  return {
    id: crypto.randomUUID(),
    trackId: track.id,
    assetId,
    startFrame: Math.round(start * S),
    sourceInFrame: Math.round(from * S),
    sourceOutFrame: Math.round(to * S),
    gainDb: 0,
    fades,
  }
}

/**
 * The report's six lanes: two clips on one, a take fading out, two empty
 * lanes, a short take and a whole song.
 */
function arrange(project: StudioProject): StudioProject {
  const asset = (name: string) =>
    project.clips.find(
      (each) =>
        project.tracks.find((track) => track.id === each.trackId)?.name ===
        name,
    )!.assetId
  const lanes = [
    'test',
    'Lane 2',
    '18 - Broken',
    '18 - Broken 2',
    'Lane 4',
    '18 - Broken Arrows',
  ].map((name, order) =>
    createStudioTrack({ id: crypto.randomUUID(), name, order, role: 'other' }),
  )
  const [first, second, , , fourth, song] = lanes
  return {
    ...project,
    revision: project.revision + 1,
    updatedAt: new Date().toISOString(),
    tracks: lanes,
    clips: [
      clip(first, asset('test'), [3.3, 0, 2.6]),
      clip(first, asset('test'), [6.9, 3, 11.1]),
      clip(second, asset('Lane 2'), [0, 0, 10.6], {
        curve: 'linear-amplitude',
        out: { fromSourceFrame: 7 * S, toSourceFrame: 10.6 * S },
      }),
      clip(fourth, asset('Lane 4'), [9.9, 0, 5.8]),
      clip(song, asset('18 - Broken Arrows'), [1.2, 0, SONG_SECONDS]),
    ],
  }
}

async function saveDocument(page: Page, project: StudioProject): Promise<void> {
  await page.evaluate(
    async ({ document, summary }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('MercuryPitchDB')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction(
            ['studioProjects', 'studioProjectSummaries'],
            'readwrite',
          )
          transaction.objectStore('studioProjects').put(document)
          transaction.objectStore('studioProjectSummaries').put(summary)
          transaction.oncomplete = () => resolve()
          transaction.onerror = () => reject(transaction.error)
        })
      } finally {
        database.close()
      }
    },
    { document: project, summary: summarizeStudioProject(project) },
  )
}

/** Import the takes, lay them out as the report's song and open it from the list. */
async function openSixLaneSong(page: Page): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
  })
  await page.goto('/studio-night')
  await waitForNav(page, 30_000)
  await dismissOverlays(page)
  const studio = studioRegion(page)
  await studio
    .getByRole('button', { name: 'Create project', exact: true })
    .click()
  // As files on disk: a Buffer is decoded from base64 in the page.
  for (const take of TAKES) {
    const file = test.info().outputPath(`${take.name}.wav`)
    writeFileSync(file, perfTakeWav(take.seconds, take.hz, take.hz))
    await studio.getByLabel('Upload audio', { exact: true }).setInputFiles(file)
    await expect(
      studio.getByRole('button', { name: `${take.name} details`, exact: true }),
    ).toBeVisible({ timeout: 60_000 })
    await expect(
      studio.getByText('Saved in this browser', { exact: true }),
    ).toBeVisible({ timeout: 60_000 })
  }
  const arranged = arrange(await readStudioProject(page))
  await saveDocument(page, arranged)
  await page.reload()
  await waitForNav(page, 30_000)
  await dismissOverlays(page)
  await studio.getByRole('button', { name: /^Untitled song/ }).click()
  await expect(studio.locator('[data-studio-clip]')).toHaveCount(
    arranged.clips.length,
    { timeout: 120_000 },
  )
  await setStudioZoom(page, ZOOM)
}

interface Frame {
  t: number
  line: number
  cap: number
  /** The line's own style: set while it stands, empty while an animation moves it. */
  inline: string
}

/** Where the line and its cap are drawn on every animation frame for `ms`. */
async function readFrames(page: Page, ms: number): Promise<Frame[]> {
  return page.evaluate(async (wait) => {
    const playhead = (part: string) =>
      document.querySelector<HTMLElement>(`[data-studio-playhead="${part}"]`)!
    const x = (element: HTMLElement) =>
      new DOMMatrixReadOnly(getComputedStyle(element).transform).m41
    const frames: Frame[] = []
    const started = performance.now()
    await new Promise<void>((resolve) => {
      const frame = (t: number) => {
        const line = playhead('line')
        frames.push({
          t,
          line: x(line),
          cap: x(playhead('cap')),
          inline: line.style.transform,
        })
        if (performance.now() - started < wait) requestAnimationFrame(frame)
        else resolve()
      }
      requestAnimationFrame(frame)
    })
    return frames
  }, ms)
}

/** Every frame on which the line moved back, and every one on which it leapt more than 20 ms ahead. */
function steps(frames: readonly Frame[]) {
  const back: { at: number; px: number }[] = []
  const leaps: { at: number; px: number }[] = []
  for (let i = 1; i < frames.length; i++) {
    const moved = frames[i].line - frames[i - 1].line
    const due = ((frames[i].t - frames[i - 1].t) / 1000) * ZOOM
    if (moved < -0.001) back.push({ at: frames[i].t, px: moved })
    else if (moved - due > 0.02 * ZOOM)
      leaps.push({ at: frames[i].t, px: moved - due })
  }
  return { back, leaps }
}

async function playAndRead(page: Page, throttle: number): Promise<Frame[]> {
  if (throttle > 1) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle })
  }
  const studio = studioRegion(page)
  const toggle = studio.getByRole('button', { name: /^(Play|Pause) song$/ })
  await expect(toggle).toBeEnabled({ timeout: 60_000 })
  // A real press, as a hand would, read from before it: the line stands
  // while the first frames are on their way to the speakers, then moves.
  const box = (await toggle.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  const reading = readFrames(page, 9000)
  await page.mouse.down()
  await page.mouse.up()
  await expect(toggle).toHaveAccessibleName('Pause song', { timeout: 30_000 })
  const frames = await reading
  const out = process.env.PLAYHEAD_OUT
  if (out) {
    const bundle = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((name) => /StudioPage-[^/]+\.js$/.test(name)),
    )
    writeFileSync(
      `${out}-t${throttle}.json`,
      JSON.stringify(
        { bundle, zoom: ZOOM, throttle, ...steps(frames), frames },
        null,
        1,
      ),
    )
  }
  return frames
}

function expectSteady(frames: readonly Frame[]): void {
  // Standing is fine; a step back, from the press on, is not.
  expect(steps(frames).back, 'frames on which the line stepped back').toEqual(
    [],
  )
  // The cap moves with the line on every frame.
  for (const frame of frames)
    expect(Math.abs(frame.cap - frame.line)).toBeLessThan(0.01)
  // Once it moves, it moves with the song, never standing on its own style
  // again, nor leaping ahead to catch up.
  const start = frames.findIndex((frame) => frame.inline === '')
  expect(start, 'the frame on which the line began to move').toBeGreaterThan(0)
  const moving = frames.slice(start)
  expect(moving.filter((frame) => frame.inline !== '')).toEqual([])
  expect(
    steps(moving).leaps.length,
    'frames on which the line leapt ahead',
  ).toBeLessThanOrEqual(2)
  const first = moving[0]
  const last = moving[moving.length - 1]
  const seconds = (last.t - first.t) / 1000
  expect(seconds).toBeGreaterThan(5)
  const speed = (last.line - first.line) / ZOOM / seconds
  expect(speed).toBeGreaterThan(0.95)
  expect(speed).toBeLessThan(1.05)
}

test.describe('Studio playhead steadiness', () => {
  test.use({ viewport: { width: 1600, height: 900 } })

  test('a six-lane song’s playhead moves on with the song and never steps back @smoke', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    await openSixLaneSong(page)
    expectSteady(await playAndRead(page, 1))
  })

  test('a six-lane song’s playhead never steps back on a page slowed four times', async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await openSixLaneSong(page)
    expectSteady(await playAndRead(page, 4))
  })
})

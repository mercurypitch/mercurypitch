// Studio performance — a medium song (12 lanes, almost five minutes, 44 clips, every role's chain) imported, opened, played, sought, dragged, scrolled and zoomed, with what each step cost the page. Runs only when asked.
//
// STUDIO_PERF=1 runs it; it is a measurement, not a gate, so CI skips it.
// STUDIO_PERF_EXPORT=1 adds a WAV export of the whole song (minutes long).
// STUDIO_PERF_OUT names the JSON file the readings go to, and
// STUDIO_PERF_LABEL what the run was (a build, a branch). Point
// VITE_E2E_PORT at a `serve` of another build to read that one the same way.
//
// The song is built through the real import, one take per lane, then laid
// out by writing the saved document, the way a person with a finished song
// would have it, and opened again from the project list: that open is the
// one measured.
import { readFileSync, writeFileSync } from 'node:fs'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { createStudioTrack, summarizeStudioProject, } from '@/lib/studio/model/defaults'
import type { StudioClip, StudioProject } from '@/lib/studio/model/types'
import type { TrackRole } from '@/lib/studio-fx/role-chains'
import { readStudioProject, STUDIO_RATE, studioRegion, timelineViewport, } from './helpers/dedicatedstudio-fixture'
import { audioClock, captureStudioOutput, untilAudioClock, } from './helpers/studio-output-capture'
import type { PhaseReading } from './helpers/studio-perf'
import { firstSoundAfter, installPerfProbes, lastPress, measurePhase, openCpuCounters, perfTakeWav, readGlitches, } from './helpers/studio-perf'
import { dismissOverlays, waitForNav } from './helpers/ui'

const ROLES: readonly TrackRole[] = [
  'voice',
  'backing-vocals',
  'acoustic-guitar',
  'electric-guitar',
  'bass',
  'piano',
  'keys',
  'drums',
  'backing',
  'other',
  'voice',
  'keys',
]
const TONES = [330, 523, 659, 784, 110, 262, 440, 98, 196, 587, 349, 880]
const TAKE_SECONDS = 75

/** Four clips a lane on the first eight lanes and three on the rest, 75 s apart, the later ones fading in. */
function arrange(project: StudioProject): StudioProject {
  const tracks = [...project.tracks].sort((a, b) => a.order - b.order)
  const clips: StudioClip[] = []
  tracks.forEach((track, lane) => {
    const take = project.clips.find((clip) => clip.trackId === track.id)!
    for (let slot = 0; slot < (lane < 8 ? 4 : 3); slot++) {
      const sourceIn = slot * 5 * STUDIO_RATE
      clips.push({
        id: crypto.randomUUID(),
        trackId: track.id,
        assetId: take.assetId,
        startFrame: slot * 75 * STUDIO_RATE,
        sourceInFrame: sourceIn,
        sourceOutFrame: sourceIn + 60 * STUDIO_RATE,
        gainDb: 0,
        fades:
          slot === 0
            ? { curve: 'linear-amplitude' }
            : {
                curve: 'linear-amplitude',
                in: {
                  fromSourceFrame: sourceIn,
                  toSourceFrame: sourceIn + STUDIO_RATE / 2,
                },
              },
      })
    }
  })
  return {
    ...project,
    revision: project.revision + 1,
    updatedAt: new Date().toISOString(),
    tracks: tracks.map((track, lane) =>
      createStudioTrack({
        id: track.id,
        name: track.name,
        order: track.order,
        role: ROLES[lane],
      }),
    ),
    clips,
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

/** A real press and release at the middle of a control, as a hand would. */
async function press(page: Page, target: Locator): Promise<number> {
  const box = (await target.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.up()
  return lastPress(page)
}

/** Every clip's waveform in view has drawn, and none is still loading. */
async function waveformsDrawn(page: Page, count: number): Promise<void> {
  await page.waitForFunction(
    (expected) => {
      const viewport = document.querySelector('[data-studio-timeline-viewport]')
      if (!viewport) return false
      const states = [...viewport.querySelectorAll('span')].map(
        (span) => span.textContent,
      )
      return (
        !states.includes('Loading waveform') &&
        states.filter((text) => text === 'Audio waveform').length >= expected
      )
    },
    count,
    { timeout: 180_000, polling: 100 },
  )
}

/** The highest peak resident memory of any renderer process so far, in MiB (Linux). */
async function rendererPeakMb(page: Page): Promise<number | null> {
  try {
    const browser = page.context().browser()
    if (!browser) return null
    const session = await browser.newBrowserCDPSession()
    const { processInfo } = (await session.send(
      'SystemInfo.getProcessInfo',
    )) as { processInfo: { type: string; id: number }[] }
    await session.detach()
    let peak = 0
    for (const process of processInfo.filter(
      ({ type }) => type === 'renderer',
    )) {
      const status = readFileSync(`/proc/${process.id}/status`, 'utf8')
      const kb = Number(/VmHWM:\s+(\d+)/.exec(status)?.[1] ?? 0)
      peak = Math.max(peak, kb / 1024)
    }
    return Math.round(peak)
  } catch {
    return null
  }
}

test.describe('Studio performance', () => {
  test.skip(
    !process.env.STUDIO_PERF,
    'A measurement, not a gate: run with STUDIO_PERF=1.',
  )
  test.use({ viewport: { width: 1440, height: 900 } })

  test('a medium song: import, open, Play, seek, drag, scroll and zoom', async ({
    page,
    browserName,
  }) => {
    test.setTimeout(30 * 60_000)
    await installPerfProbes(page)
    await captureStudioOutput(page)
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
    const cdp = await openCpuCounters(page)
    const readings: Record<string, unknown> = {
      label: process.env.STUDIO_PERF_LABEL ?? null,
      browser: `${browserName} ${page.context().browser()?.version() ?? ''}`,
      lanes: ROLES.length,
      takeSeconds: TAKE_SECONDS,
    }

    // One take a lane, through the real import. The takes go in as files on
    // disk: a Buffer would be decoded from base64 in the page, a 300 ms task
    // of Playwright's own inside every reading.
    const imports: PhaseReading[] = []
    for (const [lane, hz] of TONES.entries()) {
      const file = test.info().outputPath(`Take ${lane + 1}.wav`)
      writeFileSync(file, perfTakeWav(TAKE_SECONDS, hz, lane + 1))
      imports.push(
        await measurePhase(page, cdp, `import${lane + 1}`, async () => {
          await studio
            .getByLabel('Upload audio', { exact: true })
            .setInputFiles(file)
          await expect(
            studio.getByRole('button', {
              name: `Take ${lane + 1} details`,
              exact: true,
            }),
          ).toBeVisible({ timeout: 60_000 })
          await expect(
            studio.getByText('Saved in this browser', { exact: true }),
          ).toBeVisible({ timeout: 60_000 })
        }),
      )
    }
    readings.imports = imports

    const arranged = arrange(await readStudioProject(page))
    await saveDocument(page, arranged)
    await page.reload()
    await waitForNav(page, 30_000)
    await dismissOverlays(page)
    const openSong = studio.getByRole('button', { name: /^Untitled song/ })
    await expect(openSong).toBeVisible()
    readings.open = await measurePhase(page, cdp, 'open', async () => {
      await openSong.click()
      await expect(studio.locator('[data-studio-clip]')).toHaveCount(
        arranged.clips.length,
        { timeout: 120_000 },
      )
      await waveformsDrawn(page, ROLES.length)
    })
    readings.rendererPeakMbAfterOpen = await rendererPeakMb(page)

    const toggle = studio.getByRole('button', { name: /^(Play|Pause) song$/ })
    await expect(toggle).toBeEnabled({ timeout: 60_000 })
    let coldStart: Awaited<ReturnType<typeof firstSoundAfter>> | undefined
    readings.playStart = await measurePhase(
      page,
      cdp,
      'playStart',
      async () => {
        coldStart = await firstSoundAfter(page, await press(page, toggle), 4000)
      },
    )
    readings.coldFirstSound = coldStart
    await expect(toggle).toHaveAccessibleName('Pause song')

    const glitchesBefore = await readGlitches(page)
    readings.playing = await measurePhase(
      page,
      cdp,
      'playing',
      async () => untilAudioClock(page, (await audioClock(page)) + 8),
      { frames: true },
    )
    const glitchesAfter = await readGlitches(page)
    readings.glitchesWhilePlaying = {
      supported: glitchesAfter.supported,
      underrunEvents:
        glitchesAfter.underrunEvents === null
          ? null
          : glitchesAfter.underrunEvents - (glitchesBefore.underrunEvents ?? 0),
      underrunMs:
        glitchesAfter.underrunMs === null
          ? null
          : glitchesAfter.underrunMs - (glitchesBefore.underrunMs ?? 0),
    }

    const ruler = studio.getByRole('slider', { name: 'Song playhead' })
    readings.seeks = await measurePhase(
      page,
      cdp,
      'seeks',
      async () => {
        const box = (await ruler.boundingBox())!
        for (const share of [0.2, 0.6, 0.35, 0.8, 0.1, 0.5]) {
          await page.mouse.move(box.x + box.width * share, box.y + 4)
          await page.mouse.down()
          await page.mouse.up()
          await untilAudioClock(page, (await audioClock(page)) + 1)
        }
      },
      { frames: true },
    )

    // Drag the sixth lane's first clip three seconds later, as a hand does.
    const lane = studio.locator('[data-studio-track]').nth(5)
    const clip = lane.locator('[data-studio-clip]').first()
    await clip.click({ position: { x: 200, y: 20 } })
    const clipBox = (await clip.boundingBox())!
    readings.drag = await measurePhase(
      page,
      cdp,
      'drag',
      async () => {
        const x = clipBox.x + 200
        const y = clipBox.y + clipBox.height / 2
        await page.mouse.move(x, y)
        await page.mouse.down()
        for (let step = 1; step <= 40; step++) {
          await page.mouse.move(x + step * 3, y)
          await page.evaluate(
            () => new Promise((resolve) => requestAnimationFrame(resolve)),
          )
        }
        await page.mouse.up()
        await expect(
          studio.getByText('Saved in this browser', { exact: true }),
        ).toBeVisible()
      },
      { frames: true },
    )

    const viewport = timelineViewport(page)
    readings.scroll = await measurePhase(
      page,
      cdp,
      'scroll',
      () =>
        viewport.evaluate(
          (element) =>
            new Promise<void>((resolve) => {
              let step = 0
              const next = () => {
                element.scrollLeft += 40
                if (++step < 90) requestAnimationFrame(next)
                else resolve()
              }
              requestAnimationFrame(next)
            }),
        ),
      { frames: true },
    )

    readings.zoom = await measurePhase(
      page,
      cdp,
      'zoom',
      async () => {
        for (let step = 0; step < 4; step++) {
          await studio
            .getByRole('button', { name: 'Zoom in', exact: true })
            .click()
          await untilAudioClock(page, (await audioClock(page)) + 0.5)
        }
      },
      { frames: true },
    )

    // Pause keeps the graph: Play again starts it without a build.
    await press(page, toggle)
    await expect(toggle).toHaveAccessibleName('Play song')
    await untilAudioClock(page, (await audioClock(page)) + 1)
    let keptStart: Awaited<ReturnType<typeof firstSoundAfter>> | undefined
    readings.playAgain = await measurePhase(
      page,
      cdp,
      'playAgain',
      async () => {
        keptStart = await firstSoundAfter(page, await press(page, toggle))
      },
    )
    readings.keptFirstSound = keptStart
    await press(page, toggle)
    await expect(toggle).toHaveAccessibleName('Play song')

    if (process.env.STUDIO_PERF_EXPORT) {
      await studio.getByRole('button', { name: 'Export', exact: true }).click()
      readings.export = await measurePhase(page, cdp, 'export', async () => {
        await studio
          .getByRole('button', { name: 'Export WAV', exact: true })
          .click()
        await expect(
          studio.getByRole('button', { name: 'Download WAV', exact: true }),
        ).toBeVisible({ timeout: 20 * 60_000 })
      })
      readings.rendererPeakMbAfterExport = await rendererPeakMb(page)
    }

    const out =
      process.env.STUDIO_PERF_OUT ?? test.info().outputPath('studio-perf.json')
    writeFileSync(out, JSON.stringify(readings, null, 2))
    console.log(`[studio-perf] ${JSON.stringify(readings)}`)
    expect(coldStart?.firstSoundMs).not.toBeNull()
    expect(keptStart?.firstSoundMs).not.toBeNull()
  })
})

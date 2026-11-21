// Studio playhead steadiness — a six-lane song like a real one plays while its line and cap are read every frame: with no seek the line never moves back, standing still at most, on a page at full speed, slowed four times, or with its threads stalled.
//
// maff's report (20 Nov 2026): on his own songs the playhead flickered back
// and forth while it played, the sound fine. The line's clock read the
// output timestamp's render time as heard now even when Chromium dated the
// stamp ahead of the call, by up to 48 ms on a six-lane song, so it jumped
// about from tick to tick (heard-clock.ts); the line started again wherever
// it read, and stood on the readouts' older frame whenever the jump passed
// 50 ms (playhead-motion.ts). A stall of the audio thread still stood it
// there, up to 168 ms back, until the line held its place through one.
//
// The checks ask only what the motion guarantees while the song plays on:
// the line may stand still, and jump forward to catch up, but never moves
// back.
//
// PLAYHEAD_THROTTLE slows the page of the first case (CPU throttling, 1 by
// default). PLAYHEAD_STALLS=1 runs the stalls, a measurement rather than a
// gate. PLAYHEAD_OUT starts the name of a JSON file per test for every frame
// read and the bundle read.
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

/**
 * Import the takes, lay them out as the report's song and open it from the
 * list; with `watchClock`, keep the context the playhead's clock reads.
 */
async function openSixLaneSong(page: Page, watchClock = false): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
  })
  if (watchClock)
    await page.addInitScript(() => {
      const read = AudioContext.prototype.getOutputTimestamp
      AudioContext.prototype.getOutputTimestamp = function (
        this: AudioContext,
      ) {
        ;(window as unknown as { studioClock?: AudioContext }).studioClock =
          this
        return read.call(this)
      }
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
  /** Where the readouts say the song is, in seconds. */
  song: number
}

/** A stall the page makes once the line moves: `at` ms after, for `ms`, on the main thread or the audio thread. */
interface Stall {
  at: number
  thread: 'main' | 'audio'
  ms: number
}

/** The main thread, then the audio thread, run late: 150 ms three times, then 150, 150 and 300 ms. */
const STALLS: Stall[] = [
  { at: 1500, thread: 'main', ms: 150 },
  { at: 2700, thread: 'main', ms: 150 },
  { at: 3900, thread: 'main', ms: 150 },
  { at: 5100, thread: 'audio', ms: 150 },
  { at: 6600, thread: 'audio', ms: 150 },
  { at: 8100, thread: 'audio', ms: 300 },
]

/** Where the line, its cap and the readouts are on every animation frame for `ms`, making `stalls` on the way. */
async function readFrames(page: Page, ms: number, stalls: Stall[]) {
  return page.evaluate(
    async ({ wait, stalls }) => {
      const playhead = (part: string) =>
        document.querySelector<HTMLElement>(`[data-studio-playhead="${part}"]`)!
      const x = (element: HTMLElement) =>
        new DOMMatrixReadOnly(getComputedStyle(element).transform).m41
      const ruler = () => document.querySelector('[aria-label="Song playhead"]')
      const frames: Frame[] = []
      const made: { at: number; thread: string; failed?: string }[] = []
      let worklet: AudioWorkletNode | null = null
      // A worklet that keeps the audio thread busy for as long as it is told.
      const late = `registerProcessor('late', class extends AudioWorkletProcessor {
  constructor() { super(); this.ms = 0; this.port.onmessage = (event) => { this.ms = event.data } }
  process() {
    const until = Date.now() + this.ms
    this.ms = 0
    while (Date.now() < until) {}
    return true
  }
})`
      const stall = async ({ thread, ms }: Stall) => {
        const entry: (typeof made)[number] = { at: performance.now(), thread }
        made.push(entry)
        if (thread === 'main') {
          const until = performance.now() + ms
          while (performance.now() < until) {
            // Busy, as a page doing other work is.
          }
          return
        }
        try {
          const ctx = (window as unknown as { studioClock?: AudioContext })
            .studioClock!
          if (!worklet) {
            await ctx.audioWorklet.addModule(
              URL.createObjectURL(
                new Blob([late], { type: 'text/javascript' }),
              ),
            )
            worklet = new AudioWorkletNode(ctx, 'late')
            worklet.connect(ctx.destination)
          }
          worklet.port.postMessage(ms)
        } catch (error) {
          entry.failed = String(error)
        }
      }
      const started = performance.now()
      let moving = false
      await new Promise<void>((resolve) => {
        const frame = (t: number) => {
          const line = playhead('line')
          frames.push({
            t,
            line: x(line),
            cap: x(playhead('cap')),
            song: Number(ruler()?.getAttribute('aria-valuenow')),
          })
          if (!moving && line.style.transform === '') {
            moving = true
            for (const each of stalls)
              setTimeout(() => void stall(each), each.at)
          }
          if (performance.now() - started < wait) requestAnimationFrame(frame)
          else resolve()
        }
        requestAnimationFrame(frame)
      })
      return { frames, made }
    },
    { wait: ms, stalls },
  )
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

async function playAndRead(
  page: Page,
  throttle: number,
  stalls: Stall[] = [],
): Promise<Frame[]> {
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
  const reading = readFrames(page, stalls.length > 0 ? 11_000 : 9000, stalls)
  await page.mouse.down()
  await page.mouse.up()
  await expect(toggle).toHaveAccessibleName('Pause song', { timeout: 30_000 })
  const { frames, made } = await reading
  const out = process.env.PLAYHEAD_OUT
  if (out) {
    const bundle = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((name) => /StudioPage-[^/]+\.js$/.test(name)),
    )
    writeFileSync(
      `${out}-${stalls.length > 0 ? 'stalls' : 'play'}-t${throttle}.json`,
      JSON.stringify(
        { bundle, zoom: ZOOM, throttle, made, ...steps(frames), frames },
        null,
        1,
      ),
    )
  }
  // Every stall was made: a worklet that failed to load stalls nothing.
  expect(made.filter((each) => each.failed !== undefined)).toEqual([])
  expect(made).toHaveLength(stalls.length)
  return frames
}

function expectSteady(frames: readonly Frame[]): void {
  // With no seek the line never moves back: it may stand still through a
  // stall, and jump forward to catch up.
  expect(steps(frames).back, 'frames on which the line stepped back').toEqual(
    [],
  )
  // The cap moves with the line on every frame.
  for (const frame of frames)
    expect(Math.abs(frame.cap - frame.line)).toBeLessThan(0.01)
  // It went with the song, ending within a second of where the readouts
  // say the song is, the song having played on for 3 s or more.
  const first = frames[0]
  const last = frames[frames.length - 1]
  expect(last.song - first.song).toBeGreaterThan(3)
  expect(Math.abs(last.line / ZOOM - last.song)).toBeLessThan(1)
}

/** The first case's CPU throttling, to try it on a slower page. */
const THROTTLE = Number(process.env.PLAYHEAD_THROTTLE ?? 1)

test.describe('Studio playhead steadiness', () => {
  test.use({ viewport: { width: 1600, height: 900 } })

  test('a six-lane song’s playhead never moves back while it plays @smoke', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    await openSixLaneSong(page)
    expectSteady(await playAndRead(page, THROTTLE))
  })

  test('a six-lane song’s playhead never moves back on a page slowed four times', async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await openSixLaneSong(page)
    expectSteady(await playAndRead(page, 4))
  })

  test('a six-lane song’s playhead holds still through stalls of the main and audio threads, and never moves back', async ({
    page,
  }) => {
    test.skip(
      !process.env.PLAYHEAD_STALLS,
      'A measurement, not a gate: run with PLAYHEAD_STALLS=1.',
    )
    test.setTimeout(240_000)
    await openSixLaneSong(page, true)
    expectSteady(await playAndRead(page, THROTTLE, STALLS))
  })
})

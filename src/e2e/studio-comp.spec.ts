// Studio comping — a loop take's passes comped by a mouse swipe, by keys and by a phone's taps: the clip plays the comp, and Export renders it.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { type Download, expect, type Locator, type Page, test, } from '@playwright/test'
import type { StudioClip } from '../lib/studio/model/types'
import { openArrangement, readStudioProject, setClipStart, studioClip, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { audioClock, captureStudioOutput, untilAudioClock, } from './helpers/studio-output-capture'
import { captureSpan } from './helpers/studio-output-span'
import { fakeMicArgs } from './helpers/tone-wav'

const RATE = 48_000
/** The range the take loops over: the Phrase clip, moved to 6 s, four seconds long. */
const IN = 6 * RATE
const OUT = 10 * RATE

/**
 * The microphone sings three steady tones, four seconds each, round and
 * round. A pass is four seconds too, so each holds the end of one tone and
 * the start of the next, and at any moment of the range the three passes
 * sing three different tones: the tone heard says which pass plays.
 */
const TONES = [300, 370, 450] as const
const STEP_SECONDS = 4

function cycleWav(): string {
  const frames = TONES.length * STEP_SECONDS * RATE
  const buf = Buffer.alloc(44 + frames * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + frames * 2, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(RATE, 24)
  buf.writeUInt32LE(RATE * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(frames * 2, 40)
  let phase = 0
  for (let i = 0; i < frames; i++) {
    phase += (2 * Math.PI * TONES[Math.floor(i / (STEP_SECONDS * RATE))]) / RATE
    buf.writeInt16LE(Math.round(Math.sin(phase) * 16_000), 44 + i * 2)
  }
  // Beside it, then renamed into place: every worker writes it at load.
  const file = path.join(os.tmpdir(), 'mercurypitch-e2e-comp-cycle.wav')
  const scratch = `${file}.${process.pid}.tmp`
  fs.writeFileSync(scratch, buf)
  fs.renameSync(scratch, file)
  return file
}

const MIC = cycleWav()

test.use({
  launchOptions: { args: fakeMicArgs(MIC) },
  permissions: ['microphone'],
  viewport: { width: 1440, height: 900 },
})

/** 40 ms windows, every 20 ms: a 25 Hz bin tells the tones apart. */
const WINDOW = 1920
const HOP = 960

/** Which of the tones stands out over a window, or -1 when none does. */
function toneAt(samples: Float32Array, at: number): number {
  if (at < 0 || at + WINDOW > samples.length) return -1
  const levels = TONES.map((hz) => {
    const k = (2 * Math.PI * hz) / RATE
    const coefficient = 2 * Math.cos(k)
    let previous = 0
    let before = 0
    for (let i = at; i < at + WINDOW; i++) {
      const next = samples[i] + coefficient * previous - before
      before = previous
      previous = next
    }
    return Math.hypot(previous - before * Math.cos(k), before * Math.sin(k))
  })
  const best = Math.max(...levels)
  const second = Math.max(...levels.filter((level) => level !== best))
  return best > 0.5 && best > 4 * second ? levels.indexOf(best) : -1
}

/** The take's audio as Studio keeps it: canonical PCM, its first channel. */
async function takeAudio(page: Page, clip: StudioClip): Promise<Float32Array> {
  const base64 = await page.evaluate(async (assetId) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('MercuryPitchDB')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const rows = await new Promise<
        { assetId: string; kind: string; data: ArrayBuffer }[]
      >((resolve, reject) => {
        const request = database
          .transaction('studioAssetBlobs', 'readonly')
          .objectStore('studioAssetBlobs')
          .getAll()
        request.onsuccess = () =>
          resolve(
            request.result as {
              assetId: string
              kind: string
              data: ArrayBuffer
            }[],
          )
        request.onerror = () => reject(request.error)
      })
      const row = rows.find(
        (item) => item.assetId === assetId && item.kind === 'canonical',
      )
      if (!row) throw new Error('The take has no canonical audio.')
      const bytes = new Uint8Array(row.data)
      let binary = ''
      for (let i = 0; i < bytes.length; i += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      return btoa(binary)
    } finally {
      database.close()
    }
  }, clip.assetId)
  const bytes = Buffer.from(base64, 'base64')
  const frames = bytes.readUInt32LE(20) / 4
  const copy = new Uint8Array(bytes.subarray(32, 32 + frames * 4))
  return new Float32Array(copy.buffer)
}

/** The pass playing at one of the clip's own source frames: its comp's, or its own. */
function passAt(clip: StudioClip, sourceFrame: number): number {
  const own = Math.floor(
    (clip.sourceInFrame - clip.passes!.firstFrame) / clip.passes!.frames,
  )
  const comp = clip.comp ?? []
  return (
    comp.find((part) => sourceFrame < part.toSourceFrame)?.pass ??
    comp.at(-1)?.pass ??
    own
  )
}

/** What the take sings at a song frame of the clip, through its comp. */
function expectedTone(
  clip: StudioClip,
  take: Float32Array,
  frame: number,
): { tone: number; pass: number } {
  const passes = clip.passes!
  const own = clip.sourceInFrame + frame - clip.startFrame
  const pass = passAt(clip, own)
  const ownPass = Math.floor(
    (clip.sourceInFrame - passes.firstFrame) / passes.frames,
  )
  return {
    tone: toneAt(take, own + (pass - ownPass) * passes.frames),
    pass,
  }
}

interface Agreement {
  readonly agreed: number
  readonly windows: number
  /** Windows read where the comp plays another pass than the clip's own. */
  readonly comped: number
}

/**
 * Whether `heard` sings what the comp plays over the clip. Windows where the
 * take itself changes tone, or that touch a join, are left out: there the
 * crossfade and the lane's effects blend two tones.
 */
function agreement(
  clip: StudioClip,
  take: Float32Array,
  heard: (frame: number) => number,
): Agreement {
  const joins = (clip.comp ?? []).map(
    (part) => clip.startFrame + part.fromSourceFrame - clip.sourceInFrame,
  )
  const own = passAt({ ...clip, comp: undefined }, clip.sourceInFrame)
  let agreed = 0
  let windows = 0
  let comped = 0
  for (
    let frame = clip.startFrame;
    frame + WINDOW <=
    clip.startFrame + clip.sourceOutFrame - clip.sourceInFrame;
    frame += HOP
  ) {
    if (joins.some((join) => Math.abs(join - frame) < 0.12 * RATE)) continue
    const expected = expectedTone(clip, take, frame)
    const earlier = expectedTone(clip, take, frame - 0.12 * RATE)
    if (expected.tone < 0 || earlier.tone !== expected.tone) continue
    windows++
    if (expected.pass !== own) comped++
    if (heard(frame) === expected.tone) agreed++
  }
  return { agreed, windows, comped }
}

async function downloadedWav(download: Download): Promise<Float32Array> {
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  const bytes = Buffer.concat(chunks)
  expect(bytes.readUInt16LE(22)).toBe(2)
  const frames = (bytes.length - 44) / 4
  return Float32Array.from(
    { length: frames },
    (_, i) =>
      (bytes.readInt16LE(44 + i * 4) + bytes.readInt16LE(46 + i * 4)) / 65_536,
  )
}

function recordButton(page: Page): Locator {
  return studioRegion(page).locator('[data-studio-record]')
}

/** The newest take's clip: the one clip with passes. */
async function takeClip(page: Page): Promise<StudioClip> {
  const project = await readStudioProject(page)
  const takes = project.clips.filter((clip) => clip.passes !== undefined)
  expect(takes).toHaveLength(1)
  return takes[0]
}

/**
 * A loop take of three whole passes over the Phrase clip's four seconds, on
 * a lane of its own, the Phrase then removed so the take sings alone.
 */
async function recordLoop(page: Page): Promise<StudioClip> {
  await captureStudioOutput(page)
  await openArrangement(page)
  const studio = studioRegion(page)
  const toggle = studio.getByRole('button', { name: /^(Play|Pause) song$/ })
  // The first Play makes the audio clock the output capture reads.
  await toggle.click()
  await expect(toggle).toHaveAccessibleName('Pause song')
  await untilAudioClock(page, (await audioClock(page)) + 0.5)
  await toggle.click()
  await expect(toggle).toHaveAccessibleName('Play song')
  await setClipStart(page, 6)
  await studioClip(page, 'Phrase').click()
  await studio
    .getByRole('toolbar', { name: 'Selected clip' })
    .getByRole('button', { name: 'Range', exact: true })
    .click()
  await expect(
    studio.getByRole('slider', { name: 'Range end', exact: true }),
  ).toHaveAttribute('aria-valuetext', '0:10.000')
  await studio.getByRole('button', { name: 'New lane', exact: true }).click()
  const repeat = studio.getByRole('button', {
    name: 'Repeat range',
    exact: true,
  })
  await repeat.click()
  await expect(repeat).toHaveAttribute('aria-pressed', 'true')

  // Armed from its header, the new lane records at one press of R.
  await expect(recordButton(page)).toHaveAccessibleName('Record')
  const arm = studio.getByRole('button', {
    name: 'Arm Lane 2 for recording',
    exact: true,
  })
  await arm.click()
  await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed', {
    timeout: 15_000,
  })
  await page.keyboard.press('r')
  await expect(recordButton(page)).toHaveAccessibleName('Stop recording', {
    timeout: 15_000,
  })
  const status = studio.locator('[data-studio-record-status="recording"]')
  await expect(status).toContainText(/Recording pass 4 on /, {
    timeout: 25_000,
  })
  await untilAudioClock(page, (await audioClock(page)) + 1)
  await page.keyboard.press('r')
  await expect(recordButton(page)).toHaveAccessibleName('Record', {
    timeout: 30_000,
  })
  await expect(
    studio.getByText('Saved in this browser', { exact: true }),
  ).toBeVisible({ timeout: 30_000 })
  // Disarmed, the lane lets its microphone go: only the song plays from here.
  await arm.click()
  await expect(recordButton(page)).toHaveAttribute('data-phase', 'idle')
  await repeat.click()
  await expect(repeat).toHaveAttribute('aria-pressed', 'false')

  await studioClip(page, 'Phrase').click()
  await studio
    .getByRole('toolbar', { name: 'Selected clip' })
    .getByRole('button', { name: 'Delete', exact: true })
    .click()
  await expect(studioClip(page, 'Phrase')).toHaveCount(0)
  const clip = await takeClip(page)
  expect(clip.passes).toMatchObject({ frames: OUT - IN, count: 3 })
  expect(clip.startFrame).toBe(IN)
  return clip
}

/** The take's clip on the timeline, by what its label says it plays. */
/** The theme as the app's theme store sets it, once its colour transitions have run. */
async function showTheme(page: Page, theme: 'dark' | 'light'): Promise<void> {
  await page.evaluate(async (value) => {
    const root = document.documentElement
    root.setAttribute('data-theme', value)
    root.style.colorScheme = value
    await Promise.allSettled(
      document
        .getAnimations()
        .filter((animation) => animation instanceof CSSTransition)
        .map((animation) => animation.finished),
    )
  }, theme)
}

function takeButton(page: Page, plays: RegExp): Locator {
  return studioRegion(page).getByRole('button', { name: plays })
}

/** A pass's row under the lane. */
function passRow(page: Page, number: number): Locator {
  return studioRegion(page).getByRole('group', {
    name: new RegExp(`^Pass ${number} of 3`),
  })
}

/** Drag along a pass's row from one second of the song to another, as a mouse does. */
async function swipe(
  page: Page,
  row: Locator,
  from: number,
  to: number,
): Promise<void> {
  await row.scrollIntoViewIfNeeded()
  const box = (await row.boundingBox())!
  const x = (second: number) =>
    box.x + ((second * RATE - IN) / (OUT - IN)) * box.width
  const y = box.y + box.height / 2
  await page.mouse.move(x(from), y)
  await page.mouse.down()
  await page.mouse.move(x(to), y, { steps: 8 })
  await page.mouse.up()
}

/** The comp the song saved: each stretch's pass, and where it starts on the song in seconds. */
async function savedComp(page: Page) {
  const clip = await takeClip(page)
  return (clip.comp ?? []).map((part) => ({
    pass: part.pass,
    at: (clip.startFrame + part.fromSourceFrame - clip.sourceInFrame) / RATE,
  }))
}

async function exportWav(page: Page): Promise<Float32Array> {
  const studio = studioRegion(page)
  await studio.getByRole('button', { name: 'Export', exact: true }).click()
  await studio.getByRole('button', { name: 'Export WAV', exact: true }).click()
  const download = studio.getByRole('button', {
    name: 'Download WAV',
    exact: true,
  })
  await expect(download).toBeVisible({ timeout: 90_000 })
  const downloaded = page.waitForEvent('download')
  await download.click()
  const wav = await downloadedWav(await downloaded)
  await studio
    .getByRole('button', { name: 'Close Export', exact: true })
    .click()
  return wav
}

/** Play from the song's start and hear the clip, the whole four seconds and a little either side. */
async function hearClip(page: Page): Promise<Float32Array & { at: number }> {
  const studio = studioRegion(page)
  const toggle = studio.getByRole('button', { name: /^(Play|Pause) song$/ })
  await studio.locator('[data-tour="studio.workspace"]').focus()
  await page.keyboard.press('Home')
  const pressed = await audioClock(page)
  await toggle.click()
  const capture = await captureSpan(page, pressed + 5.5, pressed + 10.7)
  await toggle.click()
  await expect(toggle).toHaveAccessibleName('Play song')
  return Object.assign(capture.samples, { at: 5.5 })
}

/** How well the live output matches the comp, at the start delay that matches it best. */
function heardAgreement(
  clip: StudioClip,
  take: Float32Array,
  heard: Float32Array & { at: number },
): Agreement & { delayMs: number } {
  let best = { agreed: -1, windows: 0, comped: 0, delayMs: 0 }
  for (let delay = 0; delay <= 0.5 * RATE; delay += 240) {
    const reading = agreement(clip, take, (frame) =>
      toneAt(heard, frame - heard.at * RATE + delay),
    )
    if (reading.agreed > best.agreed)
      best = { ...reading, delayMs: (delay * 1000) / RATE }
  }
  return best
}

test.describe('Studio comping', () => {
  test('a swipe along a pass plays it there, one undo a swipe, live and in the export', async ({
    page,
  }) => {
    test.setTimeout(240_000)
    const recorded = await recordLoop(page)
    const take = await takeAudio(page, recorded)
    const studio = studioRegion(page)

    await takeButton(page, /, Take 1, pass 3 of 3, /).click()
    const comp = studio
      .getByRole('toolbar', { name: 'Selected clip' })
      .getByRole('button', { name: 'Comp', exact: true })
    await comp.click()
    await expect(comp).toHaveAttribute('aria-pressed', 'true')
    await expect(
      studio.getByRole('group', { name: /^Pass \d of 3/ }),
    ).toHaveCount(3)
    await expect(passRow(page, 3)).toHaveAccessibleName(
      /^Pass 3 of 3, newest, plays the whole clip/,
    )

    // Pass 1 over the second second of the clip, pass 2 over its last.
    await swipe(page, passRow(page, 1), 7.1, 7.9)
    await expect.poll(() => savedComp(page)).toHaveLength(3)
    await swipe(page, passRow(page, 2), 9.1, 9.9)
    await expect
      .poll(async () => (await savedComp(page)).map((part) => part.pass))
      .toEqual([2, 0, 2, 1])
    const stretches = await savedComp(page)
    console.log(`[studio-comp] ${JSON.stringify({ stretches })}`)
    for (const [index, second] of [6, 7, 8, 9].entries())
      expect(Math.abs(stretches[index].at - second)).toBeLessThan(0.5)
    await expect(takeButton(page, /, Take 1, comp of 3 passes, /)).toHaveCount(
      1,
    )
    await expect(passRow(page, 1)).toHaveAccessibleName(/plays 1 stretch/)
    for (const theme of ['dark', 'light'] as const) {
      await showTheme(page, theme)
      await page.screenshot({
        path: test.info().outputPath(`studio-comp-rows-${theme}.png`),
      })
    }

    // One undo takes back the second swipe only, and redo brings it back.
    await studio.locator('[data-tour="studio.workspace"]').focus()
    await page.keyboard.press('Control+z')
    await expect
      .poll(async () => (await savedComp(page)).map((part) => part.pass))
      .toEqual([2, 0, 2])
    await page.keyboard.press('Control+Shift+z')
    await expect
      .poll(async () => (await savedComp(page)).map((part) => part.pass))
      .toEqual([2, 0, 2, 1])

    const comped = await takeClip(page)
    const heard = heardAgreement(comped, take, await hearClip(page))
    const exported = await exportWav(page)
    const rendered = agreement(comped, take, (frame) => toneAt(exported, frame))
    console.log(`[studio-comp] ${JSON.stringify({ heard, rendered })}`)
    expect(rendered.windows).toBeGreaterThan(100)
    expect(rendered.comped).toBeGreaterThan(40)
    expect(rendered.agreed / rendered.windows).toBeGreaterThan(0.97)
    expect(heard.windows).toBeGreaterThan(100)
    expect(heard.agreed / heard.windows).toBeGreaterThan(0.9)
  })

  test('the keys pick a stretch and Enter plays the focused pass there', async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await recordLoop(page)
    const studio = studioRegion(page)
    await takeButton(page, /, Take 1, pass 3 of 3, /).click()
    await studio
      .getByRole('toolbar', { name: 'Selected clip' })
      .getByRole('button', { name: 'Details', exact: true })
      .click()
    await studio.getByRole('button', { name: 'Comp the passes' }).click()

    // Home puts the playhead before the clip: the pick starts on its first cell.
    await studio.locator('[data-tour="studio.workspace"]').focus()
    await page.keyboard.press('Home')
    const middle = passRow(page, 2)
    await middle.focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Shift+ArrowRight')
    await expect(middle).toHaveAccessibleName(/Picked 0:0\d\.\d{3} to /)
    await page.keyboard.press('Enter')
    await expect
      .poll(async () => (await savedComp(page)).map((part) => part.pass))
      .toEqual([2, 1, 2])

    await page.keyboard.press('ArrowDown')
    await expect(passRow(page, 1)).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Enter')
    await expect
      .poll(async () => new Set((await savedComp(page)).map((p) => p.pass)))
      .toEqual(new Set([0, 1, 2]))

    await page.keyboard.press('Escape')
    await expect(
      studio.getByRole('group', { name: /^Pass \d of 3/ }),
    ).toHaveCount(0)
    await expect(takeButton(page, /, Take 1, comp of 3 passes, /)).toBeFocused()
  })

  test('a phone comps a bar at a tap in the lane sheet', async ({ page }) => {
    test.setTimeout(240_000)
    await recordLoop(page)
    await page.setViewportSize({ width: 390, height: 844 })
    const studio = studioRegion(page)
    const take = await takeClip(page)
    const lane = (await readStudioProject(page)).tracks.find(
      (track) => track.id === take.trackId,
    )!
    await studio
      .getByRole('button', { name: `${lane.name} details`, exact: true })
      .click()
    const pass = (number: number) =>
      studio.getByRole('group', { name: `Pass ${number}`, exact: true })
    await expect(
      pass(3).getByRole('button', { name: 'Bar 4' }),
    ).toHaveAttribute('aria-pressed', 'true')

    // At 120 bpm the clip covers bars 4 and 5: the first from pass 1, the next from pass 2.
    await pass(1).getByRole('button', { name: 'Bar 4' }).click()
    await pass(2).getByRole('button', { name: 'Bar 5' }).click()
    await expect
      .poll(async () => await savedComp(page))
      .toEqual([
        { pass: 0, at: 6 },
        { pass: 1, at: 8 },
      ])
    await expect(
      pass(1).getByRole('button', { name: 'Bar 4' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      pass(3).getByRole('button', { name: 'Bar 4' }),
    ).toHaveAttribute('aria-pressed', 'false')
    await page.screenshot({
      path: test.info().outputPath('studio-comp-phone-sheet.png'),
    })
  })
})

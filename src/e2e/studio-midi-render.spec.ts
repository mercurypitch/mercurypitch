// Studio MIDI renders — a MIDI take recorded from a fake keyboard, its notes then edited as the note editor will commit them: Play sounds the added note where its tick says, from a render in memory, through the lane's own chain; keeping the render swaps the clip's audio in the saved song; and undo brings back the take's own audio, without the note. The sampled grand's samples are refused, so the piano's synth plays every render. Nothing reaches the live site.
import { expect, type Page, test } from '@playwright/test'
import type { StudioClip, StudioNote, StudioProject, StudioSequence, } from '../lib/studio/model/types'
import { openArrangement, readStudioProject, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { armLane, recordTake } from './helpers/studio-arming'
import { installFakeMidi, playLaneFromKeys, playMidi, routeNetwork, } from './helpers/studio-midi'
import type { StudioCapture } from './helpers/studio-output-capture'
import { captureStudioOutput, clearClicks, readStarts, recordOutput, } from './helpers/studio-output-capture'
import { captureSpan, frameClock } from './helpers/studio-output-span'

test.use({ viewport: { width: 1440, height: 900 } })

const C4 = 261.63
const G4 = 392
/** The added note's place: three quarters of a second after the take's own note, at 120 bpm. */
const LATER_TICKS = 1440

interface MidiHook {
  setNotes(clipId: string, notes: StudioNote[], nextNoteId: number): boolean
  renderState(clipId: string): string
  playedAsset(clipId: string): string | undefined
  editorClosed(): Promise<void>
}

const hook = (page: Page) =>
  ({
    playedAsset: (clipId: string) =>
      page.evaluate(
        (id) =>
          (
            window as unknown as { __studioMidi: MidiHook }
          ).__studioMidi.playedAsset(id),
        clipId,
      ),
    setNotes: (clipId: string, notes: StudioNote[], nextNoteId: number) =>
      page.evaluate(
        ({ id, notes, next }) =>
          (
            window as unknown as { __studioMidi: MidiHook }
          ).__studioMidi.setNotes(id, notes, next),
        { id: clipId, notes, next: nextNoteId },
      ),
    editorClosed: () =>
      page.evaluate(() =>
        (
          window as unknown as { __studioMidi: MidiHook }
        ).__studioMidi.editorClosed(),
      ),
  }) as const

function midiClipOf(project: StudioProject): {
  clip: StudioClip
  sequence: StudioSequence
} {
  const clip = project.clips.find((each) => each.midi !== undefined)!
  const sequence = project.sequences!.find(
    (each) => each.id === clip.midi!.sequenceId,
  )!
  return { clip, sequence }
}

/** Where song frame `frame` plays: the clip's place, its window, and a tick of its notes. */
function tickSeconds(
  clip: StudioClip,
  sequence: StudioSequence,
  tick: number,
): number {
  const frame = (tick / 960) * (60 / sequence.tempoBpm) * 48_000
  return (clip.startFrame - clip.sourceInFrame + frame) / 48_000
}

/**
 * A tone's level every half millisecond from `after` seconds into the capture,
 * through a 20 ms Hann window: its sidelobes keep a note 130 Hz away out,
 * where a plain window lets a fifth of it in.
 */
function toneLevels(capture: StudioCapture, hz: number, after: number) {
  const { frames } = frameClock(capture)
  const window = frames(20)
  const step = Math.max(1, Math.round(capture.sampleRate / 2000))
  const weights = Float64Array.from(
    { length: window },
    (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (window - 1)),
  )
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  const cos = weights.map(
    (weight, i) =>
      weight * Math.cos((2 * Math.PI * hz * i) / capture.sampleRate),
  )
  const sin = weights.map(
    (weight, i) =>
      weight * Math.sin((2 * Math.PI * hz * i) / capture.sampleRate),
  )
  const first = Math.max(0, Math.round(after * capture.sampleRate))
  const levels: { at: number; level: number }[] = []
  for (let at = first; at + window <= capture.samples.length; at += step) {
    let re = 0
    let im = 0
    for (let i = 0; i < window; i++) {
      re += capture.samples[at + i] * cos[i]
      im += capture.samples[at + i] * sin[i]
    }
    const level = (2 * Math.hypot(re, im)) / total
    levels.push({ at: (at + window / 2) / capture.sampleRate, level })
  }
  return levels
}

/**
 * A tone's loudest level from `after` seconds in, and when it first reached
 * a tenth of that: low on the attack, where the window's own rise sets the
 * time more than the note's shape does, which differs from pitch to pitch.
 */
function tone(capture: StudioCapture, hz: number, after = 0) {
  const levels = toneLevels(capture, hz, after)
  const loudest = Math.max(0, ...levels.map(({ level }) => level))
  const onset = levels.find(({ level }) => level >= loudest / 10)?.at ?? NaN
  return { loudest, onset }
}

/** Play the song from its start and capture `from` to `to` seconds of it, then pause. */
async function playSong(
  page: Page,
  from: number,
  to: number,
): Promise<StudioCapture> {
  const studio = studioRegion(page)
  const toggle = studio.getByRole('button', { name: /^(Play|Pause) song$/ })
  await expect(toggle).toHaveAccessibleName('Play song')
  await studio.locator('[data-tour="studio.workspace"]').focus()
  await page.keyboard.press('Home')
  await recordOutput(page)
  await clearClicks(page)
  await toggle.click()
  let started = 0
  await expect
    .poll(async () => {
      started = (await readStarts(page))[0]?.contextTime ?? 0
      return started
    })
    .toBeGreaterThan(0)
  // The song's first frame plays a little after its first source starts.
  const capture = await captureSpan(page, started + from, started + to)
  await toggle.click()
  await expect(toggle).toHaveAccessibleName('Play song')
  return capture
}

test.describe('Studio MIDI renders', () => {
  test('plays edited notes where their ticks say from a render, keeps the render as the clip’s audio, and undo brings back the take’s own', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    const live = await routeNetwork(page)
    await page.addInitScript(installFakeMidi)
    await captureStudioOutput(page)
    await openArrangement(page)
    const studio = studioRegion(page)
    // The imported phrase plays 440 Hz under everything: keep it out.
    await studio
      .locator('[data-studio-track]')
      .getByRole('button', { name: 'Mute Phrase', exact: true })
      .click()
    await studio
      .getByRole('button', { name: 'New audio lane', exact: true })
      .click()
    await playLaneFromKeys(page, 'Lane 2')
    await armLane(page, 'Lane 2')
    await recordTake(page, 'Take 1', async () => {
      await playMidi(page, [0x90, 60, 100])
      await page.evaluate(() => new Promise((done) => setTimeout(done, 300)))
      await playMidi(page, [0x80, 60, 0])
      await page.evaluate(() => new Promise((done) => setTimeout(done, 1500)))
    })
    const recorded = midiClipOf(await readStudioProject(page))
    const [own] = recorded.sequence.notes
    const added: StudioNote = {
      ...own,
      id: recorded.sequence.nextNoteId,
      pitch: 67,
      startTick: own.startTick + LATER_TICKS,
      lengthTicks: 480,
    }
    const notesAt = {
      own: tickSeconds(recorded.clip, recorded.sequence, own.startTick),
      added: tickSeconds(recorded.clip, recorded.sequence, added.startTick),
    }
    const span = [notesAt.own - 0.3, notesAt.added + 0.9] as const
    // The take's own note, and the added note looked for once the own
    // note has been let go.
    const heard = async () => {
      const capture = await playSong(page, ...span)
      const own = tone(capture, C4)
      const added = tone(capture, G4, own.onset + 0.4)
      return {
        own,
        added,
        gap: added.onset - own.onset,
        share: added.loudest / own.loudest,
      }
    }
    const expectedGap = notesAt.added - notesAt.own

    // The added note, committed as the editor commits notes, plays from a
    // render in memory once its notes rest.
    expect(
      await hook(page).setNotes(recorded.clip.id, [own, added], added.id + 1),
    ).toBe(true)
    await expect
      .poll(() => hook(page).playedAsset(recorded.clip.id), { timeout: 30_000 })
      .toMatch(/^midi-render-[0-9a-f]{16}$/)
    const previewed = await heard()

    // Kept: the saved song's clip plays a new asset, made from these notes.
    await hook(page).editorClosed()
    await expect
      .poll(
        async () =>
          midiClipOf(await readStudioProject(page)).clip.assetId !==
          recorded.clip.assetId,
        { timeout: 30_000 },
      )
      .toBe(true)
    const kept = midiClipOf(await readStudioProject(page))
    const keptHeard = await heard()

    // Undo: the take's own notes, with the take's own audio.
    await studio.locator('[data-tour="studio.workspace"]').focus()
    await page.keyboard.press('Control+z')
    await expect
      .poll(
        async () =>
          midiClipOf(await readStudioProject(page)).clip.assetId ===
          recorded.clip.assetId,
        { timeout: 30_000 },
      )
      .toBe(true)
    const undone = midiClipOf(await readStudioProject(page))
    const undoneHeard = await heard()
    console.log(
      `[studio-midi-render] ${JSON.stringify({ notesAt, expectedGap, previewed, keptHeard, undoneHeard })}`,
    )

    // The added note sounds where its tick says, three quarters of a second
    // after the take's own note: both are rendered the same way, so the gap
    // between their onsets is the gap between their ticks.
    expect(previewed.own.loudest).toBeGreaterThan(0.01)
    expect(previewed.share).toBeGreaterThan(0.3)
    expect(Math.abs(previewed.gap - expectedGap)).toBeLessThan(0.004)
    expect(kept.clip.midi?.renderKey).not.toBe(recorded.clip.midi?.renderKey)
    expect(kept.sequence.notes).toHaveLength(2)
    expect(keptHeard.share).toBeGreaterThan(0.3)
    expect(Math.abs(keptHeard.gap - expectedGap)).toBeLessThan(0.004)
    expect(undone.clip.midi?.renderKey).toBe(recorded.clip.midi?.renderKey)
    expect(undone.sequence.notes).toEqual(recorded.sequence.notes)
    expect(undoneHeard.own.loudest).toBeGreaterThan(0.01)
    expect(undoneHeard.share).toBeLessThan(0.1)
    expect(live).toEqual([])
  })
})

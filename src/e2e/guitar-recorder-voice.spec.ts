// Spoken free-form controls cross the real dispatcher, capture worker and audition owners.
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { enterRecording, RECORDING_ID } from './helpers/guitar-recording'

async function installSpeechResults(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('pitchperfect_voice_control_enabled', 'true')
    localStorage.setItem(
      'pitchperfect_voice_engine',
      JSON.stringify('webspeech'),
    )
    localStorage.setItem('pitchperfect_voice_wake_word_while_playing', 'true')
    // Fake only the browser speech service. The app's listener, grammar,
    // wake-word rules, registry, capture and playback remain production code.
    class Recognition {
      onstart: (() => void) | null = null
      onend: (() => void) | null = null
      onresult:
        | ((event: {
            resultIndex: number
            results: Array<{
              isFinal: boolean
              length: number
              0: { transcript: string }
            }>
          }) => void)
        | null = null
      start() {
        Object.assign(window, {
          __sayRecorderCommand: (transcript: string) =>
            this.onresult?.({
              resultIndex: 0,
              results: [{ isFinal: true, length: 1, 0: { transcript } }],
            }),
        })
        queueMicrotask(() => this.onstart?.())
      }
      stop() {
        this.onend?.()
      }
      abort() {
        this.stop()
      }
    }
    Object.assign(window, {
      SpeechRecognition: Recognition,
      webkitSpeechRecognition: Recognition,
    })
  })
}

async function say(page: Page, phrase: string): Promise<void> {
  await page.evaluate((transcript) => {
    const send = (
      window as unknown as { __sayRecorderCommand?: (text: string) => void }
    ).__sayRecorderCommand
    if (send === undefined)
      throw new Error('The speech listener has not started')
    send(`mercury ${transcript}`)
  }, phrase)
}

for (const source of ['Recording', 'Notes'] as const) {
  test(`voice controls the selected ${source} audition without opening input @smoke`, async ({
    page,
  }) => {
    await installSpeechResults(page)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const deck = await enterRecording(page)
    const timeline = page.getByTestId('guitar-recording-timeline')
    await deck
      .getByRole('button', { name: 'Playback source', exact: true })
      .click()
    await page
      .getByRole('menuitemradio', { name: new RegExp(`^${source}`) })
      .click()
    await deck
      .getByRole('button', { name: 'Playback tone', exact: true })
      .click()
    await page.getByRole('menuitemradio', { name: /^Clean/ }).click()
    const play = deck.getByRole('button', {
      name: source === 'Recording' ? 'Play recording' : 'Play recorded notes',
      exact: true,
    })
    const pause = deck.getByRole('button', {
      name:
        source === 'Recording'
          ? 'Pause recording replay'
          : 'Pause note playback',
      exact: true,
    })
    await say(page, 'forward')
    await expect(timeline).toHaveValue('10')
    await say(page, 'back five seconds')
    await expect(timeline).toHaveValue('5')
    await say(page, 'play')
    await expect(pause).toBeVisible()
    await expect
      .poll(async () => Number(await timeline.inputValue()))
      .toBeGreaterThan(5.1)
    await say(page, 'pause')
    await expect(play).toBeVisible()
    const paused = Number(await timeline.inputValue())
    expect(paused).toBeGreaterThan(5)
    await say(page, 'go to start')
    await expect(timeline).toHaveValue('0')
    await expect(play).toBeVisible()
    await say(page, 'from the top')
    await expect(pause).toBeVisible()
    await say(page, 'stop')
    await expect(play).toBeVisible()
    await expect(timeline).toHaveValue('0')
    expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(0)
    expect(errors).toEqual([])
  })
}

test('voice records an idea, blocks seeking and finalizes the real take for review @smoke', async ({
  page,
}) => {
  await installSpeechResults(page)
  await enterRecording(page)
  await say(page, 'record idea')
  const stop = page.getByRole('button', { name: 'Stop recording', exact: true })
  await expect(stop).toBeEnabled()
  await expect(page.getByTestId('guitar-recorder-stage')).toContainText(
    'Recording your idea',
  )
  await say(page, 'forward')
  await expect(page.getByTestId('voice-control-pill')).toContainText(
    'Finish recording with Stop',
  )
  await expect(stop).toBeEnabled()
  await expect
    .poll(() =>
      page.evaluate(async (seededId) => {
        const request = indexedDB.open('MercuryPitchDB')
        const db = await new Promise<IDBDatabase>((resolve) => {
          request.onsuccess = () => resolve(request.result)
        })
        const rows = await new Promise<
          Array<{
            id: string
            state: string
            frames: number
            interruption: string | null
          }>
        >((resolve) => {
          const request = db
            .transaction('guitarRecordings')
            .objectStore('guitarRecordings')
            .getAll()
          request.onsuccess = () => resolve(request.result)
        })
        db.close()
        // A safely interrupted capture is no longer `capturing`. Report it
        // rather than turning a completed short take into an ambiguous zero.
        const recording = rows.find((row) => row.id !== seededId)
        const frames = recording?.frames ?? 0
        if (recording?.state === 'capturing' && frames > 48000)
          return 'capturing with more than 48000 frames'
        return {
          state: recording?.state ?? 'missing',
          interruption: recording?.interruption ?? null,
          frames,
        }
      }, RECORDING_ID),
    )
    .toBe('capturing with more than 48000 frames')
  await say(page, 'stop recording')
  const review = page.getByRole('dialog').filter({ hasText: 'Recorded melody' })
  await expect(review).toBeVisible()
  await expect(
    review.getByRole('button', { name: 'Play take playback', exact: true }),
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Stop recording', exact: true }),
  ).toHaveCount(0)
})

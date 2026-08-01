// ============================================================
// Whisper transcription — real-audio smoke (OWNER-RUN, opt-in)
// ============================================================
//
// This one is deliberately NOT part of the CI suite. The real check has
// two requirements CI cannot meet:
//   * the model downloads ~40MB from the HF CDN on first run;
//   * the bug being guarded (fp16 word-timestamp corruption) only ever
//     appeared on the WEBGPU path, and headless CI Chromium has no
//     WebGPU — it would silently exercise the healthy WASM q8 fallback
//     and "pass" while the real path stayed broken.
// So it self-skips unless WHISPER_STEM points at a local vocal stem,
// and it asks for a headed browser where WebGPU is available.
//
//   WHISPER_STEM=~/Downloads/_trash_staging/Heaven_Can_Wait_2015_Remaster_vocal.wav \
//     pnpm exec playwright test src/e2e/whisper-transcription-real.spec.ts \
//     --project=chromium --headed
//
// What it asserts is exactly the shape of the owner-reported garbage:
// one-word segments, ~20ms spans, the same token repeated. A healthy
// run has varied text and human-length words; a broken run trips the
// in-app hallucination guard, which surfaces an error instead of a
// silent zero-word "success" — this spec fails on EITHER.

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'

const rawStem = process.env.WHISPER_STEM ?? ''
const stemPath =
  rawStem === '' ? '' : resolve(rawStem.replace(/^~(?=$|\/)/, homedir()))

const SEGMENT_MIN_DURATION_SEC = 0.1

test.describe('whisper transcription on a real vocal stem', () => {
  test.skip(
    stemPath === '' || !existsSync(stemPath),
    'Set WHISPER_STEM=/path/to/vocal.wav to run this (owner-run; needs a headed browser for WebGPU).',
  )
  // Model download + a multi-minute stem: generous, and still bounded.
  test.setTimeout(15 * 60 * 1000)

  test('produces varied words with human-length spans, not repeated 20ms tokens', async ({
    page,
  }) => {
    const logs: string[] = []
    page.on('console', (msg) => logs.push(msg.text()))

    await page.addInitScript(() => {
      ;(window as Window & { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
    })
    await page.goto('/#/lab')
    await dismissOverlays(page)

    // Pitch Detection Testing → load the stem from disk.
    await page.getByText('Pitch Detection', { exact: false }).first().click()
    await page.getByTestId('pitch-file-input').setInputFiles(stemPath)

    // Analysis has to land before the transcribe control appears.
    const transcribe = page.getByTestId('whisper-transcribe')
    await expect(transcribe).toBeVisible({ timeout: 5 * 60 * 1000 })
    await transcribe.click()

    // The run is done when the completion line lands (healthy) or the
    // guard rejects it (broken) — wait for either, then judge.
    await expect
      .poll(
        () =>
          logs.some(
            (l) =>
              l.includes('Whisper transcription complete') ||
              l.includes('hallucination detected'),
          ),
        { timeout: 12 * 60 * 1000, intervals: [2000] },
      )
      .toBe(true)

    const rejected = logs.filter((l) => l.includes('hallucination detected'))
    expect(
      rejected,
      `The hallucination guard rejected this run — the model produced placeholder text.\n${rejected.join('\n')}`,
    ).toHaveLength(0)

    // Read the real segments off the page rather than trusting the log
    // line's counts.
    const segments = await page.evaluate(() => {
      const w = window as unknown as {
        __whisperSegments?: () => Array<{
          text: string
          t: [number, number]
        }>
      }
      return w.__whisperSegments?.() ?? []
    })

    expect(segments.length, 'no segments produced').toBeGreaterThan(5)

    // 1. Spans must be human-length, not the 0.02s timestamp quantum.
    const durations = segments.map((s) => s.t[1] - s.t[0]).sort((a, b) => a - b)
    const median = durations[Math.floor(durations.length / 2)] ?? 0
    expect(
      median,
      `median segment duration ${median.toFixed(3)}s — the fp16 collapse signature is ~0.02s`,
    ).toBeGreaterThan(SEGMENT_MIN_DURATION_SEC)

    // 2. Text must be varied, not one token repeated ("that." / " idea.").
    const normalized = segments.map((s) => s.text.trim().toLowerCase())
    const counts = new Map<string, number>()
    for (const t of normalized) counts.set(t, (counts.get(t) ?? 0) + 1)
    const dominant = Math.max(...counts.values()) / normalized.length
    expect(
      dominant,
      `one token is ${(dominant * 100).toFixed(0)}% of all segments — repeated-placeholder signature`,
    ).toBeLessThan(0.6)

    // 3. Sanity: real lyrics contain multi-character words.
    const realWords = normalized.filter((t) => t.replace(/\W/g, '').length > 2)
    expect(realWords.length).toBeGreaterThan(segments.length * 0.3)
  })
})

// Capture the compiled museum, all four mascot destinations, and saved portrait art.
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const url =
  process.env.JOURNEY_PROOF_URL ??
  'https://127.0.0.1:5295/glass-game/?campaign=1'
const output = process.env.JOURNEY_PROOF_OUTPUT_URL
  ? new URL(process.env.JOURNEY_PROOF_OUTPUT_URL)
  : new URL('../proofs/runtime/', import.meta.url)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const proofs = []
const stages = [
  ['first-light-isle', 'First Light Gallery'],
  ['glassworks-isle', 'Glassworks Journey'],
  ['twin-galleries-isle', 'Twin Galleries'],
  ['resonance-conservatory-isle', 'Resonance Conservatory'],
]

try {
  for (const [name, width, height, touch, earned] of [
    ['earned', 1600, 900, false, true],
    ['earned-phone', 320, 568, true, true],
    ['desktop', 1600, 900, false, false],
    ['tablet', 1024, 768, true, false],
    ['phone', 320, 640, true, false],
  ].filter(
    ([name]) =>
      !process.env.JOURNEY_PROOF_CASE ||
      name === process.env.JOURNEY_PROOF_CASE,
  )) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: touch,
      ignoreHTTPSErrors: true,
      reducedMotion: 'reduce',
    })
    const seededStars = name === 'earned-phone' ? 2 : 0
    if (earned)
      await context.addInitScript((stars) => {
        localStorage.setItem(
          'beside-cue:glass-adventure:progress:glassworks-journey/journey',
          JSON.stringify({
            version: 2,
            levelId: 'glassworks-journey/journey',
            checkpointId:
              'glassworks-journey/journey/vestibule/checkpoint/entry',
            completedBreakableIds: [],
            finished: false,
            rewards: {
              version: 1,
              discoveredEncounterIds: [],
              collectedCoinIds: [],
              qualityResults:
                stars === 0
                  ? []
                  : [
                      {
                        encounterId:
                          'glassworks-journey/journey/portrait/encounter/portrait-finale',
                        grade: stars,
                        challengeRevision: 1,
                        policyRevision: 1,
                        contentRevision: 1,
                        evidenceVersion: 'pitch-accuracy-v1',
                        reliableSeconds: 1.5,
                        meanAbsoluteCents: 48,
                      },
                    ],
              collectedPortraitIds: ['glassworks-awakened-muse'],
            },
          }),
        )
      }, seededStars)
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    const frame = page.locator('[data-map-state]')
    await expect(frame).toHaveAttribute('data-map-state', 'ready', {
      timeout: 90_000,
    })
    await page.evaluate(() => document.fonts.ready)
    const canvas = frame.locator('canvas')
    if (earned)
      await expect
        .poll(
          async () =>
            JSON.parse(
              (await canvas.getAttribute('data-journey-progress')) ?? '{}',
            ).earnedPortraitIds,
        )
        .toContain('glassworks-journey-portrait-monument')
    if (seededStars)
      await expect
        .poll(
          async () =>
            JSON.parse(
              (await canvas.getAttribute('data-journey-progress')) ?? '{}',
            ).stars?.['glassworks-isle'],
        )
        .toBe(seededStars)
    const choices =
      name === 'desktop' ? stages : [stages[earned ? 1 : width >= 640 ? 2 : 0]]
    for (const [stageId, title] of choices.filter(
      ([stageId]) =>
        !process.env.JOURNEY_PROOF_STAGE ||
        process.env.JOURNEY_PROOF_STAGE === stageId,
    )) {
      await page
        .getByRole('navigation', { name: 'Select a museum island' })
        .getByRole('button', {
          name: `Select ${title} on the museum map`,
          exact: true,
        })
        .click()
      await expect(frame).toHaveAttribute('data-selected-stage', stageId)
      await page.waitForTimeout(800)
      await page.evaluate(() => window.scrollTo(0, 0))
      const metadata = await canvas.evaluate((element) => {
        const gl = element.getContext('webgl2') ?? element.getContext('webgl')
        const info = gl?.getExtension('WEBGL_debug_renderer_info')
        return {
          renderer:
            info == null
              ? 'unavailable'
              : gl.getParameter(info.UNMASKED_RENDERER_WEBGL),
          metrics: JSON.parse(
            element.getAttribute('data-renderer-metrics') ?? 'null',
          ),
          progress: JSON.parse(
            element.getAttribute('data-journey-progress') ?? 'null',
          ),
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        }
      })
      const filename = `${name}-${stageId}.png`
      const path = new URL(filename, output)
      await page.screenshot({
        path: fileURLToPath(path),
        animations: 'disabled',
      })
      const bytes = await readFile(path)
      proofs.push({
        name,
        stageId,
        viewport: { width, height },
        touch,
        seededPortrait: earned,
        seededStars,
        ...metadata,
        errors: [...errors],
        screenshot: filename,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      })
      await writeFile(
        new URL('manifest.json', output),
        `${JSON.stringify({ createdAt: new Date().toISOString(), url, evidence: 'Compiled application under SwiftShader; reduced-motion stills, isolated saved-portrait fixture only for earned view. This is not physical-device FPS or thermal acceptance.', proofs }, null, 2)}\n`,
      )
    }
    await context.close()
  }
} finally {
  await browser.close()
}
await writeFile(
  new URL('manifest.json', output),
  `${JSON.stringify({ createdAt: new Date().toISOString(), url, evidence: 'Compiled application under SwiftShader; reduced-motion stills, isolated saved-portrait fixture only for earned view. This is not physical-device FPS or thermal acceptance.', proofs }, null, 2)}\n`,
)
if (
  proofs.length === 0 ||
  proofs.some((proof) => proof.errors.length || proof.overflow)
)
  throw new Error('Runtime proof has browser errors or horizontal overflow.')
console.log(
  JSON.stringify(
    proofs.map(({ name, stageId, metrics, errors }) => ({
      name,
      stageId,
      metrics,
      errors,
    })),
  ),
)

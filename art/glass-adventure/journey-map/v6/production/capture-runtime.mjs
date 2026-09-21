// Capture the compiled V6 museum across overview, earned and inspection views.
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const READINESS_TIMEOUT_MS = 90_000
const SCREENSHOT_TIMEOUT_MS = 90_000
const sourceUrl = new URL(
  process.env.JOURNEY_PROOF_URL ??
    'https://127.0.0.1:5297/glass-game/?campaign=1',
)
const requestedCase = process.env.JOURNEY_PROOF_CASE ?? 'all'
const outputUrl = new URL(
  process.env.JOURNEY_PROOF_OUTPUT_URL ??
    new URL('../proofs/runtime/', import.meta.url),
)
const output = new URL(
  outputUrl.href.endsWith('/') ? outputUrl.href : `${outputUrl.href}/`,
)

function isPrivateTestHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host === '::1' || /^f[cd][0-9a-f]*:/u.test(host)) return true
  if (/^fe[89ab][0-9a-f]*:/u.test(host)) return true
  const parts = host.split('.').map(Number)
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  )
    return false
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 169 && parts[1] === 254)
  )
}

if (!['http:', 'https:'].includes(sourceUrl.protocol))
  throw new Error('JOURNEY_PROOF_URL must use HTTP or HTTPS.')
if (
  sourceUrl.username ||
  sourceUrl.password ||
  !isPrivateTestHost(sourceUrl.hostname)
)
  throw new Error(
    'JOURNEY_PROOF_URL must target localhost or a private-LAN test host.',
  )
if (sourceUrl.port === '5296')
  throw new Error(
    'Port 5296 is the protected stable preview; use V6 port 5297.',
  )
if (output.protocol !== 'file:')
  throw new Error('JOURNEY_PROOF_OUTPUT_URL must be a file URL.')

const stages = {
  'first-light-isle': 'First Light Gallery',
  'glassworks-isle': 'Glassworks Journey',
  'twin-galleries-isle': 'Twin Galleries',
  'resonance-conservatory-isle': 'Resonance Conservatory',
}
const desktopCases = Object.keys(stages).map((stageId) => ({
  id: `desktop-${stageId}`,
  group: 'desktop',
  stageId,
  width: 1600,
  height: 900,
}))
const cases = [
  ...desktopCases,
  {
    id: 'tablet',
    stageId: 'twin-galleries-isle',
    width: 1024,
    height: 768,
    touch: true,
  },
  {
    id: 'phone',
    stageId: 'first-light-isle',
    width: 320,
    height: 640,
    touch: true,
  },
  {
    id: 'earned',
    stageId: 'glassworks-isle',
    width: 1600,
    height: 900,
    earned: true,
  },
  {
    id: 'earned-phone',
    stageId: 'glassworks-isle',
    width: 320,
    height: 640,
    touch: true,
    earned: true,
  },
  {
    id: 'twin-close',
    group: 'inspection',
    stageId: 'twin-galleries-isle',
    width: 1280,
    height: 1000,
    inspect: 'close',
  },
  {
    id: 'twin-oblique',
    group: 'inspection',
    stageId: 'twin-galleries-isle',
    width: 1280,
    height: 1000,
    inspect: 'oblique',
    dragX: -200,
  },
  {
    id: 'conservatory-close',
    group: 'inspection',
    stageId: 'resonance-conservatory-isle',
    width: 1280,
    height: 1000,
    inspect: 'close',
  },
  {
    id: 'conservatory-oblique',
    group: 'inspection',
    stageId: 'resonance-conservatory-isle',
    width: 1280,
    height: 1000,
    inspect: 'oblique',
    dragX: 180,
  },
]
const knownCases = new Set([
  'all',
  'desktop',
  'inspection',
  ...cases.map(({ id }) => id),
])
if (!knownCases.has(requestedCase))
  throw new Error(
    `Unknown JOURNEY_PROOF_CASE ${JSON.stringify(requestedCase)}. Expected one of: ${[...knownCases].join(', ')}.`,
  )
const selectedCases = cases.filter(
  ({ id, group }) =>
    requestedCase === 'all' || requestedCase === id || requestedCase === group,
)

await mkdir(output, { recursive: true })
const proofs = []
const failures = []
const evidence =
  'Actual compiled application and real assets under SwiftShader; real wheel and mouse drag for inspection views. Saved progress is seeded only in earned cases. This is not physical-device performance acceptance.'
const manifestUrl = new URL(
  requestedCase === 'all' ? 'manifest.json' : `manifest-${requestedCase}.json`,
  output,
)

async function writeManifest() {
  await writeFile(
    manifestUrl,
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        url: sourceUrl.href,
        requestedCase,
        evidence,
        proofs,
        failures,
      },
      null,
      2,
    )}\n`,
  )
}

async function readJsonAttribute(locator, name) {
  const raw = await locator.getAttribute(name)
  if (raw === null) return null
  try {
    return JSON.parse(raw)
  } catch {
    return { parseError: `Invalid ${name}`, raw }
  }
}

async function seedEarnedProgress(context) {
  await context.addInitScript(() => {
    localStorage.setItem(
      'beside-cue:glass-adventure:progress:glassworks-journey/journey',
      JSON.stringify({
        version: 2,
        levelId: 'glassworks-journey/journey',
        checkpointId: 'glassworks-journey/journey/vestibule/checkpoint/entry',
        completedBreakableIds: [],
        finished: false,
        rewards: {
          version: 1,
          discoveredEncounterIds: [],
          collectedCoinIds: [],
          qualityResults: [
            {
              encounterId:
                'glassworks-journey/journey/portrait/encounter/portrait-finale',
              grade: 2,
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
  })
}

async function inspectWithMouse(page, canvas, specification) {
  const box = await canvas.boundingBox()
  if (box === null) throw new Error('Museum canvas has no visible bounds.')
  const wheelX = box.x + box.width * 0.08
  const wheelY = box.y + box.height * 0.55
  const initialZoom = Number(
    (await canvas.getAttribute('data-journey-camera-zoom')) ?? '0',
  )
  if (!Number.isFinite(initialZoom) || initialZoom !== 0)
    throw new Error(
      `Inspection case did not start from the authored overview zoom: ${initialZoom}.`,
    )
  await page.mouse.move(wheelX, wheelY)
  for (let tick = 0; tick < 3; tick++) {
    await page.mouse.wheel(0, -240)
    await page.waitForTimeout(100)
  }
  await expect
    .poll(
      async () =>
        Number((await canvas.getAttribute('data-journey-camera-zoom')) ?? '0'),
      { timeout: READINESS_TIMEOUT_MS },
    )
    .toBeGreaterThan(0.95)

  if (specification.inspect === 'oblique') {
    const initialYaw = Number(
      (await canvas.getAttribute('data-journey-camera-yaw')) ?? '0',
    )
    const dragX = box.x + box.width * 0.58
    const dragY = box.y + box.height * 0.32
    await page.mouse.move(dragX, dragY)
    await page.mouse.down()
    await page.mouse.move(dragX + specification.dragX, dragY, { steps: 8 })
    await page.mouse.up()
    await expect
      .poll(
        async () =>
          Math.abs(
            Number(
              (await canvas.getAttribute('data-journey-camera-yaw')) ?? '0',
            ) - initialYaw,
          ),
        { timeout: READINESS_TIMEOUT_MS },
      )
      .toBeGreaterThan(0.05)
  }
}

async function collectMetadata(canvas, frame) {
  return canvas.evaluate(
    (element, mapState) => {
      const parse = (name) => {
        const raw = element.getAttribute(name)
        if (raw === null) return null
        try {
          return JSON.parse(raw)
        } catch {
          return { parseError: `Invalid ${name}`, raw }
        }
      }
      const gl = element.getContext('webgl2') ?? element.getContext('webgl')
      const rendererInfo = gl?.getExtension('WEBGL_debug_renderer_info')
      const documentElement = document.documentElement
      return {
        renderer:
          rendererInfo == null
            ? 'unavailable'
            : gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL),
        metrics: parse('data-renderer-metrics'),
        progress: parse('data-journey-progress'),
        camera: {
          zoom: element.dataset.journeyCameraZoom ?? null,
          yaw: element.dataset.journeyCameraYaw ?? null,
          pitch: element.dataset.journeyCameraPitch ?? null,
        },
        mapState,
        selectedStage: element
          .closest('[data-selected-stage]')
          ?.getAttribute('data-selected-stage'),
        canvas: {
          clientWidth: element.clientWidth,
          clientHeight: element.clientHeight,
          drawingBufferWidth: element.width,
          drawingBufferHeight: element.height,
        },
        overflow: {
          horizontal: documentElement.scrollWidth > window.innerWidth,
          scrollWidth: documentElement.scrollWidth,
          scrollHeight: documentElement.scrollHeight,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
        },
      }
    },
    await frame.getAttribute('data-map-state'),
  )
}

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
try {
  for (const specification of selectedCases) {
    let context
    try {
      context = await browser.newContext({
        viewport: {
          width: specification.width,
          height: specification.height,
        },
        hasTouch: specification.touch === true,
        ignoreHTTPSErrors: true,
        reducedMotion: 'reduce',
      })
      if (specification.earned === true) await seedEarnedProgress(context)
      const page = await context.newPage()
      page.setDefaultTimeout(READINESS_TIMEOUT_MS)
      const errors = []
      page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
      page.on('console', (message) => {
        if (message.type() === 'error')
          errors.push(`console: ${message.text()}`)
      })
      await page.goto(sourceUrl.href, {
        waitUntil: 'domcontentloaded',
        timeout: READINESS_TIMEOUT_MS,
      })
      const frame = page.locator('[data-map-state]')
      const canvas = frame.locator('canvas')
      await expect(frame).toHaveAttribute('data-map-state', 'ready', {
        timeout: READINESS_TIMEOUT_MS,
      })
      await expect
        .poll(() => page.evaluate(() => document.fonts.status), {
          timeout: READINESS_TIMEOUT_MS,
        })
        .toBe('loaded')
      await page
        .getByRole('navigation', { name: 'Select a museum island' })
        .getByRole('button', {
          name: `Select ${stages[specification.stageId]} on the museum map`,
          exact: true,
        })
        .click()
      await expect(frame).toHaveAttribute(
        'data-selected-stage',
        specification.stageId,
        { timeout: READINESS_TIMEOUT_MS },
      )

      if (specification.earned === true) {
        await expect
          .poll(
            async () =>
              (await readJsonAttribute(canvas, 'data-journey-progress'))
                ?.earnedPortraitIds,
            { timeout: READINESS_TIMEOUT_MS },
          )
          .toContain('glassworks-journey-portrait-monument')
        await expect
          .poll(
            async () =>
              (await readJsonAttribute(canvas, 'data-journey-progress'))
                ?.stars?.['glassworks-isle'],
            { timeout: READINESS_TIMEOUT_MS },
          )
          .toBe(2)
      }
      if (specification.inspect !== undefined)
        await inspectWithMouse(page, canvas, specification)
      await page.waitForTimeout(800)

      const filename = `${specification.id}.png`
      const screenshotUrl = new URL(filename, output)
      const metadata = await collectMetadata(canvas, frame)
      await page.screenshot({
        path: fileURLToPath(screenshotUrl),
        timeout: SCREENSHOT_TIMEOUT_MS,
      })
      const bytes = await readFile(screenshotUrl)
      proofs.push({
        case: specification.id,
        stageId: specification.stageId,
        viewport: {
          width: specification.width,
          height: specification.height,
        },
        touch: specification.touch === true,
        earnedFixture: specification.earned === true,
        inspection: specification.inspect ?? null,
        ...metadata,
        errors,
        screenshot: filename,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      })
    } catch (error) {
      failures.push({
        case: specification.id,
        error:
          error instanceof Error ? (error.stack ?? error.message) : `${error}`,
      })
    } finally {
      if (context !== undefined) await context.close().catch(() => undefined)
      await writeManifest()
    }
  }
} finally {
  await browser.close()
  await writeManifest()
}

const invalidProofs = proofs.filter(
  (proof) =>
    proof.errors.length > 0 ||
    proof.overflow.horizontal ||
    proof.metrics === null ||
    proof.metrics?.parseError !== undefined ||
    typeof proof.metrics?.drawCalls !== 'number' ||
    proof.progress === null ||
    proof.progress?.parseError !== undefined ||
    Object.values(proof.camera).some((value) => value === null),
)
if (proofs.length === 0 || failures.length > 0 || invalidProofs.length > 0)
  throw new Error(
    `Runtime proof failed: ${failures.length} case failures and ${invalidProofs.length} invalid captures. See ${fileURLToPath(manifestUrl)}.`,
  )
console.log(
  JSON.stringify(
    proofs.map(({ case: caseId, stageId, metrics, camera, errors }) => ({
      case: caseId,
      stageId,
      metrics,
      camera,
      errors,
    })),
  ),
)

// Compare actual Cloudway platform art using loaded model bytes and repeatable mouse camera inputs.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../../..')
const label = process.argv[2] ?? 'baseline-desktop'
assert.match(label, /^[a-z0-9-]+$/u)
const output = resolve(here, label)
const tablet = process.env.CLOUDWAY_VIEWPORT === 'tablet'
const viewport = tablet
  ? { width: 1024, height: 768 }
  : { width: 1440, height: 900 }
const url = new URL(
  '/glass-game/?layout=cloudway',
  process.env.CLOUDWAY_QA_URL ?? 'http://127.0.0.1:5341',
)
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname))
const candidate = process.env.CLOUDWAY_CANDIDATE_FILE
  ? resolve(repo, process.env.CLOUDWAY_CANDIDATE_FILE)
  : undefined
if (candidate) {
  assert.ok(candidate.startsWith(`${repo}${sep}`) && candidate.endsWith('.glb'))
}
await mkdir(output, { recursive: true })
const browser = await chromium.launch({
  args: [
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--use-angle=vulkan',
    '--enable-features=Vulkan',
  ],
})
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const errors = []
const assetWork = []
const screenshots = []
const cadenceFrameCount = 120
const drawCounterName = '__cloudwayProofWebGLDrawCounters'
try {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 })
  if (candidate) {
    await page.route(
      '**/games/cloudway-v*/cloudway-platform-kit-v*.glb',
      (route) =>
        route.fulfill({ path: candidate, contentType: 'model/gltf-binary' }),
    )
  }
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (entry) => {
    if (entry.type() === 'error') errors.push(entry.text())
  })
  const network = await page.context().newCDPSession(page)
  await network.send('Network.enable', {
    maxTotalBufferSize: 256 * 1024 * 1024,
    maxResourceBufferSize: 128 * 1024 * 1024,
  })
  const pending = new Map()
  network.on('Network.responseReceived', ({ requestId, response }) => {
    const path = new URL(response.url).pathname
    if (path.startsWith('/games/') && path.endsWith('.glb'))
      pending.set(requestId, { path, response })
  })
  network.on('Network.loadingFinished', ({ requestId }) => {
    const asset = pending.get(requestId)
    if (!asset) return
    pending.delete(requestId)
    assetWork.push(
      (async () => {
        const result = await network.send('Network.getResponseBody', {
          requestId,
        })
        const body = Buffer.from(
          result.body,
          result.base64Encoded ? 'base64' : 'utf8',
        )
        const file =
          candidate &&
          /\/cloudway-v\d+\/cloudway-platform-kit-v\d+\.glb$/u.test(asset.path)
            ? relative(repo, candidate)
            : `apps/beside-cue/public${asset.path}`
        assert.equal(asset.response.status, 200)
        assert.ok(body.equals(await readFile(resolve(repo, file))), file)
        return {
          file,
          bytes: body.length,
          sha256: hash(body),
          status: asset.response.status,
        }
      })().catch((error) => {
        errors.push(error.message)
        return { error: error.message }
      }),
    )
  })
  await page.addInitScript(
    ({ counterName }) => {
      const prefix = 'beside-cue:glass-adventure:'
      localStorage.setItem(`${prefix}tutorial`, 'seen')
      localStorage.setItem(
        `${prefix}tutorial:cloudway-glass-ribbon:cloudway-first-crossing:v1`,
        'seen',
      )

      if (Object.hasOwn(globalThis, counterName)) return

      const methodNames = [
        'drawArrays',
        'drawElements',
        'drawArraysInstanced',
        'drawElementsInstanced',
      ]
      const makeBucket = () => ({ drawCalls: 0, triangles: 0 })
      const state = {
        drawCalls: 0,
        triangles: 0,
        byMethod: Object.fromEntries(
          methodNames.map((method) => [method, makeBucket()]),
        ),
        byMode: {},
        installedWrappers: [],
        installedExtensionObservers: [],
        installErrors: [],
        counterErrors: 0,
        multiDraw: {
          extensionRequests: 0,
          extensionAvailableWhenRequested: null,
          drawCalls: 0,
          byMethod: {},
        },
      }
      const modeNames = new Map([
        [0x0000, 'POINTS'],
        [0x0001, 'LINES'],
        [0x0002, 'LINE_LOOP'],
        [0x0003, 'LINE_STRIP'],
        [0x0004, 'TRIANGLES'],
        [0x0005, 'TRIANGLE_STRIP'],
        [0x0006, 'TRIANGLE_FAN'],
      ])
      const asNonnegativeInteger = (value) =>
        typeof value === 'number' && Number.isFinite(value)
          ? Math.max(0, Math.trunc(value))
          : 0
      const trianglesFor = (mode, count, instanceCount) => {
        const vertices = asNonnegativeInteger(count)
        const instances = asNonnegativeInteger(instanceCount)
        let triangles = 0
        if (mode === 0x0004) triangles = Math.floor(vertices / 3)
        else if (mode === 0x0005 || mode === 0x0006)
          triangles = Math.max(0, vertices - 2)
        return triangles * instances
      }
      const record = (method, mode, count, instanceCount) => {
        const triangles = trianglesFor(mode, count, instanceCount)
        const modeName = modeNames.get(mode) ?? `UNKNOWN_${String(mode)}`
        const modeBucket = (state.byMode[modeName] ??= makeBucket())
        state.drawCalls += 1
        state.triangles += triangles
        state.byMethod[method].drawCalls += 1
        state.byMethod[method].triangles += triangles
        modeBucket.drawCalls += 1
        modeBucket.triangles += triangles
      }
      const snapshot = () => ({
        drawCalls: state.drawCalls,
        triangles: state.triangles,
        byMethod: Object.fromEntries(
          Object.entries(state.byMethod).map(([method, bucket]) => [
            method,
            { ...bucket },
          ]),
        ),
        byMode: Object.fromEntries(
          Object.entries(state.byMode).map(([mode, bucket]) => [
            mode,
            { ...bucket },
          ]),
        ),
        installedWrappers: [...state.installedWrappers],
        installedExtensionObservers: [...state.installedExtensionObservers],
        installErrors: [...state.installErrors],
        counterErrors: state.counterErrors,
        multiDraw: {
          ...state.multiDraw,
          byMethod: { ...state.multiDraw.byMethod },
        },
      })
      Object.defineProperty(globalThis, counterName, {
        configurable: false,
        enumerable: false,
        writable: false,
        value: Object.freeze({ snapshot }),
      })

      const wrappers = [
        ['WebGLRenderingContext', 'drawArrays', 2],
        ['WebGLRenderingContext', 'drawElements', 1],
        ['WebGL2RenderingContext', 'drawArrays', 2],
        ['WebGL2RenderingContext', 'drawElements', 1],
        ['WebGL2RenderingContext', 'drawArraysInstanced', 2, 3],
        ['WebGL2RenderingContext', 'drawElementsInstanced', 1, 4],
      ]
      for (const [contextName, method, countIndex, instanceIndex] of wrappers) {
        const key = `${contextName}.${method}`
        try {
          const prototype = globalThis[contextName]?.prototype
          const descriptor = prototype
            ? Object.getOwnPropertyDescriptor(prototype, method)
            : undefined
          if (!descriptor || typeof descriptor.value !== 'function') {
            state.installErrors.push(`${key}: native method unavailable`)
            continue
          }
          const nativeMethod = descriptor.value
          Object.defineProperty(prototype, method, {
            ...descriptor,
            value: function (...args) {
              const result = Reflect.apply(nativeMethod, this, args)
              try {
                record(
                  method,
                  args[0],
                  args[countIndex],
                  instanceIndex === undefined ? 1 : args[instanceIndex],
                )
              } catch {
                state.counterErrors += 1
              }
              return result
            },
          })
          state.installedWrappers.push(key)
        } catch (error) {
          state.installErrors.push(`${key}: ${String(error)}`)
        }
      }

      const observedMultiDrawExtensions = new WeakSet()
      const multiDrawMethods = [
        'multiDrawArraysWEBGL',
        'multiDrawElementsWEBGL',
        'multiDrawArraysInstancedWEBGL',
        'multiDrawElementsInstancedWEBGL',
      ]
      const observeMultiDrawExtension = (extension) => {
        if (!extension || observedMultiDrawExtensions.has(extension)) return
        observedMultiDrawExtensions.add(extension)
        for (const method of multiDrawMethods) {
          const nativeMethod = extension[method]
          if (typeof nativeMethod !== 'function') continue
          Object.defineProperty(extension, method, {
            configurable: true,
            enumerable: false,
            writable: true,
            value: function (...args) {
              const result = Reflect.apply(nativeMethod, this, args)
              state.multiDraw.drawCalls += 1
              state.multiDraw.byMethod[method] =
                (state.multiDraw.byMethod[method] ?? 0) + 1
              return result
            },
          })
        }
      }
      for (const contextName of [
        'WebGLRenderingContext',
        'WebGL2RenderingContext',
      ]) {
        const key = `${contextName}.getExtension(WEBGL_multi_draw)`
        try {
          const prototype = globalThis[contextName]?.prototype
          const descriptor = prototype
            ? Object.getOwnPropertyDescriptor(prototype, 'getExtension')
            : undefined
          if (!descriptor || typeof descriptor.value !== 'function') {
            state.installErrors.push(`${key}: native method unavailable`)
            continue
          }
          const nativeMethod = descriptor.value
          Object.defineProperty(prototype, 'getExtension', {
            ...descriptor,
            value: function (...args) {
              const extension = Reflect.apply(nativeMethod, this, args)
              if (args[0] === 'WEBGL_multi_draw') {
                state.multiDraw.extensionRequests += 1
                state.multiDraw.extensionAvailableWhenRequested =
                  extension !== null
                try {
                  observeMultiDrawExtension(extension)
                } catch {
                  state.counterErrors += 1
                }
              }
              return extension
            },
          })
          state.installedExtensionObservers.push(key)
        } catch (error) {
          state.installErrors.push(`${key}: ${String(error)}`)
        }
      }
    },
    { counterName: drawCounterName },
  )
  await page.goto(url.href, { waitUntil: 'domcontentloaded' })
  const game = page.getByTestId('glass-adventure')
  await expect(game).toHaveAttribute('data-ready', 'true', { timeout: 90_000 })
  assert.equal(
    await game.getAttribute('data-checkpoint'),
    'cloudway-checkpoint-arrival',
  )
  const canvas = page.locator('canvas[aria-label="Floating glass museum"]')
  const area = page.getByLabel('Glass museum; drag to look around')
  const waitFrames = (count) =>
    page.evaluate(
      (remaining) =>
        new Promise((resolve) => {
          const step = () => {
            if (--remaining <= 0) resolve()
            else requestAnimationFrame(step)
          }
          requestAnimationFrame(step)
        }),
      count,
    )
  const capture = async (id, action) => {
    await waitFrames(45)
    const file = `${id}.png`
    await page.screenshot({ path: resolve(output, file) })
    screenshots.push({
      file,
      sha256: hash(await readFile(resolve(output, file))),
      action,
      cameraYaw: await game.getAttribute('data-camera-yaw'),
    })
  }
  await capture(
    'arrival',
    'Unmodified arrival camera; no movement or seeded progress.',
  )
  const box = await area.boundingBox()
  assert.ok(box)
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4)
  await page.mouse.wheel(0, -2000)
  await page.mouse.down()
  await page.mouse.move(
    box.x + box.width * 0.5 + 145,
    box.y + box.height * 0.4 + 34,
    { steps: 12 },
  )
  await page.mouse.up()
  await capture(
    'marble-close',
    'Real wheel zoom and mouse orbit; same inputs on each candidate.',
  )
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(
    box.x + box.width * 0.5,
    box.y + box.height * 0.5 - 140,
    { steps: 12 },
  )
  await page.mouse.up()
  await capture(
    'marble-side',
    'Real upward mouse drag lowers the camera to inspect grazing top and edge shading.',
  )
  const sample = await page.evaluate(
    async ({ counterName, frameCount }) => {
      const counters = globalThis[counterName]
      if (!counters || typeof counters.snapshot !== 'function') {
        throw new Error('WebGL draw counters were not installed')
      }
      const intervals = []
      let previous = await new Promise(requestAnimationFrame)
      const before = counters.snapshot()
      for (let i = 0; i < frameCount; i++) {
        const next = await new Promise(requestAnimationFrame)
        intervals.push(next - previous)
        previous = next
      }
      const after = counters.snapshot()
      intervals.sort((a, b) => a - b)
      const subtractBuckets = (afterBuckets, beforeBuckets) =>
        Object.fromEntries(
          Object.entries(afterBuckets).map(([key, bucket]) => [
            key,
            {
              drawCalls:
                bucket.drawCalls - (beforeBuckets[key]?.drawCalls ?? 0),
              triangles:
                bucket.triangles - (beforeBuckets[key]?.triangles ?? 0),
            },
          ]),
        )
      return {
        cadence: {
          medianMs: intervals[Math.floor(frameCount * 0.5)],
          p95Ms: intervals[Math.floor(frameCount * 0.95) - 1],
          maximumMs: intervals[frameCount - 1],
        },
        renderWork: {
          frameIntervals: frameCount,
          drawCalls: after.drawCalls - before.drawCalls,
          passInclusiveTriangles: after.triangles - before.triangles,
          byMethod: subtractBuckets(after.byMethod, before.byMethod),
          byMode: subtractBuckets(after.byMode, before.byMode),
          installedWrappers: after.installedWrappers,
          installedExtensionObservers: after.installedExtensionObservers,
          installErrors: after.installErrors,
          counterErrors: after.counterErrors,
          multiDraw: {
            lifetimeExtensionRequests: after.multiDraw.extensionRequests,
            sampleExtensionRequests:
              after.multiDraw.extensionRequests -
              before.multiDraw.extensionRequests,
            extensionAvailableWhenRequested:
              after.multiDraw.extensionAvailableWhenRequested,
            lifetimeDrawCalls: after.multiDraw.drawCalls,
            sampleDrawCalls:
              after.multiDraw.drawCalls - before.multiDraw.drawCalls,
            sampleByMethod: Object.fromEntries(
              Object.entries(after.multiDraw.byMethod).map(
                ([method, drawCalls]) => [
                  method,
                  drawCalls - (before.multiDraw.byMethod[method] ?? 0),
                ],
              ),
            ),
          },
        },
      }
    },
    { counterName: drawCounterName, frameCount: cadenceFrameCount },
  )
  const { cadence, renderWork } = sample
  assert.deepEqual(renderWork.installErrors, [])
  assert.equal(renderWork.counterErrors, 0)
  assert.deepEqual(renderWork.installedWrappers, [
    'WebGLRenderingContext.drawArrays',
    'WebGLRenderingContext.drawElements',
    'WebGL2RenderingContext.drawArrays',
    'WebGL2RenderingContext.drawElements',
    'WebGL2RenderingContext.drawArraysInstanced',
    'WebGL2RenderingContext.drawElementsInstanced',
  ])
  assert.deepEqual(renderWork.installedExtensionObservers, [
    'WebGLRenderingContext.getExtension(WEBGL_multi_draw)',
    'WebGL2RenderingContext.getExtension(WEBGL_multi_draw)',
  ])
  assert.equal(
    renderWork.multiDraw.lifetimeDrawCalls,
    0,
    'WEBGL_multi_draw is outside the standard draw counters',
  )
  assert.ok(renderWork.drawCalls > 0, 'WebGL draw-call sample must be nonzero')
  assert.ok(
    renderWork.passInclusiveTriangles > 0,
    'WebGL triangle sample must be nonzero',
  )
  assert.equal(
    Object.values(renderWork.byMethod).reduce(
      (total, bucket) => total + bucket.drawCalls,
      0,
    ),
    renderWork.drawCalls,
  )
  assert.equal(
    Object.values(renderWork.byMethod).reduce(
      (total, bucket) => total + bucket.triangles,
      0,
    ),
    renderWork.passInclusiveTriangles,
  )
  assert.equal(
    Object.values(renderWork.byMode).reduce(
      (total, bucket) => total + bucket.drawCalls,
      0,
    ),
    renderWork.drawCalls,
  )
  assert.equal(
    Object.values(renderWork.byMode).reduce(
      (total, bucket) => total + bucket.triangles,
      0,
    ),
    renderWork.passInclusiveTriangles,
  )
  renderWork.meanDrawCallsPerFrameInterval =
    renderWork.drawCalls / cadenceFrameCount
  renderWork.meanPassInclusiveTrianglesPerFrameInterval =
    renderWork.passInclusiveTriangles / cadenceFrameCount
  renderWork.sampleView =
    'Final marble-side grazing view after the recorded upward mouse drag.'
  const renderer = await canvas.evaluate((element) => {
    const gl = element.getContext('webgl2')
    const debug = gl?.getExtension('WEBGL_debug_renderer_info')
    return debug
      ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
      : 'unavailable'
  })
  const assets = await Promise.all(assetWork)
  const report = {
    url: url.href,
    viewport,
    deviceScope: tablet
      ? 'Tablet-sized desktop; not physical tablet'
      : 'Local desktop hardware',
    renderer,
    rasterization: 'Actual WebGL, no suppressed draws',
    candidateOverride: candidate ? relative(repo, candidate) : null,
    screenshots,
    assets,
    cadence,
    cadenceMethod: `${cadenceFrameCount} browser animation-frame intervals, not GPU time or physical-tablet performance`,
    renderWork,
    renderWorkMethod: `Page-init prototype wrappers count one post-native-call delta for drawArrays, drawElements and their WebGL2 instanced variants over the same ${cadenceFrameCount} requestAnimationFrame intervals; all contexts and render passes are included.`,
    renderWorkLimits:
      'Triangles are derived from submitted vertex or index counts for TRIANGLES, TRIANGLE_STRIP and TRIANGLE_FAN. They are not GPU timing and do not account for primitive restart, degenerates, clipping, occlusion, discarded fragments or whether submitted primitives produced pixels. WEBGL_multi_draw entry points are observed separately and must remain unused; WebGL1 ANGLE instancing entry points are outside this WebGL2 capture.',
    errors,
  }
  await writeFile(
    resolve(output, 'manifest.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  )
  console.log(
    JSON.stringify({
      output,
      renderer,
      assets: assets.length,
      cadence,
      renderWork: {
        drawCalls: renderWork.drawCalls,
        passInclusiveTriangles: renderWork.passInclusiveTriangles,
      },
      errors,
    }),
  )
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}

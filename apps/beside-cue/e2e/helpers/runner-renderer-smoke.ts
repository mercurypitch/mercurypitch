// Runner renderer streaming smoke — drive real WebGL through bounded chunk turnover without a live audio clock.

import { expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const HARNESS_PATH = '/__runner-renderer-smoke__.html'
const MODULE_PATH = '/__runner-renderer-smoke__.mjs'

const asViteFileUrl = (path: string): string => `/@fs${path}`

const rendererUrl = asViteFileUrl(
  fileURLToPath(
    new URL(
      '../../../../packages/glass-game/src/render/runner-renderer.ts',
      import.meta.url,
    ),
  ),
)
const courseUrl = asViteFileUrl(
  fileURLToPath(
    new URL(
      '../../../../packages/glass-game/src/runner/first-course.ts',
      import.meta.url,
    ),
  ),
)
const gameUrl = asViteFileUrl(
  fileURLToPath(
    new URL(
      '../../../../packages/glass-game/src/runner/game.ts',
      import.meta.url,
    ),
  ),
)
const tempoUrl = asViteFileUrl(
  fileURLToPath(
    new URL(
      '../../../../packages/glass-game/src/runner/tempo.ts',
      import.meta.url,
    ),
  ),
)
const assetsUrl = asViteFileUrl(
  fileURLToPath(
    new URL(
      '../../../../packages/glass-game/src/browser/assets.ts',
      import.meta.url,
    ),
  ),
)

interface ResourceCounts {
  readonly createdBuffers: number
  readonly deletedBuffers: number
  readonly createdTextures: number
  readonly deletedTextures: number
}

interface StageReport {
  readonly glError: number
  readonly courseBeat: number
  readonly metrics: {
    readonly drawCalls: number
    readonly triangles: number
    readonly residentChunks: number
    readonly targets: number
  }
  readonly resources: ResourceCounts
  readonly scene: {
    readonly chunkIndexes: readonly number[]
    readonly targetIds: readonly string[]
  }
}

interface SmokeReport {
  readonly state: 'passed' | 'failed'
  readonly error?: string
  readonly initial?: StageReport
  readonly beat16?: StageReport
  readonly beat32?: StageReport
  readonly disposed?: {
    readonly canvasConnected: boolean
    readonly contextLosses: number
    readonly postDisposeRender: boolean
    readonly resources: ResourceCounts
    readonly scene: StageReport['scene']
  }
  readonly secondDisposeResources?: ResourceCounts
}

function harnessModule(): string {
  return `
const resourceProbe = globalThis.__runnerRendererResourceProbe;
let renderer;
let failure;

try {
  const Three = await import('/@id/three');
  const [{ createSongRunnerRenderer }, { SINGING_CURRENT }, { createSongRunnerGame }, { runnerBeatToSeconds, runnerSecondsToBeat }, { glassGameAssetUrl }] = await Promise.all([
    import(${JSON.stringify(rendererUrl)}),
    import(${JSON.stringify(courseUrl)}),
    import(${JSON.stringify(gameUrl)}),
    import(${JSON.stringify(tempoUrl)}),
    import(${JSON.stringify(assetsUrl)}),
  ]);

  if (!resourceProbe) throw new Error('The WebGL resource probe was not installed.');
  const container = document.querySelector('#runner-renderer-smoke');
  if (!(container instanceof HTMLElement)) throw new Error('The renderer smoke mount is missing.');

  let scene;
  const originalSceneAdd = Three.Scene.prototype.add;
  Three.Scene.prototype.add = function (...objects) {
    if (scene === undefined) scene = this;
    return originalSceneAdd.apply(this, objects);
  };

  const game = createSongRunnerGame(SINGING_CURRENT, { comfortableMidi: 60 });
  const epoch = 'renderer-streaming-smoke';
  const begun = game.beginEpoch(epoch);
  if (!begun.ok) throw new Error('The renderer smoke could not begin its deterministic epoch.');

  const actionAt = (obstacleId, kind) => {
    const obstacle = SINGING_CURRENT.obstacles.find((candidate) => candidate.id === obstacleId);
    const action = obstacle?.certifiedActions.find((candidate) => candidate.kind === kind);
    if (!action) throw new Error('Missing certified action for ' + obstacleId + '.');
    return (action.launchOpenCourseSeconds + action.launchCloseCourseSeconds) / 2;
  };
  for (const input of [
    { epoch, sequence: 1, atCourseSeconds: actionAt('first-lane-gate', 'lane-transition'), action: 'lane-right' },
    { epoch, sequence: 2, atCourseSeconds: actionAt('first-jump', 'jump'), action: 'jump' },
  ]) {
    if (!game.input(input)) throw new Error('A certified renderer-smoke input was rejected.');
  }

  let contextLosses = 0;
  try {
    renderer = createSongRunnerRenderer(
      container,
      SINGING_CURRENT,
      60,
      (id) => glassGameAssetUrl(id, '/games/'),
      {
        assetProfile: 'mobile',
        initialSnapshot: game.snapshot(),
        onContextLost: () => contextLosses++,
      },
    );
  } finally {
    Three.Scene.prototype.add = originalSceneAdd;
  }

  await renderer.ready;
  if (!scene) throw new Error('The real renderer scene was not captured.');
  const canvas = container.querySelector('canvas');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('The real renderer canvas is missing.');
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('The real renderer did not create WebGL2.');

  const sceneSummary = () => ({
    chunkIndexes: SINGING_CURRENT.chunks.flatMap((chunk, index) =>
      scene.getObjectByName('runner-chunk-' + chunk.id) ? [index] : [],
    ),
    targetIds: SINGING_CURRENT.targets.flatMap((target) =>
      scene.getObjectByName('vessel-' + target.id) ? [target.id] : [],
    ),
  });
  const stage = () => ({
    glError: gl.getError(),
    courseBeat: game.snapshot().courseBeat,
    metrics: renderer.metrics(),
    resources: resourceProbe.snapshot(),
    scene: sceneSummary(),
  });
  const renderCurrent = (deltaSeconds) => {
    const snapshot = game.snapshot();
    if (!renderer.render(snapshot, deltaSeconds))
      throw new Error('The real renderer refused a streaming snapshot.');
    return snapshot;
  };
  let requestedCourseSeconds = 0;
  const advanceToBeat = (beat) => {
    const boundary = runnerBeatToSeconds(SINGING_CURRENT.tempoSegments, beat);
    // The simulation completes whole fixed steps. A musical boundary may lie
    // between them, so render the first completed step across that boundary.
    const destination = boundary + SINGING_CURRENT.movement.fixedStepSeconds;
    while (requestedCourseSeconds < destination - 1e-9) {
      requestedCourseSeconds = Math.min(
        destination,
        requestedCourseSeconds + SINGING_CURRENT.movement.maxCatchUpSeconds / 2,
      );
      game.advanceTo(epoch, requestedCourseSeconds);
      if (game.snapshot().status !== 'running')
        throw new Error('The deterministic renderer smoke entered ' + game.snapshot().status + '.');
    }
    const actualBeat = game.snapshot().courseBeat;
    const latestBeat = runnerSecondsToBeat(SINGING_CURRENT.tempoSegments, destination);
    if (actualBeat < beat - 1e-8 || actualBeat > latestBeat + 1e-8)
      throw new Error('The renderer smoke missed its completed-step beat range: ' + JSON.stringify({ beat, actualBeat, latestBeat }));
  };

  renderCurrent(0);
  const initial = stage();
  advanceToBeat(16);
  renderCurrent(SINGING_CURRENT.movement.maxCatchUpSeconds);
  const beat16 = stage();
  advanceToBeat(32);
  renderCurrent(SINGING_CURRENT.movement.maxCatchUpSeconds);
  const beat32 = stage();

  renderer.dispose();
  const disposed = {
    canvasConnected: canvas.isConnected,
    contextLosses,
    postDisposeRender: renderer.render(game.snapshot(), 0),
    resources: resourceProbe.snapshot(),
    scene: sceneSummary(),
  };
  renderer.dispose();

  globalThis.__runnerRendererSmoke = {
    state: 'passed',
    initial,
    beat16,
    beat32,
    disposed,
    secondDisposeResources: resourceProbe.snapshot(),
  };
} catch (error) {
  failure = error instanceof Error ? error.stack ?? error.message : String(error);
} finally {
  if (failure !== undefined) {
    try {
      renderer?.dispose();
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      failure += '\\nRenderer cleanup failed: ' + message;
    }
    globalThis.__runnerRendererSmoke = { state: 'failed', error: failure };
  }
}
`
}

/** Verifies real scene installation and retirement without making emulator speed a game rule. */
export async function verifyRunnerRendererStreaming(page: Page): Promise<void> {
  const errors: string[] = []
  const onPageError = (error: Error) => errors.push(error.message)
  const onConsole = (message: { type(): string; text(): string }) => {
    if (message.type() === 'error') errors.push(message.text())
  }
  const onRequestFailed = (request: {
    url(): string
    failure(): { errorText: string } | null
  }) => errors.push(`${request.url()} ${request.failure()?.errorText ?? ''}`)
  page.on('pageerror', onPageError)
  page.on('console', onConsole)
  page.on('requestfailed', onRequestFailed)

  await page.addInitScript(() => {
    const counts = {
      createdBuffers: 0,
      deletedBuffers: 0,
      createdTextures: 0,
      deletedTextures: 0,
    }
    const prototype = WebGL2RenderingContext.prototype
    const createBuffer = prototype.createBuffer
    const deleteBuffer = prototype.deleteBuffer
    const createTexture = prototype.createTexture
    const deleteTexture = prototype.deleteTexture
    prototype.createBuffer = function () {
      const value = createBuffer.call(this)
      if (value !== null) counts.createdBuffers++
      return value
    }
    prototype.deleteBuffer = function (value) {
      if (value !== null) counts.deletedBuffers++
      return deleteBuffer.call(this, value)
    }
    prototype.createTexture = function () {
      const value = createTexture.call(this)
      if (value !== null) counts.createdTextures++
      return value
    }
    prototype.deleteTexture = function (value) {
      if (value !== null) counts.deletedTextures++
      return deleteTexture.call(this, value)
    }
    Object.assign(globalThis, {
      __runnerRendererResourceProbe: {
        snapshot: () => ({ ...counts }),
      },
    })
  })

  const htmlRoute = '**/__runner-renderer-smoke__.html'
  const moduleRoute = '**/__runner-renderer-smoke__.mjs'
  await page.route(htmlRoute, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><meta charset="utf-8"><style>html,body,#runner-renderer-smoke{width:100%;height:100%;margin:0;overflow:hidden}</style><div id="runner-renderer-smoke"></div><script type="module" src="${MODULE_PATH}"></script>`,
    }),
  )
  await page.route(moduleRoute, (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: harnessModule(),
    }),
  )

  try {
    const response = await page.goto(HARNESS_PATH)
    expect(response?.ok()).toBe(true)
    await page.waitForFunction(
      () =>
        (
          globalThis as typeof globalThis & {
            __runnerRendererSmoke?: SmokeReport
          }
        ).__runnerRendererSmoke !== undefined,
      undefined,
      { timeout: 90_000 },
    )
    const report = await page.evaluate(
      () =>
        (
          globalThis as typeof globalThis & {
            __runnerRendererSmoke?: SmokeReport
          }
        ).__runnerRendererSmoke,
    )
    expect(report?.state, report?.error).toBe('passed')
    expect(errors).toEqual([])

    expect(report?.initial).toMatchObject({
      glError: 0,
      metrics: { residentChunks: 2, targets: 1 },
      scene: { chunkIndexes: [0, 1], targetIds: ['home-window'] },
    })
    expect(report?.beat16).toMatchObject({
      glError: 0,
      metrics: { residentChunks: 3, targets: 3 },
      scene: {
        chunkIndexes: [0, 1, 2],
        targetIds: ['home-window', 'higher-carafe', 'lower-diadem'],
      },
    })
    expect(report?.beat32).toMatchObject({
      glError: 0,
      metrics: { residentChunks: 3, targets: 3 },
      scene: {
        chunkIndexes: [1, 2, 3],
        targetIds: ['higher-carafe', 'lower-diadem', 'two-note-window'],
      },
    })
    for (const stage of [report?.initial, report?.beat16, report?.beat32]) {
      expect(stage?.metrics.drawCalls).toBeGreaterThan(0)
      expect(stage?.metrics.triangles).toBeGreaterThan(0)
    }
    expect(report!.beat16!.resources.createdBuffers).toBeGreaterThan(
      report!.initial!.resources.createdBuffers,
    )
    expect(report!.beat32!.resources.createdBuffers).toBeGreaterThan(
      report!.beat16!.resources.createdBuffers,
    )
    expect(report!.beat32!.resources.deletedBuffers).toBeGreaterThan(
      report!.beat16!.resources.deletedBuffers,
    )
    expect(report!.beat32!.resources.deletedTextures).toBeGreaterThan(
      report!.beat16!.resources.deletedTextures,
    )
    expect(report?.disposed).toMatchObject({
      canvasConnected: false,
      contextLosses: 0,
      postDisposeRender: false,
      scene: { chunkIndexes: [], targetIds: [] },
    })
    expect(report!.disposed!.resources.deletedBuffers).toBeGreaterThan(
      report!.beat32!.resources.deletedBuffers,
    )
    expect(report!.disposed!.resources.deletedTextures).toBeGreaterThan(
      report!.beat32!.resources.deletedTextures,
    )
    expect(report?.secondDisposeResources).toEqual(report?.disposed?.resources)
  } finally {
    page.off('pageerror', onPageError)
    page.off('console', onConsole)
    page.off('requestfailed', onRequestFailed)
    await page.unroute(htmlRoute)
    await page.unroute(moduleRoute)
  }
}

// Gallery loading diagnostics — two bounded primitive snapshots identify the current loading work on a portable device.
import type { WebGLRenderer } from 'three'
import type { LoadingProgressLedger } from '../loading-progress'
import { getActiveGraphicsCanvasCounts, getGraphicsCanvasDiagnostic, } from './graphics-diagnostics'

let nextAttempt = 0

type GalleryLoadingSubstage =
  | 'initializing'
  | 'assets'
  | 'environment'
  | 'reflection'
  | 'program-compile'
  | 'resident-warmup'
  | 'awaiting-first-frame'
  | 'ready'
  | 'disposed'

interface GalleryLoadingResources {
  readonly canvas?: HTMLCanvasElement
  readonly renderProfile?: 'balanced' | 'high'
  readonly assetProfile?: 'full' | 'mobile'
  readonly drawingBuffer?: readonly [number, number]
  readonly viewport?: readonly [number, number]
  readonly textures?: number
  readonly geometries?: number
  readonly drawCalls?: number
  readonly triangles?: number
}

const elapsed = (now: number, since: number): number =>
  Number.isFinite(now - since)
    ? Math.round(Math.min(86_400_000, Math.max(0, now - since)))
    : 0

function dimensions(
  value: readonly [number, number] | undefined,
): readonly number[] | undefined {
  return value !== undefined &&
    value.every((size) => Number.isFinite(size) && size >= 0)
    ? value.map((size) => Math.round(size))
    : undefined
}

/** The caller creates this only inside the portable-console build boundary. */
export function createGalleryLoadingDiagnostics(
  levelId: string,
  loading: LoadingProgressLedger,
  clock: () => number = () => performance.now(),
) {
  const attemptGeneration = ++nextAttempt
  const boundedLevelId = levelId.slice(0, 100)
  const startedAt = clock()
  let stageStartedAt = startedAt
  let substage: GalleryLoadingSubstage = 'initializing'
  let readyReported = false
  let failureReported = false
  let disposed = false
  const stage = (next: GalleryLoadingSubstage): void => {
    if (disposed || failureReported) return
    substage = next
    stageStartedAt = clock()
    disposed = next === 'disposed'
  }
  return {
    stage,
    progress(): void {
      if (substage !== 'assets' || disposed || failureReported) return
      const pending = loading.diagnosticSnapshot?.()
      if (
        pending !== undefined &&
        pending.pendingCount <= 8 &&
        pending.pendingUnitIds.some((id) => id.startsWith('environment:')) &&
        pending.pendingUnitIds.every(
          (id) =>
            id.startsWith('environment:') ||
            id === 'gpu:programs' ||
            id === 'reflection-probe',
        )
      )
        stage('environment')
    },
    report(
      outcome: 'failure' | 'ready',
      resources: GalleryLoadingResources = {},
    ): void {
      if (disposed || failureReported || (outcome === 'ready' && readyReported))
        return
      if (outcome === 'failure') failureReported = true
      else readyReported = true
      const now = clock()
      const owners = getActiveGraphicsCanvasCounts()
      const counts: Record<string, number> = {}
      for (const key of [
        'textures',
        'geometries',
        'drawCalls',
        'triangles',
      ] as const) {
        const value = resources[key]
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0)
          counts[key] = value
      }
      const drawingBuffer = dimensions(resources.drawingBuffer)
      const viewport = dimensions(resources.viewport)
      const canvasInstance =
        resources.canvas === undefined
          ? undefined
          : getGraphicsCanvasDiagnostic(resources.canvas)?.instance
      console.info('[Glassworks gallery loading]', {
        outcome,
        attemptGeneration,
        levelId: boundedLevelId,
        substage,
        elapsedMs: elapsed(now, startedAt),
        stageElapsedMs: elapsed(now, stageStartedAt),
        ...loading.diagnosticSnapshot?.(),
        ...(canvasInstance === undefined ? {} : { canvasInstance }),
        activeGalleryCount: owners.gallery,
        activeLoadingPreviewCount: owners['loading-merc'],
        ...(resources.renderProfile === 'balanced' ||
        resources.renderProfile === 'high'
          ? { renderProfile: resources.renderProfile }
          : {}),
        ...(resources.assetProfile === 'full' ||
        resources.assetProfile === 'mobile'
          ? { assetProfile: resources.assetProfile }
          : {}),
        ...(drawingBuffer === undefined ? {} : { drawingBuffer }),
        ...(viewport === undefined ? {} : { viewport }),
        ...counts,
      })
    },
  }
}

/** Renderer-owned resource sampling remains lazy until a bounded report is emitted. */
export function createGalleryRendererLoadingDiagnostics(
  levelId: string,
  loading: LoadingProgressLedger,
  renderProfile: () => 'balanced' | 'high',
  assetProfile: 'full' | 'mobile',
) {
  const diagnostics = createGalleryLoadingDiagnostics(levelId, loading)
  let resources: () => GalleryLoadingResources = () => ({
    renderProfile: renderProfile(),
    assetProfile,
  })
  return {
    stage: diagnostics.stage,
    progress: diagnostics.progress,
    attach(renderer: WebGLRenderer, container: HTMLElement): void {
      resources = () => {
        const context = renderer.getContext()
        return {
          canvas: renderer.domElement,
          renderProfile: renderProfile(),
          assetProfile,
          drawingBuffer: [
            context.drawingBufferWidth,
            context.drawingBufferHeight,
          ],
          viewport: [container.clientWidth, container.clientHeight],
          textures: renderer.info.memory.textures,
          geometries: renderer.info.memory.geometries,
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
        }
      }
    },
    reportReady(available: boolean): void {
      if (!available) return
      diagnostics.stage('ready')
      diagnostics.report('ready', resources())
    },
    report(outcome: 'failure' | 'ready'): void {
      diagnostics.report(outcome, resources())
    },
  }
}

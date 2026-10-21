// Collectible rendering proof — controlled real-course snapshots, depth compositing and owned texture cleanup.
import { expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

interface CollectibleRenderReport {
  distance: number
  artwork: {
    scale: number[]
    box: number[]
    material: {
      transparent: boolean
      alphaTest: number
      alphaToCoverage: boolean
      depthTest: boolean
      depthWrite: boolean
      toneMapped: boolean
    }
    texture: { colorSpace: string; width: number; height: number }
  }
  glError: number
  contextLosses: number
}

declare global {
  interface Window {
    collectibleRendererProof: {
      stage(distance: number, scale?: number): CollectibleRenderReport
      depth(
        kind: 'opaque' | 'transmissive',
      ): CollectibleRenderReport & { changedPixels: number }
      dispose(): {
        textureDisposals: number
        secondDisposeTextureDisposals: number
        canvasConnected: boolean
        postDisposeRender: boolean
        contextLosses: number
      }
    }
  }
}

const moduleUrl = (name: string) =>
  `/@fs${fileURLToPath(
    new URL(`../../../../packages/glass-game/src/${name}.ts`, import.meta.url),
  )}`

export async function openCollectibleRenderer(page: Page) {
  await page.route('**/__collectible-renderer.html', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><meta charset="utf-8"><style>html,body,#stage{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="stage"></div><script type="module" src="/__collectible-renderer.mjs"></script>',
    }),
  )
  await page.route('**/__collectible-renderer.mjs', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `
const Three = await import('/@id/three');
const [{ createSongRunnerRenderer }, { SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY: course }, { createSongRunnerGame }, { createRunnerJudge }, tempo, { glassGameAssetUrl }] = await Promise.all([
  import(${JSON.stringify(moduleUrl('render/runner-renderer'))}),
  import(${JSON.stringify(moduleUrl('runner/crystal-obstacle-study'))}),
  import(${JSON.stringify(moduleUrl('runner/game'))}),
  import(${JSON.stringify(moduleUrl('runner/judge'))}),
  import(${JSON.stringify(moduleUrl('runner/tempo'))}),
  import(${JSON.stringify(moduleUrl('browser/assets'))}),
]);
const coursePickup = course.rewards.pickups[0];
const initial = createSongRunnerGame(course, { comfortableMidi: 60 }).snapshot();
const judge = createRunnerJudge(course, 60);
let distance = coursePickup.courseDistanceMeters - 8;
let scene, camera, gpu, renderer, artwork, texture;
let contextLosses = 0, textureDisposals = 0;
let occluder;
function snapshot() {
  const beat = distance / course.metersPerBeat;
  const seconds = tempo.runnerBeatToSeconds(course.tempoSegments, beat);
  const chunk = course.chunks.find(item => distance >= item.minCourseDistanceMeters && distance < item.maxCourseDistanceMeters);
  const active = course.targets.find(item => seconds >= item.visibleFromCourseSeconds && seconds < item.settleAfterCourseSeconds);
  return {
    ...initial, epoch: 'collectible-render-proof', status: 'running',
    courseSeconds: seconds, courseBeat: beat, courseDistanceMeters: distance,
    activeChunkId: chunk.id,
    residentChunkIds: course.chunks.filter(item => Math.abs(item.index - chunk.index) <= 1).map(item => item.id),
    player: { ...initial.player, lateralX: coursePickup.lateralX, targetLane: 0, feetY: course.groundFeetY, grounded: true, lateralVelocityMetersPerSecond: 0, verticalVelocityMetersPerSecond: 0 },
    activeTarget: active ? judge.targetSnapshot(active, seconds) : null,
    upcomingTargetIds: course.targets.filter(item => item.id !== active?.id && item.onsetCourseSeconds > seconds).slice(0, 2).map(item => item.id),
    resolvedTargets: course.targets.filter(item => seconds >= item.settleAfterCourseSeconds).map(item => judge.result(item)),
    collectedRewardIds: [],
  };
}
const originalAdd = Three.Scene.prototype.add;
try {
  Three.Scene.prototype.add = function(...objects) {
    scene ??= this;
    return originalAdd.apply(this, objects);
  };
  renderer = createSongRunnerRenderer(document.querySelector('#stage'), course, 60,
    id => glassGameAssetUrl(id, '/games/'), {
      initialSnapshot: snapshot(), assetProfile: 'mobile', renderQuality: 'balanced',
      collectibleArtworkScale: 1.2, reducedMotion: true,
      onContextLost: () => contextLosses++,
    });
} finally {
  Three.Scene.prototype.add = originalAdd;
}
try {
  await renderer.ready;
  scene.onBeforeRender = (activeRenderer, _scene, activeCamera) => {
    if (activeRenderer.getRenderTarget() === null) { gpu = activeRenderer; camera = activeCamera; }
  };
  const canvas = document.querySelector('canvas');
  const gl = canvas.getContext('webgl2');
  const render = () => {
    if (!renderer.render(snapshot(), 0)) throw new Error('Controlled renderer rejected snapshot.');
    artwork = scene.getObjectByName('runner-collectible-c01');
    if (!artwork) throw new Error('Expected real C01 artwork mesh.');
  };
  render();
  texture = artwork.material.map;
  texture.addEventListener('dispose', () => textureDisposals++);
  const readPixels = () => {
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return pixels;
  };
  const scenePixels = (visible) => {
    // World updates own visibility; change only this owned test mesh immediately
    // before the real WebGL draw, without replacing renderer or course modules.
    const previousScene = scene.onBeforeRender;
    scene.onBeforeRender = (...args) => { previousScene(...args); artwork.visible = visible; };
    render();
    scene.onBeforeRender = previousScene;
    return readPixels();
  };
  const pixelDifference = (a, b) => {
    let changed = 0;
    for (let i = 0; i < a.length; i += 4)
      if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i+1] - b[i+1]), Math.abs(a[i+2] - b[i+2])) > 8) changed++;
    return changed;
  };
  const report = () => {
    scene.updateMatrixWorld(true);
    const box = new Three.Box3().setFromObject(artwork);
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { distance, pickup: { id: coursePickup.id, distance: coursePickup.courseDistanceMeters, radius: coursePickup.radius },
      artwork: { scale: artwork.scale.toArray(), box: box.getSize(new Three.Vector3()).toArray(), material: { transparent: artwork.material.transparent, alphaTest: artwork.material.alphaTest, alphaToCoverage: artwork.material.alphaToCoverage, depthTest: artwork.material.depthTest, depthWrite: artwork.material.depthWrite, toneMapped: artwork.material.toneMapped }, texture: { colorSpace: texture.colorSpace, width: texture.image.width, height: texture.image.height } },
      metrics: renderer.metrics(), gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), glError: gl.getError(), contextLosses };
  };
  window.collectibleRendererProof = {
    stage(nextDistance, scale = 1.2) { distance = nextDistance; renderer.setCollectibleArtworkScale(scale); renderer.resize(); render(); return report(); },
    depth(kind) {
      const position = artwork.getWorldPosition(new Three.Vector3());
      const direction = camera.getWorldPosition(new Three.Vector3()).sub(position).normalize();
      const geometry = new Three.PlaneGeometry(1.5, 1.5);
      const material = kind === 'opaque'
        ? new Three.MeshBasicMaterial({ color: 0x24515a })
        : new Three.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, thickness: 0, roughness: 0, metalness: 0, ior: 1 });
      occluder = new Three.Mesh(geometry, material);
      occluder.position.copy(position).addScaledVector(direction, .15);
      occluder.quaternion.copy(camera.quaternion);
      scene.add(occluder);
      const withArtwork = scenePixels(true), withoutArtwork = scenePixels(false);
      scenePixels(true);
      const result = { kind, changedPixels: pixelDifference(withArtwork, withoutArtwork), ...report() };
      scene.remove(occluder); geometry.dispose(); material.dispose(); occluder = undefined;
      render();
      return result;
    },
    dispose() {
      renderer.dispose();
      const result = { textureDisposals, canvasConnected: canvas.isConnected, postDisposeRender: renderer.render(snapshot(), 0), contextLosses };
      renderer.dispose();
      return { ...result, secondDisposeTextureDisposals: textureDisposals };
    },
  };
  document.body.dataset.ready = 'true';
} catch (error) {
  renderer.dispose();
  document.body.dataset.failure = String(error);
}
`,
    }),
  )
  await page.goto('/__collectible-renderer.html')
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', {
    timeout: 90_000,
  })
}

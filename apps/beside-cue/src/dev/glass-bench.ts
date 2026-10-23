// The glass look bench on a page of its own.
// ============================================================
//
// Dev only: /glass-bench.html is served by Vite in dev and never built (the
// production input is index.html, plus the museum with games on). It renders
// one glass look on the game's renderer settings under a fixed rig, so a look
// is judged on swatches before any vessel wears it
// (docs/plans/glass-look-system-2026-10-23.md, section 7).
//
//   /glass-bench.html?environment=kit&look=studio-amber
//   /glass-bench.html?subject=swatches&toneMapping=neutral
//   /glass-bench.html?hero=/games/adventure-v6/opaline-echo-amphora-qa-v2.glb
//   /glass-bench.html?camera=front&yaw=90&mask=1
//
// The capture script drives window.glassBench.set(...) instead of reloading.

import type { BenchShot, GlassBench } from '@irchiinnuss/glass-game/glass-bench'
import { mountGlassBench, parseBenchShot, } from '@irchiinnuss/glass-game/glass-bench'

declare global {
  interface Window {
    glassBench?: GlassBench
  }
}

const DEFAULT_HERO = '/games/adventure-v6/amber-cadence-urn-qa-v2.glb'
const HDR = '/games/adventure-v2/environment/golden-coast.hdr'

const params = new URLSearchParams(window.location.search)
const canvas = document.querySelector('canvas') as HTMLCanvasElement
const hud = document.getElementById('hud') as HTMLElement

function describe(shot: BenchShot): string {
  return [
    `hero ${shot.hero}`,
    `${shot.subject} · ${shot.look} · ${shot.environment} · ${shot.camera} · yaw ${shot.yaw}`,
    `${shot.toneMapping} at ${shot.exposure}${shot.mask ? ' · mask' : ''}`,
  ].join('\n')
}

try {
  const bench = await mountGlassBench(canvas, {
    hero: DEFAULT_HERO,
    hdr: HDR,
    pixelRatio: Number(params.get('scale') ?? 2),
  })
  const set = bench.set
  window.glassBench = {
    ...bench,
    get shot() {
      return bench.shot
    },
    async set(shot) {
      const applied = await set(shot)
      hud.textContent = describe(applied)
      return applied
    },
  }
  await window.glassBench.set(parseBenchShot(params, DEFAULT_HERO))
  document.body.dataset.ready = 'true'
} catch (error) {
  hud.textContent = `The bench did not start: ${error instanceof Error ? error.message : String(error)}`
  document.body.dataset.ready = 'error'
  throw error
}

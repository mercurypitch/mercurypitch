// Promenade mobile budget — the exact shipped GLBs stay level-scoped and below a measured upload ceiling.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { CLOUDWAY_CRYSTAL_PROMENADE_STUDY } from '../content/cloudway-laboratory'
import { createMuseumAssetLoadPlan } from './asset-load-plan'

interface RuntimeManifest {
  readonly assets: readonly {
    readonly bytes: number
    readonly id: string
    readonly sha256: string
  }[]
}

// Generated with glTF-Transform 4.4.2 inspect. Texture bytes include the full
// RGBA mip chain; mobile bytes apply the runtime 1024 color/normal and 512
// packed-data caps without claiming a physical-device memory measurement.
const PROMENADE_ASSET_BUDGETS = [
  {
    id: 'cloudway-lab-pearl-marble-long-v1',
    sha256: 'dda126cc3c9ea41a326fd06299f1bdf89e1a7e2789b1c2eceb83380c0f9ca861',
    compressedBytes: 1_401_472,
    meshGpuBytes: 2_513_285,
    fullTextureGpuBytes: 33_554_428,
    mobileTextureGpuBytes: 12_582_908,
  },
  {
    id: 'gilt-scroll-bridge-runtime-v1',
    sha256: 'eb141261cc6dc65a2fd889c0984c0cdb2be8bcbb869e44b45d654845c252edba',
    compressedBytes: 4_951_124,
    meshGpuBytes: 11_460_741,
    fullTextureGpuBytes: 67_108_860,
    mobileTextureGpuBytes: 12_582_908,
  },
  {
    id: 'cloudway-lab-rose-crackle-v1',
    sha256: 'faabbbb1c4a4f7019502c79e51299a1fb7317de7315fe3410f8b167caaed5285',
    compressedBytes: 9_491_080,
    meshGpuBytes: 21_753_448,
    fullTextureGpuBytes: 67_108_860,
    mobileTextureGpuBytes: 12_582_908,
  },
  {
    id: 'cloudway-lab-amethyst-crackle-v1',
    sha256: '2a9615df89bbac42be86c14f0ca251c34d8937aa3b6ed7990baf50fb07991b4c',
    compressedBytes: 19_673_144,
    meshGpuBytes: 48_391_151,
    fullTextureGpuBytes: 67_108_860,
    mobileTextureGpuBytes: 12_582_908,
  },
  {
    id: 'cloudway-lab-frost-lily-step-v1',
    sha256: '3a3b8682f14bb463bcb13dc695191279144e1a799e7d5764348d98a3600ea9cf',
    compressedBytes: 3_359_924,
    meshGpuBytes: 7_563_736,
    fullTextureGpuBytes: 33_554_428,
    mobileTextureGpuBytes: 12_582_908,
  },
  {
    id: 'cloudway-lab-aurora-glide-raft-v1',
    sha256: 'a1533a0837faacc4d55df5b9aa1fc8cae303ccd8c9af2f91af2480863dcc570e',
    compressedBytes: 3_035_924,
    meshGpuBytes: 6_592_825,
    fullTextureGpuBytes: 33_554_428,
    mobileTextureGpuBytes: 12_582_908,
  },
  {
    id: 'cloudway-lab-frosted-scroll-wall-v1',
    sha256: 'aac5f64854b052762f997448325d76ce09710c67409740223a8898c0146e3485',
    compressedBytes: 4_341_728,
    meshGpuBytes: 6_704_373,
    fullTextureGpuBytes: 111_848_100,
    mobileTextureGpuBytes: 19_573_412,
  },
] as const

const MANIFEST = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        '../../../../apps/beside-cue/public/games/cloudway-laboratory-v1/manifest.json',
        import.meta.url,
      ),
    ),
    'utf8',
  ),
) as RuntimeManifest

it('loads only Promenade bundles and keeps the mobile texture projection below 96 MiB', () => {
  const expectedIds = PROMENADE_ASSET_BUDGETS.map((asset) => asset.id).sort()
  const deliveredIds = new Set(MANIFEST.assets.map((asset) => asset.id))
  const plan = createMuseumAssetLoadPlan(CLOUDWAY_CRYSTAL_PROMENADE_STUDY)
  const plannedPromenadeIds = plan.bundles
    .filter((id) => deliveredIds.has(id))
    .sort()

  expect(plannedPromenadeIds).toEqual(expectedIds)
  expect(plan.bundles).not.toContain('pearl-ribbon-lantern-v1')

  for (const budget of PROMENADE_ASSET_BUDGETS) {
    const delivered = MANIFEST.assets.find((asset) => asset.id === budget.id)
    expect(delivered).toMatchObject({
      bytes: budget.compressedBytes,
      sha256: budget.sha256,
    })
  }

  const total = (key: keyof (typeof PROMENADE_ASSET_BUDGETS)[number]) =>
    PROMENADE_ASSET_BUDGETS.reduce((sum, budget) => {
      const value = budget[key]
      return sum + (typeof value === 'number' ? value : 0)
    }, 0)

  expect(total('compressedBytes')).toBe(46_254_396)
  expect(total('meshGpuBytes')).toBe(104_979_559)
  expect(total('fullTextureGpuBytes')).toBe(413_837_964)
  expect(total('mobileTextureGpuBytes')).toBe(95_070_860)
  expect(total('mobileTextureGpuBytes')).toBeLessThanOrEqual(96 * 1024 * 1024)
})

// Tiered bundle tests — visual bytes vary by profile while authored bundle/task identity stays stable.

import { Group, MeshPhysicalMaterial, Texture, TextureLoader } from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { afterEach, expect, it, vi } from 'vitest'
import { FROST_GOLD_ARCH_BUNDLE_IDS } from '../content/frost-gold-arch-profile'
import { PEARL_QUARTER_TURN_BUNDLE_IDS } from '../content/pearl-quarter-turn-profile'
import { CLOUDWAY_QUARTER_TURN_ART_STUDY } from '../content/quarter-turn-art-study'
import { loadMuseumAssets } from './asset-kit'
import { resolveAssetProfileBundle } from './asset-profile-bundles'
import { MUSEUM_MATERIAL_CATALOG } from './catalog'
import { CLOUDWAY_LAB_BUNDLE_IDS } from './cloudway-laboratory-catalog'
import type { MuseumMaterials } from './materials'
import type { createMuseum } from './museum'

afterEach(() => vi.restoreAllMocks())

it('resolves the reviewed quarter-turn tier without changing logical ownership', async () => {
  expect(
    resolveAssetProfileBundle(PEARL_QUARTER_TURN_BUNDLE_IDS.logical, 'full'),
  ).toBe(PEARL_QUARTER_TURN_BUNDLE_IDS.desktop)
  expect(
    resolveAssetProfileBundle(PEARL_QUARTER_TURN_BUNDLE_IDS.logical, 'mobile'),
  ).toBe(PEARL_QUARTER_TURN_BUNDLE_IDS.mobile)
  expect(
    resolveAssetProfileBundle(CLOUDWAY_LAB_BUNDLE_IDS.roseHexCrumble, 'full'),
  ).toBe(CLOUDWAY_LAB_BUNDLE_IDS.roseHexCrumbleDesktop)
  expect(
    resolveAssetProfileBundle(CLOUDWAY_LAB_BUNDLE_IDS.roseHexCrumble, 'mobile'),
  ).toBe(CLOUDWAY_LAB_BUNDLE_IDS.roseHexCrumbleMobile)
  expect(
    resolveAssetProfileBundle(FROST_GOLD_ARCH_BUNDLE_IDS.logical, 'full'),
  ).toBe(FROST_GOLD_ARCH_BUNDLE_IDS.desktop)
  expect(
    resolveAssetProfileBundle(FROST_GOLD_ARCH_BUNDLE_IDS.logical, 'mobile'),
  ).toBe(FROST_GOLD_ARCH_BUNDLE_IDS.mobile)
  expect(resolveAssetProfileBundle('unprofiled-bundle', 'mobile')).toBe(
    'unprofiled-bundle',
  )

  const scene = new Group()
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue({
    scene,
    animations: [],
  } as unknown as GLTF)
  vi.spyOn(TextureLoader.prototype, 'loadAsync').mockResolvedValue(
    new Texture() as Awaited<ReturnType<TextureLoader['loadAsync']>>,
  )
  const setKit = vi.fn()
  const installed: string[] = []
  const materials = Object.fromEntries(
    Object.keys(MUSEUM_MATERIAL_CATALOG).map((id) => [
      id,
      new MeshPhysicalMaterial(),
    ]),
  ) as MuseumMaterials
  await loadMuseumAssets(
    CLOUDWAY_QUARTER_TURN_ART_STUDY,
    (id) => `/assets/${id}`,
    new Map(),
    { setKit, setDecorationTexture: vi.fn() } as unknown as ReturnType<
      typeof createMuseum
    >,
    materials,
    vi.fn(),
    () => false,
    undefined,
    (taskId) => installed.push(taskId),
    { assetProfile: 'mobile' },
  )
  expect(GLTFLoader.prototype.loadAsync).toHaveBeenCalledWith(
    `/assets/${PEARL_QUARTER_TURN_BUNDLE_IDS.mobile}`,
  )
  expect(setKit).toHaveBeenCalledWith(
    scene,
    PEARL_QUARTER_TURN_BUNDLE_IDS.logical,
  )
  expect(installed).toContain(`bundle:${PEARL_QUARTER_TURN_BUNDLE_IDS.logical}`)
})

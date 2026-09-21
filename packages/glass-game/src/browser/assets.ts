// ============================================================
// Glassworks assets — one logical-ID map shared by every browser and native host
// ============================================================
//
// Paths are relative to a host-owned game asset directory. The source bytes
// currently live under Beside Cue's public/games directory; web hosts may stage
// only this allowlist elsewhere without changing the IDs authored in levels.

const MATERIALS = [
  'warm-carrara',
  'verde-marble',
  'cream-limestone',
  'brushed-brass',
] as const

const MATERIAL_CHANNELS = ['basecolor', 'normal', 'roughness'] as const

const REACTION_CUES = [
  'beautiful-mess',
  'little-disaster',
  'sparkling',
  'glass-had-plans',
  'music-to-my-ears',
  'cracking-performance',
] as const

export const GLASS_GAME_ASSET_FILES: Readonly<Record<string, string>> = {
  'merc-loading': 'journey/merc-idle.webp',
  merc: 'glass3d/merc.glb',
  'floor-marble': 'adventure/floor-marble.webp',
  'legend-johnny-cash': 'adventure/legend-johnny-cash.webp',
  'museum-kit': 'adventure/platform-kit.glb',
  'museum-sky': 'adventure/museum-sky.webp',
  vessels: 'adventure/vessels.glb',
  'legend-slab': 'adventure/legend-slab.glb',
  'museum-kit-v2': 'adventure-v2/platform-kit.glb',
  'museum-garden-v2': 'adventure-v2/garden-kit.glb',
  'vessels-v2': 'adventure-v2/vessels.glb',
  'museum-environment-v2': 'adventure-v2/environment/golden-coast.hdr',
  'glass-fluted-v3': 'adventure-v3/fluted-carafe.glb',
  'glass-amphora-v3': 'adventure-v3/moon-amphora.glb',
  'glass-coupe-v3': 'adventure-v3/aurora-coupe.glb',
  'glass-decanter-v3': 'adventure-v3/cut-crystal-decanter.glb',
  'museum-column-v3': 'adventure-v3/gilded-column.glb',
  'museum-arcade-v3': 'adventure-v3/garden-arcade.glb',
  'museum-canopy-v3': 'adventure-v3/observatory-canopy.glb',
  'museum-window-v4': 'adventure-v4/museum-window-bay.glb',
  'museum-screen-v4': 'adventure-v4/museum-screen-bay.glb',
  'museum-decor-v5': 'adventure-v5/museum-decor.glb',
  'painting-garden-v5': 'adventure-v5/painting-garden.webp',
  'painting-archive-v5': 'adventure-v5/painting-archive.webp',
  'painting-portrait-v5': 'adventure-v5/painting-portrait.webp',
  'painting-low-note-v6': 'adventure-v6/low-note-keeper.webp',
  'painting-high-note-v6': 'adventure-v6/high-note-muse.webp',
  'painting-interval-v6': 'adventure-v6/interval-between.webp',
  'twin-tone-harp-v6': 'adventure-v6/twin-tone-resonance-harp.glb',
  'opaline-v6': 'adventure-v6/opaline-echo-amphora.glb',
  'amber-v6': 'adventure-v6/amber-cadence-urn.glb',
  'painting-listening-garden-v7': 'adventure-v7/listening-garden.webp',
  'painting-wave-keeper-v7': 'adventure-v7/wave-keeper.webp',
  'floating-museum-map-kit-v1': 'journey-map-v1/floating-museum-map-kit-v1.glb',
  'merc-voice-welcome': 'adventure-voice-v1/merc-d2-welcome.mp3',
  'merc-voice-path-open': 'adventure-voice-v1/merc-d2-path-open.mp3',
  'merc-voice-optional-break': 'adventure-voice-v1/merc-d2-optional-break.mp3',
  ...Object.fromEntries(
    REACTION_CUES.map((cue) => [
      `merc-voice-${cue}`,
      `adventure-voice-v2/merc-d2-${cue}.mp3`,
    ]),
  ),
  'audio-m01-loop': 'adventure-audio-v1/m01-loop.mp3',
  'audio-m03-loop': 'adventure-audio-v1/m03-loop.mp3',
  'audio-a01-loop': 'adventure-audio-v1/a01-loop.mp3',
  'audio-a02-loop': 'adventure-audio-v1/a02-loop.mp3',
  'audio-a03-loop': 'adventure-audio-v1/a03-loop.mp3',
  ...Object.fromEntries(
    MATERIALS.flatMap((material) =>
      MATERIAL_CHANNELS.map((channel) => {
        const id = `${material}-${channel}`
        return [id, `adventure-v2/textures/${id}.png`]
      }),
    ),
  ),
}

const MANIFEST_FILES = [
  'adventure/manifest.json',
  'adventure-v2/manifest.json',
  'adventure-v3/manifest.json',
  'adventure-v5/manifest.json',
  'adventure-v6/manifest.json',
  'adventure-v7/manifest.json',
  'journey-map-v1/manifest.json',
  'adventure-voice-v1/manifest.json',
  'adventure-voice-v2/manifest.json',
] as const

/** Every source byte needed for a cold offline campaign, relative to games/. */
export const GLASS_GAME_REQUIRED_FILES: readonly string[] = Object.freeze([
  ...new Set([...Object.values(GLASS_GAME_ASSET_FILES), ...MANIFEST_FILES]),
])

/** Preserve the legacy authored fallback while centralising every known ID. */
export function glassGameAssetPath(id: string): string {
  return GLASS_GAME_ASSET_FILES[id] ?? `adventure/${id}`
}

export function glassGameAssetUrl(id: string, base: string): string {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return `${normalizedBase}${glassGameAssetPath(id)}`
}

// BesideCue adventure host — the shared museum gets this app's lifecycle and local storage.
import type { LevelDefinition } from '@irchiinnuss/glass-game'
import { createBrowserGlassHost } from '@irchiinnuss/glass-game/browser'
import { GlassAdventure } from '@irchiinnuss/glass-game/solid'
import { subscribeAppForeground } from '@/infrastructure/app-foreground'

interface AdventureScreenProps {
  onExit(): void
  assetBase?: string
  level?: LevelDefinition
}
const files: Record<string, string> = {
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
  'audio-m01-loop': 'adventure-audio-v1/m01-loop.mp3',
  'audio-m03-loop': 'adventure-audio-v1/m03-loop.mp3',
  'audio-a01-loop': 'adventure-audio-v1/a01-loop.mp3',
  'audio-a02-loop': 'adventure-audio-v1/a02-loop.mp3',
  'audio-a03-loop': 'adventure-audio-v1/a03-loop.mp3',
  ...Object.fromEntries(
    [
      'warm-carrara',
      'verde-marble',
      'cream-limestone',
      'brushed-brass',
    ].flatMap((material) =>
      ['basecolor', 'normal', 'roughness'].map((channel) => {
        const id = `${material}-${channel}`
        return [id, `adventure-v2/textures/${id}.png`]
      }),
    ),
  ),
}
export function AdventureScreen(props: AdventureScreenProps) {
  const host = createBrowserGlassHost({
    storagePrefix: 'beside-cue:glass-adventure',
    assetUrl: (id) =>
      `${props.assetBase ?? 'games/'}${files[id] ?? `adventure/${id}`}`,
    subscribeForeground: subscribeAppForeground,
    onExit: () => props.onExit(),
  })
  return <GlassAdventure host={host} level={props.level} />
}

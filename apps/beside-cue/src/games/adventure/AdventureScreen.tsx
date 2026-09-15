// BesideCue adventure host — the shared museum gets this app's lifecycle and local storage.
import { createBrowserGlassHost } from '@irchiinnuss/glass-game/browser'
import { GlassAdventure } from '@irchiinnuss/glass-game/solid'
import { subscribeAppForeground } from '@/infrastructure/app-foreground'

interface AdventureScreenProps {
  onExit(): void
  assetBase?: string
}
const files: Record<string, string> = {
  merc: 'glass3d/merc.glb',
  'floor-marble': 'adventure/floor-marble.webp',
  'legend-johnny-cash': 'adventure/legend-johnny-cash.webp',
  'museum-kit': 'adventure/platform-kit.glb',
  'museum-sky': 'adventure/museum-sky.webp',
  vessels: 'adventure/vessels.glb',
  'legend-slab': 'adventure/legend-slab.glb',
}
export function AdventureScreen(props: AdventureScreenProps) {
  const host = createBrowserGlassHost({
    storagePrefix: 'beside-cue:glass-adventure',
    assetUrl: (id) =>
      `${props.assetBase ?? 'games/'}${files[id] ?? `adventure/${id}`}`,
    subscribeForeground: subscribeAppForeground,
    onExit: () => props.onExit(),
  })
  return <GlassAdventure host={host} />
}

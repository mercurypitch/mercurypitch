// Songbook host — audition original phrases with the real native audio lifecycle.
import { glassGameAssetUrl } from '@irchiinnuss/glass-game/assets'
import { createBrowserGlassHost } from '@irchiinnuss/glass-game/browser'
import { MercSongbook } from '@irchiinnuss/glass-game/songbook'
import { subscribeAppForeground } from '@/infrastructure/app-foreground'

export function CreatorSongbook(props: { onExit(): void; assetBase?: string }) {
  const host = createBrowserGlassHost({
    storagePrefix: 'beside-cue:glass-adventure',
    assetUrl: (id) => glassGameAssetUrl(id, props.assetBase ?? 'games/'),
    subscribeForeground: subscribeAppForeground,
    onExit: () => props.onExit(),
  })
  return <MercSongbook host={host} onClose={() => props.onExit()} />
}

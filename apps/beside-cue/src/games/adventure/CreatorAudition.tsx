// Creator audition host — optional musical experiments share the real device/audio lifecycle.
import { glassGameAssetUrl } from '@irchiinnuss/glass-game/assets'
import { createBrowserGlassHost } from '@irchiinnuss/glass-game/browser'
import { EchoCuratorAudition } from '@irchiinnuss/glass-game/echo-curator'
import { subscribeAppForeground } from '@/infrastructure/app-foreground'

export function CreatorAudition(props: { onExit(): void; assetBase?: string }) {
  const host = createBrowserGlassHost({
    storagePrefix: 'beside-cue:glass-adventure',
    microphonePreferenceKey: 'beside-cue:input-device',
    assetUrl: (id) => glassGameAssetUrl(id, props.assetBase ?? 'games/'),
    subscribeForeground: subscribeAppForeground,
    onExit: () => props.onExit(),
  })
  return <EchoCuratorAudition host={host} onClose={() => props.onExit()} />
}

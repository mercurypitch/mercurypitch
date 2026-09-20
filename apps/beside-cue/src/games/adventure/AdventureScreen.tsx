// BesideCue adventure host — the shared museum gets this app's lifecycle and local storage.
import type { LevelDefinition } from '@irchiinnuss/glass-game'
import { glassGameAssetUrl } from '@irchiinnuss/glass-game/assets'
import { createBrowserGlassHost } from '@irchiinnuss/glass-game/browser'
import { GlassCampaign } from '@irchiinnuss/glass-game/campaign'
import { GlassAdventure } from '@irchiinnuss/glass-game/solid'
import { Show } from 'solid-js'
import { subscribeAppForeground } from '@/infrastructure/app-foreground'

interface AdventureScreenProps {
  onExit(): void
  assetBase?: string
  level?: LevelDefinition
  campaign?: boolean
}
export function AdventureScreen(props: AdventureScreenProps) {
  const host = createBrowserGlassHost({
    storagePrefix: 'beside-cue:glass-adventure',
    assetUrl: (id) => glassGameAssetUrl(id, props.assetBase ?? 'games/'),
    subscribeForeground: subscribeAppForeground,
    onExit: () => props.onExit(),
  })
  return (
    <Show
      when={props.campaign === true && props.level === undefined}
      fallback={<GlassAdventure host={host} level={props.level} />}
    >
      <GlassCampaign host={host} />
    </Show>
  )
}

// BesideCue adventure host — the shared museum gets this app's lifecycle and local storage.
import type { LevelDefinition } from '@irchiinnuss/glass-game'
import { glassGameAssetUrl } from '@irchiinnuss/glass-game/assets'
import { createBrowserGlassHost } from '@irchiinnuss/glass-game/browser'
import { GlassCampaign } from '@irchiinnuss/glass-game/campaign'
import { SongRunnerScreen } from '@irchiinnuss/glass-game/runner'
import { GlassAdventure } from '@irchiinnuss/glass-game/solid'
import { Show } from 'solid-js'
import { BUILD } from '@/build-info'
import { subscribeAppForeground } from '@/infrastructure/app-foreground'
import { getBesideCuePlatform } from '@/infrastructure/mobile-runtime'
import { hasDevelopmentGalleryAccess } from './development-access'
import { nativeGameAssetProfile } from './native-game-asset-profile'

interface AdventureScreenProps {
  onExit(): void
  assetBase?: string
  level?: LevelDefinition
  campaign?: boolean
  runner?: boolean
}
export function AdventureScreen(props: AdventureScreenProps) {
  const assetProfile = nativeGameAssetProfile(
    import.meta.env.VITE_BESIDE_CUE_NATIVE_PLATFORM,
    getBesideCuePlatform(),
  )
  const host = createBrowserGlassHost({
    storagePrefix: 'beside-cue:glass-adventure',
    microphonePreferenceKey: 'beside-cue:input-device',
    assetUrl: (id) => glassGameAssetUrl(id, props.assetBase ?? 'games/'),
    subscribeForeground: subscribeAppForeground,
    onExit: () => props.onExit(),
  })
  return (
    <Show
      when={
        props.runner === true &&
        hasDevelopmentGalleryAccess(BUILD.channel, window.location.search)
      }
      fallback={
        <Show
          when={
            !hasDevelopmentGalleryAccess(
              BUILD.channel,
              window.location.search,
            ) ||
            (props.campaign === true && props.level === undefined)
          }
          fallback={
            <GlassAdventure
              host={host}
              level={props.level}
              assetProfile={assetProfile}
            />
          }
        >
          <GlassCampaign
            host={host}
            assetProfile={assetProfile}
            developmentUnlock={hasDevelopmentGalleryAccess(
              BUILD.channel,
              window.location.search,
            )}
          />
        </Show>
      }
    >
      <SongRunnerScreen host={host} assetProfile={assetProfile} />
    </Show>
  )
}

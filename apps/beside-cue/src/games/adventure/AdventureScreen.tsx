// BesideCue adventure host — the shared museum gets this app's lifecycle and local storage.
import type { LevelDefinition } from '@irchiinnuss/glass-game'
import { glassGameAssetUrl } from '@irchiinnuss/glass-game/assets'
import { createBrowserGlassHost } from '@irchiinnuss/glass-game/browser'
import { GlassCampaign } from '@irchiinnuss/glass-game/campaign'
import type { SingingCurrentTrialPace } from '@irchiinnuss/glass-game/runner'
import { SINGING_CURRENT_CONTINUOUS_TRIAL, SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY, SINGING_CURRENT_CRYSTAL_STUDY, SINGING_CURRENT_TRIALS, SongRunnerScreen, } from '@irchiinnuss/glass-game/runner'
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
  runnerPace?: SingingCurrentTrialPace
  runnerSteering?: 'continuous'
  runnerCamera?: 'close' | 'angled'
  runnerObstacles?: 'crystal-study'
}
export function AdventureScreen(props: AdventureScreenProps) {
  function runnerCourse() {
    const continuous = props.runnerSteering === 'continuous'
    const course =
      props.runnerObstacles === 'crystal-study'
        ? continuous
          ? SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY
          : SINGING_CURRENT_CRYSTAL_STUDY
        : continuous
          ? SINGING_CURRENT_CONTINUOUS_TRIAL
          : props.runnerPace === undefined
            ? undefined
            : SINGING_CURRENT_TRIALS[props.runnerPace]
    if (!course || !continuous || !props.runnerCamera) return course
    return {
      ...course,
      presentation: {
        ...course.presentation,
        cameraProfile:
          props.runnerCamera === 'angled'
            ? ('steering-angled' as const)
            : ('steering-close' as const),
      },
    }
  }
  const assetProfile = nativeGameAssetProfile(
    import.meta.env.VITE_BESIDE_CUE_NATIVE_PLATFORM,
    getBesideCuePlatform(),
  )
  const host = createBrowserGlassHost({
    storagePrefix: 'beside-cue:glass-adventure',
    developmentTuning: BUILD.channel === 'dev' || BUILD.channel === 'ci',
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
      <SongRunnerScreen
        host={host}
        allowCameraTuning={props.runnerSteering === 'continuous'}
        course={runnerCourse()}
        assetProfile={assetProfile}
      />
    </Show>
  )
}

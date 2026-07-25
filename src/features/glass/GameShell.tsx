// ============================================================
// GameShell — the native game flow.
//
// Level map (LevelSelect) → play a level (GlassApp with that level's config) →
// back. Pro levels route to the RevenueCat paywall. Native-only concerns
// (splash hide, Android hardware back) are guarded so this also renders cleanly
// in a browser preview of dist-native.
// ============================================================

import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import type { Component } from 'solid-js'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { isPro } from '@/lib/monetization/revenuecat'
import { GlassApp } from './GlassApp'
import { type GlassLevel, isLevelLocked } from './levels'
import { LevelSelect } from './LevelSelect'
import { Paywall } from './Paywall'
import { closePaywall, openPaywall, paywallOpen, setPaywallOpen } from './paywall-control'

const IconBack: Component = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M15 6l-6 6 6 6" />
  </svg>
)

export const GameShell: Component = () => {
  const [level, setLevel] = createSignal<GlassLevel | null>(null)

  const pick = (l: GlassLevel): void => {
    if (isLevelLocked(l, isPro())) {
      openPaywall()
      return
    }
    setLevel(l)
  }

  onMount(() => {
    if (!Capacitor.isNativePlatform()) return
    void SplashScreen.hide()
    // One-sheet-at-a-time hardware back: paywall → level → exit.
    const handle = CapApp.addListener('backButton', () => {
      if (paywallOpen()) closePaywall()
      else if (level() !== null) setLevel(null)
      else void CapApp.exitApp()
    })
    onCleanup(() => void handle.then((h) => h.remove()))
  })

  return (
    <>
      <Show when={level()} keyed fallback={<LevelSelect onPick={pick} />}>
        {(current) => (
          <div class="game-level">
            <button
              class="game-back"
              onClick={() => setLevel(null)}
              aria-label="Back to levels"
            >
              <IconBack />
              <span>Levels</span>
            </button>
            <GlassApp
              config={current.config}
              level={{ name: current.name, image: current.image, accent: current.accent }}
            />
          </div>
        )}
      </Show>
      <Show when={paywallOpen()}>
        <Paywall onClose={() => setPaywallOpen(false)} />
      </Show>
    </>
  )
}

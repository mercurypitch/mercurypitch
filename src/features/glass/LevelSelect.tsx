// ============================================================
// LevelSelect — the native game's home / level map.
//
// Lists the materials ladder; free levels play immediately, Pro levels show a
// lock and route to the paywall (GameShell decides, via onPick). No emojis —
// inline SVG icons only.
// ============================================================

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { isPro } from '@/lib/monetization/revenuecat'
import { type GlassLevel, isLevelLocked, LEVELS } from './levels'
import './level-select.css'

const IconLock: Component = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
)

const IconArrow: Component = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
)

export const LevelSelect: Component<{
  onPick: (level: GlassLevel) => void
  onJourney?: () => void
}> = (props) => {
  return (
    <div class="ls-root">
      <header class="ls-head">
        <p class="ls-eyebrow">MercuryPitch</p>
        <h1 class="ls-title">Break Glass</h1>
        <p class="ls-sub">
          Sing up to the note the glass rings at, hold it, and shatter it.
        </p>
      </header>

      <Show when={props.onJourney}>
        <button class="ls-card ls-journey" onClick={() => props.onJourney?.()}>
          <img class="ls-thumb" src="/game/merc.webp" alt="" aria-hidden="true" />
          <span class="ls-card-main">
            <span class="ls-card-name">
              Merc's Journey
              <span class="ls-proto">PROTOTYPE</span>
            </span>
            <span class="ls-card-blurb">
              Your voice is the controller — climb the platforms, shatter the gate.
            </span>
          </span>
          <span class="ls-card-icon">
            <IconArrow />
          </span>
        </button>
      </Show>

      <ul class="ls-levels">
        <For each={LEVELS}>
          {(level) => {
            const locked = (): boolean => isLevelLocked(level, isPro())
            return (
              <li>
                <button
                  class="ls-card"
                  classList={{ 'ls-locked': locked() }}
                  style={{ '--accent': level.accent }}
                  onClick={() => props.onPick(level)}
                >
                  <img class="ls-thumb" src={level.image} alt="" aria-hidden="true" />
                  <span class="ls-card-main">
                    <span class="ls-card-name">
                      {level.name}
                      <Show when={level.tier === 'pro'}>
                        <span class="ls-pro">PRO</span>
                      </Show>
                    </span>
                    <span class="ls-card-blurb">{level.blurb}</span>
                  </span>
                  <span class="ls-card-icon">
                    <Show when={locked()} fallback={<IconArrow />}>
                      <IconLock />
                    </Show>
                  </span>
                </button>
              </li>
            )
          }}
        </For>
      </ul>

      <p class="ls-foot">Your audio never leaves this device.</p>
    </div>
  )
}

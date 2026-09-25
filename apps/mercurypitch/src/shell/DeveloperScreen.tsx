// ============================================================
// DeveloperScreen — the panels a TestFlight build has instead of devtools
// ============================================================
//
// The More sheet used to offer "Console", which called `setupDeveloperConsole()`
// — a function that mounts a host for a floating panel which renders nothing
// while its own Settings toggle is off. On the build where it matters most,
// the tap did nothing at all, every time (device round 1, P3).
//
// So the tile pushes this instead: the sections a build registered with
// `registerDeveloperSection`, on a screen with its own Back. The native entry
// registers "Native sign-in" there, which is where the Turnstile hostname a
// failure reports is printed.
//
// The floating console keeps its own switch in Settings and is not moved or
// duplicated here: it is a live log over whatever page you are on, which is a
// different thing from a screen you navigate to.
//
// NOTHING IMPORTS THIS DIRECTLY. `NativeShell` reaches it through a lazy
// import behind `VITE_PORTABLE_CONSOLE`, the same constant the tile and the
// portable console are behind, so a store build carries neither this module
// nor the panels it renders. A static import would have shipped the developer
// sign-in screen — every provider button and the token readout — inside the
// binary a reviewer installs.

import type { Component } from 'solid-js'
import { For } from 'solid-js'
import { TAB_HOME } from '@/features/tabs/constants'
import { developerSections } from '@/lib/developer-sections'
import { resetWelcome, WELCOME_SEEN_KEY } from '../alley/alley-welcome'
import { goToTab } from './shell-navigation'

/**
 * "Replay the welcome": the first run is the alley with its headline, and
 * the headline goes for good on the first door opened. This is the only way
 * to see it again on a phone that has opened one.
 */
const replayWelcome = (): void => {
  resetWelcome()
  goToTab(TAB_HOME)
}

export const DeveloperScreen: Component = () => (
  <div class="mp-dev" data-testid="shell-developer">
    <section class="mp-dev__section" data-developer-section="welcome">
      <h3 class="mp-dev__title">Welcome</h3>
      <button
        type="button"
        class="mp-dev__row"
        data-testid="dev-replay-welcome"
        onClick={replayWelcome}
      >
        <span class="mp-dev__row-title">Replay the welcome</span>
        <span class="mp-dev__row-sub">
          Clears {WELCOME_SEEN_KEY} and opens Rooms, so the alley shows its
          first-run headline again until a door is opened.
        </span>
      </button>
    </section>
    <For each={developerSections()}>
      {(section) => (
        <section class="mp-dev__section" data-developer-section={section.id}>
          <h3 class="mp-dev__title">{section.title}</h3>
          {section.render()}
        </section>
      )}
    </For>
  </div>
)

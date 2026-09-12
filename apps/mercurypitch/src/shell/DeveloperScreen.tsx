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

import type { Component } from 'solid-js'
import { For } from 'solid-js'
import { developerSections } from '@/lib/developer-sections'

export const DeveloperScreen: Component = () => (
  <div class="mp-dev" data-testid="shell-developer">
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

// ============================================================
// Rail — the five fixed destinations
// ============================================================
//
// The kit's iOS floating pill: four items in the glass pill, More as the
// separated circle beside it (kit contract §9). Every target is at least
// 44 pt, the selected item is marked by a filled symbol AND a tinted plate
// AND `aria-current`, and every pick answers with the smallest haptic the
// device has — `hapticTap()` from the platform package, never
// `src/lib/haptics.ts`, whose `navigator.vibrate` does nothing on iOS.
//
// The rail's composition is fixed (build brief §2): it does not consult
// `mobileBarTabs()` or `isTabVisible()`, so the Ear Lab cannot vanish from it
// because of a practice scope.

import { hapticTap } from '@irchiinnuss/mobile-runtime/platform'
import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { RailSymbol } from './RailSymbol'
import type { RailItem, RailItemId } from './shell-navigation'

export interface RailProps {
  items: () => RailItem[]
  selected: () => RailItemId
  stage: () => 'sing' | 'guitar' | 'piano'
  onPick: (item: RailItem) => void
  /** Minimised-on-scroll: only the current item stays (kit §9). */
  minimised?: () => boolean
}

export const Rail: Component<RailProps> = (props) => {
  const pick = (item: RailItem): void => {
    void hapticTap()
    props.onPick(item)
  }

  const tabs = () => props.items().filter((item) => item.id !== 'more')
  const more = () => props.items().find((item) => item.id === 'more')

  return (
    <div
      class="mp-rail-row"
      classList={{ 'is-min': props.minimised?.() === true }}
      data-testid="shell-rail"
    >
      <nav class="mp-rail" aria-label="Tabs">
        <For each={tabs()}>
          {(item) => (
            <button
              type="button"
              class="mp-rail__item"
              data-rail-item={item.id}
              aria-current={props.selected() === item.id ? 'page' : undefined}
              onClick={() => pick(item)}
            >
              <RailSymbol
                id={item.id}
                selected={props.selected() === item.id}
                stage={props.stage()}
              />
              <span class="mp-rail__label">{item.label}</span>
            </button>
          )}
        </For>
      </nav>
      <Show when={more()}>
        {(item) => (
          <button
            type="button"
            class="mp-more-aside"
            data-rail-item="more"
            aria-label="More"
            aria-haspopup="dialog"
            aria-current={props.selected() === 'more' ? 'page' : undefined}
            onClick={() => pick(item())}
          >
            <RailSymbol id="more" />
          </button>
        )}
      </Show>
    </div>
  )
}

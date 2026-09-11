// ============================================================
// CornerTabs — R2's chip, and the column it opens upward
// ============================================================
//
// While the transport holds the band, the current tab becomes a 56 pt chip
// 8 pt above it at the right edge. Tapping it opens the other four tabs
// upward as a column of 44 pt pills, labels to the left of the symbols.
//
// The column closes on a stage tap, after four seconds untouched, on Escape,
// on system back, and when a tab is chosen — that last one parks the run.
// Focus moves into the column when it opens (owner's lock, §9), which is also
// what makes Escape reachable from a keyboard.

import { hapticTap } from '@irchiinnuss/mobile-runtime/platform'
import type { Component } from 'solid-js'
import { createEffect, For, Show } from 'solid-js'
import { RailSymbol } from './RailSymbol'
import type { RailItem, RailItemId } from './shell-navigation'

export interface CornerTabsProps {
  visible: () => boolean
  open: () => boolean
  locked: () => boolean
  /** A session parked elsewhere, while this run is the one on screen. */
  dot: () => boolean
  current: () => RailItemId
  stage: () => 'sing' | 'guitar' | 'piano'
  items: () => RailItem[]
  onToggle: () => void
  /** Re-arm the idle timer: four seconds is for a column nobody is using. */
  onTouch?: () => void
  onPick: (item: RailItem) => void
}

export const CornerTabs: Component<CornerTabsProps> = (props) => {
  let columnRef: HTMLDivElement | undefined

  createEffect(() => {
    if (!props.open()) return
    const first = columnRef?.querySelector<HTMLButtonElement>('button')
    first?.focus()
  })

  const others = () =>
    props.items().filter((item) => item.id !== props.current())

  return (
    <div
      class="mp-corner"
      classList={{
        'is-on': props.visible(),
        'is-open': props.visible() && props.open(),
        'is-locked': props.locked(),
      }}
      data-testid="shell-corner"
    >
      <div
        class="mp-column"
        id="shell-tab-column"
        ref={columnRef}
        onPointerDown={() => props.onTouch?.()}
        onFocusIn={() => props.onTouch?.()}
      >
        <Show when={props.visible() && props.open()}>
          <For each={others()}>
            {(item) => (
              <button
                type="button"
                class="mp-column__item"
                data-column-item={item.id}
                onClick={() => {
                  void hapticTap()
                  props.onPick(item)
                }}
              >
                {item.label}
                <span class="mp-column__sym">
                  <RailSymbol id={item.id} stage={props.stage()} size={24} />
                </span>
              </button>
            )}
          </For>
        </Show>
      </div>
      <button
        type="button"
        class="mp-chip"
        aria-label="Tabs"
        aria-expanded={props.visible() && props.open()}
        aria-controls="shell-tab-column"
        data-testid="shell-chip"
        onClick={() => {
          void hapticTap()
          props.onToggle()
        }}
      >
        <RailSymbol id={props.current()} selected stage={props.stage()} />
        <Show when={props.dot()}>
          <span class="mp-chip__dot" />
        </Show>
      </button>
    </div>
  )
}

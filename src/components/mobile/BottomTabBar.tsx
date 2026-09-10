// ============================================================
// BottomTabBar — mobile primary navigation (+ More sheet).
// ============================================================
//
// The Apple-style floating glass bar (mobile-kit.md §2, decision D1):
// four stable, scope-aware destinations plus a More tab that opens a Sheet
// with every remaining visible tab.
// Visibility is delegated to the existing scope/UI-mode policy. More and the
// swipe gesture still derive from visibleTabOrder, so every visible tab that
// is not pinned here remains reachable in canonical order.
//
// This is the pattern the desktop bar now copies: AppNavTabs shows three
// tabs per group and folds the rest behind a "..." per group. Same
// bargain, one bar per viewport.
//
// Renders ONLY on isNarrow() viewports; AppNavTabs (the desktop top bar)
// unmounts there, and this bar reuses its TAB_META ids/labels/icons —
// same `#tab-*` DOM ids on both viewports, one bar mounted at a time, so
// walkthrough selectors resolve everywhere without per-viewport steps.
// Navigation only — never actions (HIG: actions belong to toolbars).

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import type { TabMeta } from '@/components/AppNavTabs'
import { TAB_META } from '@/components/AppNavTabs'
import { Drum } from '@/components/icons'
import { DesktopHint } from '@/components/mobile/DesktopHint'
import { EllipsisIcon } from '@/components/mobile/icons'
import { Sheet } from '@/components/mobile/Sheet'
import { BusyLink } from '@/components/shared/BusyLink'
import { DRUM_NIGHT_PATH } from '@/features/drum-night/route'
import { GUITAR_NIGHT_PATH } from '@/features/guitar-night/route'
import { PIANO_NIGHT_PATH } from '@/features/piano-night/route'
import { mobileBarTabs, TAB_EXERCISES, TAB_GUITAR, TAB_KARAOKE, TAB_PIANO, tabGroupOf, visibleTabOrder, } from '@/features/tabs/constants'
import { haptics } from '@/lib/haptics'
import { isNarrow } from '@/lib/use-viewport'
import { practiceScope, uiMode } from '@/stores/settings-store'
import type { ActiveTab } from '@/types'
import styles from './BottomTabBar.module.css'

export interface BottomTabBarProps {
  activeTab: () => ActiveTab
  handleTabChange: (tab: ActiveTab) => void
  tabLabel: (tab: ActiveTab) => string
}

export const BottomTabBar: Component<BottomTabBarProps> = (props) => {
  const [moreOpen, setMoreOpen] = createSignal(false)

  // Bar = the stable mobile priority under the current scope/mode. Everything
  // else visible — including personal destinations added to You — lives in
  // More without displacing the scope's core instrument.
  const barTabs = createMemo(() => mobileBarTabs(practiceScope(), uiMode()))

  const moreTabs = createMemo(() => {
    const inBar = new Set(barTabs())
    return visibleTabOrder(practiceScope(), uiMode()).filter(
      (t) => !inBar.has(t),
    )
  })

  const moreIsActive = (): boolean => moreTabs().includes(props.activeTab())

  // The Drum Night door lives with Practice (it is instrument practice),
  // between the instruments and the Exercises drills. When Exercises is in
  // the sheet the door renders just above it; otherwise it anchors after the
  // last practice row, and when the current scope fits every practice tab
  // into the bar itself, it falls back to the end of Play rather than
  // dropping the door entirely.
  const drumNightBeforeTab = createMemo(() =>
    moreTabs().includes(TAB_EXERCISES) ? TAB_EXERCISES : null,
  )
  const drumNightAnchorTab = createMemo(() =>
    drumNightBeforeTab() !== null
      ? null
      : (moreTabs().findLast((tab) => tabGroupOf(tab)?.id === 'practice') ??
        moreTabs().findLast((tab) => tabGroupOf(tab)?.id === 'play')),
  )

  const drumNightDoor = () => (
    <li>
      <BusyLink
        id="nav-drum-night"
        href={DRUM_NIGHT_PATH}
        class={styles.moreRoomLink}
        data-testid="nav-drum-night"
        aria-label="Drum Night — open standalone room"
        busyLabel="Opening Drum Night…"
        onClick={() => setMoreOpen(false)}
      >
        <span class={styles.moreIcon} aria-hidden="true">
          <Drum />
        </span>
        <span class={styles.moreRoomCopy}>
          <strong>Drum Night</strong>
          <small>Open the standalone room</small>
        </span>
      </BusyLink>
    </li>
  )

  /**
   * Piano and Guitar leave the app on a phone, exactly as Drum Night does, so
   * in the sheet they read as doors rather than tabs. A row that looks like
   * every other row but navigates away is the thing worth signalling.
   */
  const instrumentDoor = (tab: ActiveTab) => {
    const piano = tab === TAB_PIANO
    return (
      <li>
        <BusyLink
          id={TAB_META[tab]?.id}
          href={piano ? PIANO_NIGHT_PATH : GUITAR_NIGHT_PATH}
          class={styles.moreRoomLink}
          data-testid={piano ? 'nav-piano-night' : 'nav-guitar-night'}
          aria-label={`${piano ? 'Piano' : 'Guitar'} Night — open standalone room`}
          busyLabel={`Opening ${piano ? 'Piano' : 'Guitar'} Night…`}
          onClick={() => setMoreOpen(false)}
        >
          <span class={styles.moreIcon} aria-hidden="true">
            {renderIcon(TAB_META[tab])}
          </span>
          <span class={styles.moreRoomCopy}>
            <strong>{piano ? 'Piano Night' : 'Guitar Night'}</strong>
            <small>Open the standalone room</small>
          </span>
        </BusyLink>
      </li>
    )
  }

  const pick = (tab: ActiveTab): void => {
    haptics.tapLight()
    setMoreOpen(false)
    // On a phone the standalone Karaoke Night page (/karaoke) is the
    // mobile-tuned experience, so send the Karaoke tab there instead of the
    // in-app studio mixer. This bar only renders on narrow viewports, so
    // desktop and landscape (wider than the breakpoint) still reach the
    // in-app Karaoke tab via the top nav.
    if (tab === TAB_KARAOKE) {
      window.location.assign('/karaoke')
      return
    }
    // Same rule for the two instruments that now have two rooms: on a phone
    // the Night room IS the mobile experience and the workspace is a desktop
    // surface, so there is no question worth asking here. The desktop door
    // (features/instrument-room) never renders on this viewport.
    if (tab === TAB_PIANO) {
      window.location.assign(PIANO_NIGHT_PATH)
      return
    }
    if (tab === TAB_GUITAR) {
      window.location.assign(GUITAR_NIGHT_PATH)
      return
    }
    props.handleTabChange(tab)
  }

  const renderIcon = (meta: TabMeta | undefined) => meta?.icon() ?? null

  return (
    <Show when={isNarrow()}>
      <nav
        class={styles.bar}
        data-tour="mobile-tabbar"
        aria-label="Primary navigation"
      >
        <For each={barTabs()}>
          {(tab) => (
            <button
              id={TAB_META[tab]?.id}
              classList={{
                [styles.tab]: true,
                [styles.active]: props.activeTab() === tab,
              }}
              onClick={() => pick(tab)}
              aria-current={props.activeTab() === tab ? 'page' : undefined}
              aria-label={TAB_META[tab]?.ariaLabel ?? props.tabLabel(tab)}
            >
              <span class={styles.icon}>{renderIcon(TAB_META[tab])}</span>
              <span class={styles.label}>{props.tabLabel(tab)}</span>
            </button>
          )}
        </For>
        <button
          classList={{
            [styles.tab]: true,
            [styles.active]: moreIsActive(),
          }}
          onClick={() => setMoreOpen(true)}
          aria-label="More tabs"
          aria-haspopup="dialog"
          data-tour="mobile-tabbar-more"
        >
          <span class={styles.icon}>
            <EllipsisIcon size={20} />
          </span>
          <span class={styles.label}>More</span>
        </button>
      </nav>

      <Sheet
        isOpen={moreOpen()}
        close={() => setMoreOpen(false)}
        ariaLabel="More tabs"
      >
        <ul class={styles.moreList}>
          <For each={moreTabs()}>
            {(tab) => (
              <>
                <Show when={tab === drumNightBeforeTab()}>
                  {drumNightDoor()}
                </Show>
                <Show
                  when={tab !== TAB_PIANO && tab !== TAB_GUITAR}
                  fallback={instrumentDoor(tab)}
                >
                  <li>
                    {/* Same `#tab-*` id the bar buttons carry. A tab is either in
                    the bar or in this sheet, never both, so the ids stay
                    unique — and a tour or audit script that looks for
                    `#tab-exercises` now resolves it once the sheet is open
                    instead of finding nothing on a phone at all. */}
                    <button
                      id={TAB_META[tab]?.id}
                      classList={{
                        [styles.moreRow]: true,
                        [styles.moreRowActive]: props.activeTab() === tab,
                        active: props.activeTab() === tab,
                      }}
                      onClick={() => pick(tab)}
                      aria-current={
                        props.activeTab() === tab ? 'page' : undefined
                      }
                      aria-label={
                        TAB_META[tab]?.ariaLabel ?? props.tabLabel(tab)
                      }
                    >
                      <span class={styles.moreIcon}>
                        {renderIcon(TAB_META[tab])}
                      </span>
                      {props.tabLabel(tab)}
                    </button>
                  </li>
                </Show>
                <Show when={tab === drumNightAnchorTab()}>
                  {drumNightDoor()}
                </Show>
              </>
            )}
          </For>
        </ul>
        <DesktopHint />
      </Sheet>
    </Show>
  )
}

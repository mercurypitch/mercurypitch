// ============================================================
// BottomTabBar — mobile primary navigation (+ More sheet).
// ============================================================
//
// The Apple-style floating glass bar (mobile-kit.md §2, decision D1):
// the first 4 visible practice-group tabs plus a More tab that opens a
// Sheet with every remaining visible tab. Visibility is delegated to
// the existing scope/UI-mode gating (visibleTabOrder — the same source
// the swipe gesture uses), so the bar can never drift from the app's
// navigation model.
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
import { DesktopHint } from '@/components/mobile/DesktopHint'
import { EllipsisIcon } from '@/components/mobile/icons'
import { Sheet } from '@/components/mobile/Sheet'
import { isTabVisible, TAB_GROUPS, TAB_KARAOKE, visibleTabOrder, } from '@/features/tabs/constants'
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

/** How many tabs fit the bar before the rest overflow into More. */
const BAR_SLOTS = 4

export const BottomTabBar: Component<BottomTabBarProps> = (props) => {
  const [moreOpen, setMoreOpen] = createSignal(false)

  // Bar = the practice group under the current scope/mode, capped at
  // BAR_SLOTS; everything else visible (social, advanced, Settings, and
  // any practice overflow) lives in the More sheet.
  const barTabs = createMemo(() => {
    const practice = TAB_GROUPS.find((g) => g.id === 'practice')?.tabs ?? []
    return practice
      .filter((t) => isTabVisible(t, practiceScope(), uiMode()))
      .slice(0, BAR_SLOTS)
  })

  const moreTabs = createMemo(() => {
    const inBar = new Set(barTabs())
    return visibleTabOrder(practiceScope(), uiMode()).filter(
      (t) => !inBar.has(t),
    )
  })

  const moreIsActive = (): boolean => moreTabs().includes(props.activeTab())

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
              <li>
                <button
                  classList={{
                    [styles.moreRow]: true,
                    [styles.moreRowActive]: props.activeTab() === tab,
                  }}
                  onClick={() => pick(tab)}
                  aria-current={props.activeTab() === tab ? 'page' : undefined}
                >
                  <span class={styles.moreIcon}>
                    {renderIcon(TAB_META[tab])}
                  </span>
                  {props.tabLabel(tab)}
                </button>
              </li>
            )}
          </For>
        </ul>
        <DesktopHint />
      </Sheet>
    </Show>
  )
}

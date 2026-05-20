import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { TAB_ANALYSIS, TAB_CHALLENGES, TAB_COMMUNITY, TAB_COMPOSE, TAB_JAM, TAB_KARAOKE, TAB_LEADERBOARD, TAB_PIANO, TAB_SETTINGS, TAB_SINGING, } from '@/features/tabs/constants'
import type { ActiveTab } from '@/types'

export interface AppNavTabsProps {
  activeTab: () => ActiveTab
  handleTabChange: (tab: ActiveTab) => void
  tabLabel: (tab: ActiveTab) => string
  advancedFeaturesEnabled: () => boolean
  devFeaturesEnabled: () => boolean
  isMobileDrawer?: boolean
}

export const AppNavTabs: Component<AppNavTabsProps> = (props) => {
  return (
    <nav
      id="app-tabs"
      class={`app-tabs-nav ${props.isMobileDrawer === true ? 'mobile-drawer-nav' : 'desktop-nav'}`}
    >
      <div class="tab-group">
        <span class="tab-group-label">Practice</span>
        <button
          id="tab-singing"
          class={`app-tab ${props.activeTab() === TAB_SINGING ? 'active' : ''}`}
          onClick={() => void props.handleTabChange(TAB_SINGING)}
          aria-label="Singing practice"
        >
          <svg
            class="tab-icon"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="currentColor"
          >
            <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path
              d="M19 10v1a7 7 0 0 1-14 0v-1"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
            <line
              x1="12"
              y1="19"
              x2="12"
              y2="22"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
            <line
              x1="8"
              y1="22"
              x2="16"
              y2="22"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          {props.tabLabel(TAB_SINGING)}
        </button>
        <button
          id="tab-falling-notes"
          class={`app-tab ${props.activeTab() === TAB_PIANO ? 'active' : ''}`}
          onClick={() => void props.handleTabChange(TAB_PIANO)}
          aria-label="Falling notes piano"
        >
          <svg
            class="tab-icon"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="currentColor"
          >
            <rect x="2" y="5" width="4" height="15" rx="0.5" />
            <rect x="7" y="5" width="4" height="15" rx="0.5" />
            <rect x="12" y="5" width="4" height="15" rx="0.5" />
            <rect x="17" y="5" width="4" height="15" rx="0.5" />
            <rect
              x="4"
              y="5"
              width="2.5"
              height="10"
              rx="0.5"
              fill="var(--bg-primary)"
            />
            <rect
              x="9.5"
              y="5"
              width="2.5"
              height="10"
              rx="0.5"
              fill="var(--bg-primary)"
            />
            <rect
              x="14.5"
              y="5"
              width="2.5"
              height="10"
              rx="0.5"
              fill="var(--bg-primary)"
            />
          </svg>
          {props.tabLabel(TAB_PIANO)}
        </button>
        <button
          id="tab-karaoke"
          class={`app-tab ${props.activeTab() === TAB_KARAOKE ? 'active' : ''}`}
          onClick={() => void props.handleTabChange(TAB_KARAOKE)}
          aria-label="Karaoke"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" class="tab-icon">
            <path
              fill="currentColor"
              d="M3 6 Q10 10 17 4 L19 4 L17 7 Q10 12 3 12 Z"
            />
            <path
              fill="currentColor"
              d="M3 18 Q10 14 17 20 L19 20 L17 17 Q10 12 3 12 Z"
            />
          </svg>
          {props.tabLabel(TAB_KARAOKE)}
        </button>
      </div>

      <Show when={props.advancedFeaturesEnabled()}>
        <div class="tab-group">
          <span class="tab-group-label">Social</span>
          <button
            id="tab-community"
            class={`app-tab ${props.activeTab() === TAB_COMMUNITY ? 'active' : ''}`}
            onClick={() => void props.handleTabChange(TAB_COMMUNITY)}
            aria-label="Community"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" class="tab-icon">
              <path
                fill="currentColor"
                d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
              />
            </svg>
            {props.tabLabel(TAB_COMMUNITY)}
          </button>
          <button
            id="tab-leaderboard"
            class={`app-tab ${props.activeTab() === TAB_LEADERBOARD ? 'active' : ''}`}
            onClick={() => void props.handleTabChange(TAB_LEADERBOARD)}
            aria-label="Leaderboard"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" class="tab-icon">
              <path
                fill="currentColor"
                d="M5 3H3v18h2V3zm4 0H7v18h2V3zm4 0h-2v18h2V3zm4 0h-2v18h2V3zm4 0h-2v18h2V3z"
              />
            </svg>
            {props.tabLabel(TAB_LEADERBOARD)}
          </button>
          <button
            id="tab-challenges"
            class={`app-tab ${props.activeTab() === TAB_CHALLENGES ? 'active' : ''}`}
            onClick={() => void props.handleTabChange(TAB_CHALLENGES)}
            aria-label="Challenges"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" class="tab-icon">
              <path
                fill="currentColor"
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              />
            </svg>
            {props.tabLabel(TAB_CHALLENGES)}
          </button>
          <Show when={props.devFeaturesEnabled()}>
            <button
              id="tab-jam"
              class={`app-tab ${props.activeTab() === TAB_JAM ? 'active' : ''}`}
              onClick={() => void props.handleTabChange(TAB_JAM)}
              aria-label="Jam session"
            >
              <svg
                class="tab-icon"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              {props.tabLabel(TAB_JAM)}
            </button>
          </Show>
        </div>
      </Show>

      <div class="tab-group">
        <span class="tab-group-label">Advanced</span>
        <button
          id="tab-compose"
          class={`app-tab ${props.activeTab() === TAB_COMPOSE ? 'active' : ''}`}
          onClick={() => void props.handleTabChange(TAB_COMPOSE)}
          aria-label="Compose melodies"
        >
          <svg
            class="tab-icon"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
          {props.tabLabel(TAB_COMPOSE)}
        </button>
        <Show when={props.advancedFeaturesEnabled()}>
          <button
            id="tab-analysis"
            data-testid="tab-analysis"
            class={`app-tab ${props.activeTab() === TAB_ANALYSIS ? 'active' : ''}`}
            onClick={() => void props.handleTabChange(TAB_ANALYSIS)}
            aria-label="Vocal analysis"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" class="tab-icon">
              <path
                fill="currentColor"
                d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
              />
            </svg>
            {props.tabLabel(TAB_ANALYSIS)}
          </button>
        </Show>
        <button
          id="tab-settings"
          data-testid="tab-settings"
          class={`app-tab ${props.activeTab() === TAB_SETTINGS ? 'active' : ''}`}
          onClick={() => void props.handleTabChange(TAB_SETTINGS)}
          aria-label="Settings"
        >
          <svg
            class="tab-icon"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
          {props.tabLabel(TAB_SETTINGS)}
        </button>
      </div>
    </nav>
  )
}

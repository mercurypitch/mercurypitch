import { AppHeader } from '@/components/AppHeader'
import type { MainView } from '@/components/BottomNav'
import { BottomNav } from '@/components/BottomNav'
import { HomePressing } from '@/components/HomePressing'
import { message } from '@/i18n/messages'
import { Selectable } from '@/interaction/selection'
import styles from './HomeScreen.module.css'

interface HomeScreenProps {
  pullText: string
  bSideText: string
  cueContextText?: string
  todayCount: number
  weekCount: number
  paused: boolean
  cueStatePending: boolean
  activeView: MainView
  onChangeView: (view: MainView) => void
  onCueNow: () => void
  onPauseToggle: () => void
  onOpenSettings: () => void
  onOpenGames: () => void
  muted: boolean
  onMuteToggle: () => void
}

export function HomeScreen(props: HomeScreenProps) {
  return (
    <main class="home-screen app-screen app-screen--with-nav">
      <div class={styles.header}>
        <AppHeader actionLabel="Settings" onAction={props.onOpenSettings} />
        <button
          class={`icon-button ${styles.soundToggle}`}
          type="button"
          aria-label={message(props.muted ? 'audio.unmute' : 'audio.mute')}
          aria-pressed={props.muted}
          onClick={() => props.onMuteToggle()}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M11 5 6 9H3v6h3l5 4V5Z" />
            {props.muted ? (
              <path d="m16 9 5 6m0-6-5 6" />
            ) : (
              <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
            )}
          </svg>
        </button>
      </div>
      <section class={styles.intro} aria-labelledby="home-title">
        <h1 id="home-title">{message('home.title')}</h1>
      </section>
      <HomePressing
        sideA={props.pullText}
        sideB={props.bSideText}
        paused={props.paused}
      />

      {props.cueContextText === undefined ? null : (
        <section class="plan-cue-note" aria-label="Your cue">
          <span>Your cue</span>
          <p {...Selectable}>{props.cueContextText}</p>
        </section>
      )}

      <button
        class="cue-now-button"
        type="button"
        onClick={() => props.onCueNow()}
        disabled={props.paused}
        aria-describedby={props.paused ? 'paused-note' : undefined}
      >
        <span class="cue-now-button__disc" aria-hidden="true">
          <span />
        </span>
        <span>
          <strong>Cue me now</strong>
          <small>
            {props.paused
              ? 'Resume this plan first'
              : 'Show the action I chose'}
          </small>
        </span>
      </button>

      <button
        class="games-entry"
        type="button"
        onClick={() => props.onOpenGames()}
      >
        <img src="games/merc.webp" alt="" width="34" height="34" />
        <span>
          <strong>B-side games</strong>
          <small>Sing a few quiet minutes with Merc</small>
        </span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 5 7 7-7 7" />
        </svg>
      </button>

      <div class="home-screen__quiet-controls">
        <button
          class="secondary-button"
          type="button"
          disabled={props.cueStatePending}
          onClick={() => props.onPauseToggle()}
        >
          {props.cueStatePending
            ? 'Updating plan…'
            : props.paused
              ? 'Resume this plan'
              : 'Pause this plan'}
        </button>
        {props.paused ? (
          <p id="paused-note">
            Your plan and history are still here. The daily reminder and Cue me
            now stay off until you resume it.
          </p>
        ) : null}
      </div>
      <BottomNav active={props.activeView} onChange={props.onChangeView} />
    </main>
  )
}

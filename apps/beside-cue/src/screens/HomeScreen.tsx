import { AppHeader } from '@/components/AppHeader'
import type { MainView } from '@/components/BottomNav'
import { BottomNav } from '@/components/BottomNav'
import { MascotStage } from '@/components/MascotStage'
import { CORKY_V023_REST_ART } from '@/content'

interface HomeScreenProps {
  pullText: string
  bSideText: string
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
}

export function HomeScreen(props: HomeScreenProps) {
  return (
    <main class="home-screen app-screen app-screen--with-nav">
      <AppHeader actionLabel="Settings" onAction={props.onOpenSettings} />
      <section class="home-screen__intro" aria-labelledby="home-title">
        <p class="screen-kicker">Your current plan</p>
        <h1 id="home-title">A better choice, kept close.</h1>
      </section>

      <section
        class="active-sleeve"
        classList={{ 'active-sleeve--paused': props.paused }}
        aria-label="Your current plan"
      >
        <div class="active-sleeve__art">
          <MascotStage
            state={props.paused ? 'quiet' : 'rest'}
            artOverride={CORKY_V023_REST_ART}
            compact
          />
          <span class="status-chip">{props.paused ? 'Paused' : 'Ready'}</span>
        </div>
        <div class="active-sleeve__tracks">
          <div class="track-line track-line--a">
            <span>Side A</span>
            <p>{props.pullText}</p>
          </div>
          <svg class="track-turn" viewBox="0 0 40 24" aria-hidden="true">
            <path d="M3 12h31M27 5l7 7-7 7" />
          </svg>
          <div class="track-line track-line--b">
            <span>Side B</span>
            <p>{props.bSideText}</p>
          </div>
        </div>
      </section>

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

      <section class="today-strip" aria-label="Recent reflection">
        <div>
          <span>Today</span>
          <strong>{props.todayCount}</strong>
          <small>Side B {props.todayCount === 1 ? 'choice' : 'choices'}</small>
        </div>
        <div>
          <span>Seven days</span>
          <strong>{props.weekCount}</strong>
          <small>No score to defend</small>
        </div>
      </section>

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

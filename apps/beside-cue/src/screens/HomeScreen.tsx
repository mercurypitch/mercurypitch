import { AppHeader } from '@/components/AppHeader'
import type { MainView } from '@/components/BottomNav'
import { BottomNav } from '@/components/BottomNav'
import { MascotStage } from '@/components/MascotStage'

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
}

export function HomeScreen(props: HomeScreenProps) {
  return (
    <main class="home-screen app-screen app-screen--with-nav">
      <AppHeader actionLabel="Settings" onAction={props.onOpenSettings} />
      <section class="home-screen__intro" aria-labelledby="home-title">
        <p class="screen-kicker">Your active pressing</p>
        <h1 id="home-title">A better choice, kept close.</h1>
      </section>

      <section
        class="active-sleeve"
        classList={{ 'active-sleeve--paused': props.paused }}
        aria-label="Your active cue"
      >
        <div class="active-sleeve__art">
          <MascotStage state={props.paused ? 'quiet' : 'rest'} compact />
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
              ? 'Resume this cue first'
              : 'Bring the B-side into focus'}
          </small>
        </span>
      </button>

      <section class="today-strip" aria-label="Recent reflection">
        <div>
          <span>Today</span>
          <strong>{props.todayCount}</strong>
          <small>B-side {props.todayCount === 1 ? 'turn' : 'turns'}</small>
        </div>
        <div>
          <span>Seven days</span>
          <strong>{props.weekCount}</strong>
          <small>No score to defend</small>
        </div>
      </section>

      <div class="home-screen__quiet-controls">
        <button
          class="secondary-button"
          type="button"
          disabled={props.cueStatePending}
          onClick={() => props.onPauseToggle()}
        >
          {props.cueStatePending
            ? 'Updating cue…'
            : props.paused
              ? 'Resume cue'
              : 'Pause cue'}
        </button>
        {props.paused ? (
          <p id="paused-note">
            This cue and its history are still here. Scheduled and manual cues
            stay quiet.
          </p>
        ) : null}
      </div>
      <BottomNav active={props.activeView} onChange={props.onChangeView} />
    </main>
  )
}

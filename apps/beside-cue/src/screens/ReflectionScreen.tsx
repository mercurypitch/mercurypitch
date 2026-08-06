import { For } from 'solid-js'
import { AppHeader } from '@/components/AppHeader'
import type { MainView } from '@/components/BottomNav'
import { BottomNav } from '@/components/BottomNav'

export interface ReflectionDay {
  key: string
  label: string
  count: number
  today: boolean
}

interface ReflectionScreenProps {
  todayCount: number
  weekCount: number
  days: readonly ReflectionDay[]
  activeView: MainView
  onChangeView: (view: MainView) => void
  onOpenSettings: () => void
}

export function ReflectionScreen(props: ReflectionScreenProps) {
  const peak = () => Math.max(1, ...props.days.map((day) => day.count))

  return (
    <main class="reflection-screen app-screen app-screen--with-nav">
      <AppHeader
        label="Reflection"
        actionLabel="Settings"
        onAction={props.onOpenSettings}
      />
      <section
        class="reflection-screen__intro"
        aria-labelledby="reflection-title"
      >
        <p class="screen-kicker">A record, not a score</p>
        <h1 id="reflection-title">Small turns leave a trace.</h1>
        <p>
          Your B-side choices are kept here without streaks, targets, or
          missed-cue counts.
        </p>
      </section>
      <section class="reflection-totals" aria-label="B-side choice totals">
        <div>
          <span>Today</span>
          <strong>{props.todayCount}</strong>
        </div>
        <p>Coming back matters.</p>
        <div>
          <span>Seven days</span>
          <strong>{props.weekCount}</strong>
        </div>
      </section>
      <section class="week-grooves" aria-labelledby="week-title">
        <div class="week-grooves__heading">
          <h2 id="week-title">This quiet week</h2>
          <span>B-side turns</span>
        </div>
        <div class="week-grooves__chart">
          <For each={props.days}>
            {(day) => (
              <div
                class="day-groove"
                classList={{ 'day-groove--today': day.today }}
              >
                <span class="day-groove__count">{day.count}</span>
                <div class="day-groove__track" aria-hidden="true">
                  <span
                    style={{
                      height: `${Math.max(day.count === 0 ? 6 : 22, (day.count / peak()) * 100)}%`,
                    }}
                  />
                </div>
                <span class="day-groove__label">{day.label}</span>
              </div>
            )}
          </For>
        </div>
        <p
          class="week-grooves__empty"
          classList={{ 'week-grooves__empty--hidden': props.weekCount > 0 }}
        >
          Your first turn will appear here. Nothing is late.
        </p>
      </section>
      <blockquote>“No score to defend. Just another cue.”</blockquote>
      <BottomNav active={props.activeView} onChange={props.onChangeView} />
    </main>
  )
}

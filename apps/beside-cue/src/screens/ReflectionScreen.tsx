import { For } from 'solid-js'
import { AppHeader } from '@/components/AppHeader'
import type { MainView } from '@/components/BottomNav'
import { BottomNav } from '@/components/BottomNav'
import { useCopy } from '@/i18n/ui-copy'

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
  const copy = useCopy()
  const peak = () => Math.max(1, ...props.days.map((day) => day.count))

  return (
    <main class="reflection-screen app-screen app-screen--with-nav">
      <AppHeader
        label={copy.t('Reflection')}
        actionLabel={copy.t('Settings')}
        onAction={props.onOpenSettings}
      />
      <section
        class="reflection-screen__intro"
        aria-labelledby="reflection-title"
      >
        <p class="screen-kicker">{copy.t('A record, not a score')}</p>
        <h1 id="reflection-title">{copy.t('Small turns leave a trace.')}</h1>
        <p>
          {copy.t(
            'Your Side B choices are kept here without streaks, targets, or missed-cue counts.',
          )}
        </p>
      </section>
      <section
        class="reflection-totals"
        aria-label={copy.t('Side B choice totals')}
      >
        <div>
          <span>{copy.t('Today')}</span>
          <strong>{props.todayCount}</strong>
        </div>
        <p>{copy.t('Coming back matters.')}</p>
        <div>
          <span>{copy.t('Seven days')}</span>
          <strong>{props.weekCount}</strong>
        </div>
      </section>
      <section class="week-grooves" aria-labelledby="week-title">
        <div class="week-grooves__heading">
          <h2 id="week-title">{copy.t('Past 7 days')}</h2>
          <span>{copy.t('Side B choices')}</span>
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
          {copy.t('Your first turn will appear here. Nothing is late.')}
        </p>
      </section>
      <blockquote>
        {copy.t('“No score to defend. Just another cue.”')}
      </blockquote>
      <BottomNav active={props.activeView} onChange={props.onChangeView} />
    </main>
  )
}

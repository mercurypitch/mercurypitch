export type MainView = 'cue' | 'reflection'

interface BottomNavProps {
  active: MainView
  onChange: (view: MainView) => void
}

export function BottomNav(props: BottomNavProps) {
  const copy = useCopy()

  return (
    <nav class="bottom-nav" aria-label={copy.t('Main navigation')}>
      <button
        type="button"
        classList={{ 'bottom-nav__item--active': props.active === 'cue' }}
        aria-current={props.active === 'cue' ? 'page' : undefined}
        onClick={() => props.onChange('cue')}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
        <span>{copy.t('Cue')}</span>
      </button>
      <button
        type="button"
        classList={{
          'bottom-nav__item--active': props.active === 'reflection',
        }}
        aria-current={props.active === 'reflection' ? 'page' : undefined}
        onClick={() => props.onChange('reflection')}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 18v-5M12 18V7M19 18v-8" />
        </svg>
        <span>{copy.t('Reflection')}</span>
      </button>
    </nav>
  )
}
import { useCopy } from '@/i18n/ui-copy'

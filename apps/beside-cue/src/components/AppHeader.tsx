import { BrandMark } from './BrandMark'

interface AppHeaderProps {
  label?: string
  onBack?: () => void
  actionLabel?: string
  onAction?: () => void
}

export function AppHeader(props: AppHeaderProps) {
  return (
    <header class="app-header">
      {props.onBack === undefined ? (
        <BrandMark compact />
      ) : (
        <button
          class="icon-button"
          type="button"
          onClick={props.onBack}
          aria-label="Go back"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m15 5-7 7 7 7" />
          </svg>
        </button>
      )}
      {props.label === undefined ? null : (
        <p class="app-header__label">{props.label}</p>
      )}
      {props.onAction === undefined ? (
        <span class="app-header__spacer" aria-hidden="true" />
      ) : (
        <button class="text-button" type="button" onClick={props.onAction}>
          {props.actionLabel}
        </button>
      )}
    </header>
  )
}

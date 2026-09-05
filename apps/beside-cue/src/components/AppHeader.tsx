import type { JSX } from 'solid-js'
import { children } from 'solid-js'
import { useCopy } from '@/i18n/ui-copy'
import { BrandMark } from './BrandMark'

interface AppHeaderProps {
  label?: string
  onBack?: () => void
  actionLabel?: string
  onAction?: () => void
  actionAccessory?: JSX.Element
}

export function AppHeader(props: AppHeaderProps) {
  const copy = useCopy()
  const accessory = children(() => props.actionAccessory)
  const action = () =>
    props.onAction === undefined ? (
      <span class="app-header__spacer" aria-hidden="true" />
    ) : (
      <button class="text-button" type="button" onClick={props.onAction}>
        {props.actionLabel}
      </button>
    )

  return (
    <header class="app-header">
      {props.onBack === undefined ? (
        <BrandMark compact />
      ) : (
        <button
          class="icon-button"
          type="button"
          onClick={props.onBack}
          aria-label={copy.t('Go back')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m15 5-7 7 7 7" />
          </svg>
        </button>
      )}
      {props.label === undefined ? null : (
        <p class="app-header__label">{props.label}</p>
      )}
      {accessory() === undefined ? (
        action()
      ) : (
        <div class="app-header__actions">
          {action()}
          {accessory()}
        </div>
      )}
    </header>
  )
}

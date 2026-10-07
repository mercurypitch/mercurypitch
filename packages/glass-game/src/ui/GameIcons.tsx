// Glassworks icon controls — live SVG symbols remain independent of generated material artwork.
import { Show } from 'solid-js'
import styles from './GameUI.module.css'

export type GameIconName =
  | 'museum'
  | 'settings'
  | 'close'
  | 'help'
  | 'speaker'
  | 'tuning'
  | 'play'
  | 'arrow'
  | 'moon'
  | 'sun'
export function GameIcon(props: { name: GameIconName; class?: string }) {
  return (
    <svg
      class={`${styles.icon} ${props.class ?? ''}`}
      viewBox="0 0 24 24"
      data-game-icon={props.name}
      fill="none"
      aria-hidden="true"
    >
      <Show when={props.name === 'museum'}>
        <g class={styles.temple} transform="scale(.25)">
          <path fill-rule="evenodd" d="M9 28 48 8 87 28H9ZM28 25H68L48 15Z" />
          <path d="M10 30H86V36H10Z M13 76H83V82H13Z M7 85H89V91H7Z" />
          <path d="M17 40H29V43H27V69H29V72H17V69H19V43H17Z M34 40H46V43H44V69H46V72H34V69H36V43H34Z M51 40H63V43H61V69H63V72H51V69H53V43H51Z M68 40H80V43H78V69H80V72H68V69H70V43H68Z" />
        </g>
      </Show>
      <Show when={props.name === 'settings'}>
        <path
          d="m9 3-.7 2.3-2.1 1.2L4 6l-1.5 2.6L4 10.3v2.4l-1.5 1.7L4 17l2.2-.5 2.1 1.2L9 20h3l.7-2.3 2.1-1.2L17 17l1.5-2.6-1.5-1.7v-2.4l1.5-1.7L17 6l-2.2.5-2.1-1.2L12 3H9Z"
          transform="translate(1.5 .5)"
        />
        <circle cx="12" cy="12" r="3" />
      </Show>
      <Show when={props.name === 'close'}>
        <path d="m6 6 12 12M18 6 6 18" />
      </Show>
      <Show when={props.name === 'help'}>
        <path d="M9 8a3 3 0 1 1 4 2.8c-1 .4-1 1-1 2.2m0 4h.01" />
        <circle cx="12" cy="12" r="9" />
      </Show>
      <Show when={props.name === 'speaker'}>
        <path d="M4 9h4l5-4v14l-5-4H4V9Zm12-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
      </Show>
      <Show when={props.name === 'tuning'}>
        <path d="M7 3v7a5 5 0 0 0 10 0V3m-5 12v7" />
      </Show>
      <Show when={props.name === 'play'}>
        <path d="m8 4 12 8-12 8V4Z" />
      </Show>
      <Show when={props.name === 'arrow'}>
        <path d="M4 12h16m-6-6 6 6-6 6" />
      </Show>
      <Show when={props.name === 'moon'}>
        <path d="M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z" />
      </Show>
      <Show when={props.name === 'sun'}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </Show>
    </svg>
  )
}

export function GameIconButton(props: {
  label: string
  icon: GameIconName
  onClick(): void
  class?: string
  disabled?: boolean
}) {
  return (
    <button
      class={`${styles.iconButton} ${props.class ?? ''}`}
      type="button"
      aria-label={props.label}
      title={props.label}
      disabled={props.disabled}
      onClick={() => props.onClick()}
    >
      <GameIcon name={props.icon} />
    </button>
  )
}

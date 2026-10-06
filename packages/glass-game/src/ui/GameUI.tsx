// Crystal game UI — shared layered materials, appearance controls and accessible settings shell.
import type { JSX } from 'solid-js'
import { createContext, createEffect, createMemo, createSignal, createUniqueId, For, onCleanup, onMount, Show, untrack, useContext, } from 'solid-js'
import type { GlassGameHost } from '../host'
import { focusDialog, trapDialogKeys } from './dialog-focus'
import type { GameAppearanceChoice, GameMaterialValues, } from './game-appearance'
import { DEFAULT_GAME_MATERIAL, GAME_APPEARANCE_KEY, GAME_MATERIAL_KEY, GAME_MATERIAL_RANGES, gameThemeFromApp, normalizeGameMaterial, readGameAppearance, readGameMaterial, } from './game-appearance'
import { GameMaterialFrame } from './GameMaterialFrame'
import styles from './GameUI.module.css'

function createAppearance(host: GlassGameHost) {
  const [preference, setPreference] = createSignal(
    readGameAppearance(host.readPreference(GAME_APPEARANCE_KEY)),
  )
  const [material, setMaterial] = createSignal(
    readGameMaterial(host.readPreference(GAME_MATERIAL_KEY)),
  )
  const [appTheme, setAppTheme] = createSignal(
    gameThemeFromApp(document.documentElement.getAttribute('data-theme')),
  )
  const theme = createMemo(() =>
    preference().theme === 'app' ? appTheme() : preference().theme,
  )
  onMount(() => {
    const observer = new MutationObserver(() =>
      setAppTheme(
        gameThemeFromApp(document.documentElement.getAttribute('data-theme')),
      ),
    )
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    onCleanup(() => observer.disconnect())
  })
  const changePreference = (
    patch: Partial<ReturnType<typeof preference>>,
  ): void => {
    const next = { ...preference(), ...patch }
    setPreference(next)
    host.writePreference(GAME_APPEARANCE_KEY, JSON.stringify(next))
  }
  const changeMaterial = (patch: Partial<GameMaterialValues>): void => {
    const next = normalizeGameMaterial({ ...material(), ...patch })
    setMaterial(next)
    host.writePreference(GAME_MATERIAL_KEY, JSON.stringify(next))
  }
  return { preference, material, theme, changePreference, changeMaterial }
}
const AppearanceContext = createContext<ReturnType<typeof createAppearance>>()

export function GameUIProvider(props: {
  host: GlassGameHost
  children: JSX.Element
}) {
  // Campaign overlays and visits share one appearance owner across scene handoffs.
  if (useContext(AppearanceContext) !== undefined) return <>{props.children}</>
  const appearance = createAppearance(untrack(() => props.host))
  const variables = (): JSX.CSSProperties => ({
    '--game-opacity': appearance.preference().reducedTransparency
      ? '1'
      : `${appearance.material().opacity}`,
    '--game-settings-opacity': appearance.preference().reducedTransparency
      ? '1'
      : `${appearance.material().opacity}`,
    '--game-gloss': `${appearance.material().gloss}`,
    '--game-rim': `${appearance.material().rim}`,
    '--game-gold-strength': `${appearance.material().gold}`,
    '--game-corner': `${appearance.material().corner}px`,
    '--game-padding': `${appearance.material().padding}px`,
    '--game-target': `${appearance.material().target}px`,
  })
  return (
    <AppearanceContext.Provider value={appearance}>
      <div
        class={styles.root}
        data-game-theme={appearance.theme()}
        data-game-transparency={
          appearance.preference().reducedTransparency ? 'reduced' : 'glass'
        }
        style={variables()}
      >
        {props.children}
      </div>
    </AppearanceContext.Provider>
  )
}

export function GameSurface(props: {
  children: JSX.Element
  class?: string
  kind?: 'panel' | 'plaque' | 'tile'
}) {
  const appearance = useContext(AppearanceContext)
  let surface!: HTMLDivElement
  const [size, setSize] = createSignal({ width: 1, height: 1 })
  onMount(() => {
    const measure = (): void => {
      const bounds = surface.getBoundingClientRect()
      if (bounds.width <= 0 || bounds.height <= 0) return
      setSize((previous) =>
        previous.width === bounds.width && previous.height === bounds.height
          ? previous
          : { width: bounds.width, height: bounds.height },
      )
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(surface)
    onCleanup(() => observer.disconnect())
  })
  // A compact museum plaque uses the tile material without changing its button owner.
  const frameKind = () =>
    props.kind === 'plaque' && size().width <= 58
      ? 'tile'
      : (props.kind ?? 'panel')
  return (
    <div
      ref={surface}
      class={`${styles.surface} ${props.class ?? ''}`}
      data-game-surface={props.kind ?? 'panel'}
    >
      <Show when={size().width > 1 && size().height > 1}>
        <GameMaterialFrame
          width={size().width}
          height={size().height}
          kind={frameKind()}
          theme={appearance?.theme() === 'dark' ? 'dark' : 'light'}
          corner={appearance?.material().corner ?? 24}
        />
      </Show>
      {props.children}
    </div>
  )
}

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

export function GameMuseumButton(props: { onClick(): void; label?: string }) {
  return (
    <GameSurface kind="plaque" class={styles.museumPlaque}>
      <button
        type="button"
        aria-label={props.label ?? 'Leave museum'}
        onClick={() => props.onClick()}
      >
        <GameIcon name="museum" />
        <span>Museum</span>
      </button>
    </GameSurface>
  )
}

export function GameAppearanceControls() {
  const appearance = useContext(AppearanceContext)
  return (
    <Show when={appearance}>
      {(state) => (
        <fieldset class={styles.controlGroup}>
          <legend>Appearance</legend>
          <div class={styles.choices} role="group" aria-label="Game appearance">
            <For
              each={
                [
                  { id: 'light', label: 'Crystal', icon: 'sun' },
                  { id: 'dark', label: 'Celadon', icon: 'moon' },
                  { id: 'app', label: 'Follow app', icon: 'settings' },
                ] as const
              }
            >
              {(choice) => (
                <button
                  type="button"
                  aria-pressed={state().preference().theme === choice.id}
                  onClick={() =>
                    state().changePreference({
                      theme: choice.id as GameAppearanceChoice,
                    })
                  }
                >
                  <GameIcon name={choice.icon} />
                  {choice.label}
                </button>
              )}
            </For>
          </div>
          <label class={styles.check}>
            <input
              type="checkbox"
              checked={state().preference().reducedTransparency}
              onChange={(event) =>
                state().changePreference({
                  reducedTransparency: event.currentTarget.checked,
                })
              }
            />{' '}
            Reduced transparency
          </label>
          <small>
            Changes the controls. The world and your sound settings stay the
            same.
          </small>
        </fieldset>
      )}
    </Show>
  )
}

const MATERIAL_LABELS: Record<keyof GameMaterialValues, string> = {
  opacity: 'Glass backing',
  gloss: 'Gloss',
  rim: 'Rim brightness',
  gold: 'Gold warmth',
  corner: 'Corner size',
  padding: 'Panel inset',
  target: 'Note diameter',
}

function formatMaterialValue(
  value: number,
  key: keyof GameMaterialValues,
): string {
  return value.toFixed(
    ['opacity', 'gloss', 'rim', 'gold'].includes(key) ? 2 : 0,
  )
}
export function GameMaterialControls() {
  const appearance = useContext(AppearanceContext)
  return (
    <Show when={appearance}>
      {(state) => (
        <fieldset class={styles.controlGroup}>
          <legend>Material workshop</legend>
          <GameSurface class={styles.materialSample}>
            <GameIcon name="museum" />
            <strong>Glassworks</strong>
            <span>Live material preview</span>
          </GameSurface>
          <For
            each={
              Object.keys(GAME_MATERIAL_RANGES) as (keyof GameMaterialValues)[]
            }
          >
            {(key) => (
              <label class={styles.range}>
                <span>
                  {MATERIAL_LABELS[key]}
                  <output>
                    {formatMaterialValue(state().material()[key], key)}
                  </output>
                </span>
                <input
                  type="range"
                  aria-label={MATERIAL_LABELS[key]}
                  min={GAME_MATERIAL_RANGES[key][0]}
                  max={GAME_MATERIAL_RANGES[key][1]}
                  step={GAME_MATERIAL_RANGES[key][2]}
                  value={state().material()[key]}
                  onInput={(event) =>
                    state().changeMaterial({
                      [key]: event.currentTarget.valueAsNumber,
                    })
                  }
                />
              </label>
            )}
          </For>
          <button
            class={styles.secondary}
            type="button"
            onClick={() => state().changeMaterial(DEFAULT_GAME_MATERIAL)}
          >
            Reset materials
          </button>
        </fieldset>
      )}
    </Show>
  )
}

export interface GameSettingsSection {
  id: string
  label: string
  content: () => JSX.Element
}
export function GameSettingsDialog(props: {
  open: boolean
  onClose(): void
  onClosed?(): void
  onExit?(): void
  exitLabel?: string
  sections: readonly GameSettingsSection[]
}) {
  const id = createUniqueId()
  const [selected, setSelected] = createSignal('')
  const active = createMemo(
    () =>
      props.sections.find((section) => section.id === selected()) ??
      props.sections[0],
  )
  let dialog!: HTMLDialogElement
  let opener: HTMLElement | null = null
  let alive = true
  const close = (): void => props.onClose()
  createEffect(() => {
    if (props.open && !dialog.open) {
      opener =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
      dialog.showModal()
      focusDialog(dialog)
    } else if (!props.open && dialog.open) dialog.close()
  })
  onCleanup(() => {
    alive = false
    if (dialog.open) dialog.close()
  })
  const tabKey = (event: KeyboardEvent, index: number): void => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const count = props.sections.length
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? count - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + count) % count
    const section = props.sections.at(next)
    if (section !== undefined) {
      setSelected(section.id)
      document.getElementById(`${id}-${section.id}-tab`)?.focus()
    }
  }
  return (
    <dialog
      ref={dialog}
      class={styles.settingsDialog}
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onClose={() => {
        if (!alive || dialog.open) return
        if (props.open) close()
        if (opener !== null && opener.isConnected)
          opener.focus({ preventScroll: true })
        props.onClosed?.()
      }}
      onKeyDown={(event) => {
        event.stopPropagation()
        trapDialogKeys(event)
      }}
    >
      <GameSurface class={styles.settingsSurface}>
        <header class={styles.settingsHeader}>
          <div>
            <span class={styles.eyebrow}>Glassworks</span>
            <h2 id={`${id}-title`}>Settings</h2>
          </div>
          <GameIconButton icon="close" label="Close settings" onClick={close} />
        </header>
        <nav class={styles.tabs} role="tablist" aria-label="Settings sections">
          <For each={props.sections}>
            {(section, index) => (
              <button
                id={`${id}-${section.id}-tab`}
                type="button"
                role="tab"
                aria-selected={active()?.id === section.id}
                aria-controls={`${id}-${section.id}-panel`}
                tabIndex={active()?.id === section.id ? 0 : -1}
                onClick={() => setSelected(section.id)}
                onKeyDown={(event) => tabKey(event, index())}
              >
                {section.label}
              </button>
            )}
          </For>
        </nav>
        <div class={styles.settingsBody}>
          <Show when={active()}>
            {(section) => (
              <section
                id={`${id}-${section().id}-panel`}
                role="tabpanel"
                aria-labelledby={`${id}-${section().id}-tab`}
                tabIndex={0}
              >
                {section().content()}
              </section>
            )}
          </Show>
        </div>
        <footer class={styles.settingsFooter}>
          <Show when={props.onExit}>
            <button
              class={styles.secondary}
              type="button"
              onClick={() => props.onExit?.()}
            >
              <GameIcon name="museum" />
              {props.exitLabel ?? 'Museum'}
            </button>
          </Show>
          <button class={styles.primary} type="button" onClick={close}>
            <GameIcon name="play" />
            Resume
          </button>
        </footer>
      </GameSurface>
    </dialog>
  )
}

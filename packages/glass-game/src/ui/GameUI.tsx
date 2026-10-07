// Crystal game UI — shared layered materials, appearance controls and accessible settings shell.
import type { JSX } from 'solid-js'
import { createContext, createEffect, createMemo, createSignal, createUniqueId, For, onCleanup, onMount, Show, untrack, useContext, } from 'solid-js'
import type { GlassGameHost } from '../host'
import { focusDialog, trapDialogKeys } from './dialog-focus'
import type { GameAppearanceChoice, GameMaterialValues, } from './game-appearance'
import { DEFAULT_GAME_MATERIAL, GAME_APPEARANCE_KEY, GAME_MATERIAL_KEY, GAME_MATERIAL_RANGES, gameThemeFromApp, normalizeGameMaterial, readGameAppearance, readGameMaterial, } from './game-appearance'
import { GameIcon, GameIconButton } from './GameIcons'

export { GameIcon, GameIconButton } from './GameIcons'
export type { GameIconName } from './GameIcons'
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
  shape?: 'console' | 'settings'
  /** Compact hosts cap corner facets to keep their content inside the painted outline. */
  cornerLimit?: number
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
          shape={props.shape}
          theme={appearance?.theme() === 'dark' ? 'dark' : 'light'}
          corner={Math.min(
            appearance?.material().corner ?? 20,
            props.cornerLimit ?? Infinity,
            frameKind() === 'panel' && size().width < 600 ? 20 : Infinity,
          )}
        />
      </Show>
      {props.children}
    </div>
  )
}

/** Decorative artwork stays behind the native control and cannot intercept input. */
export function GameControlMaterial(props: { kind: 'lens' | 'pill' }) {
  const appearance = useContext(AppearanceContext)
  let layer!: HTMLSpanElement
  const [size, setSize] = createSignal({ width: 100, height: 100 })
  onMount(() => {
    const measure = (): void => {
      const { width, height } = layer.getBoundingClientRect()
      if (width > 0 && height > 0) setSize({ width, height })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(layer)
    onCleanup(() => observer.disconnect())
  })
  return (
    <span ref={layer} class={styles.controlMaterial} aria-hidden="true">
      <GameMaterialFrame
        width={size().width}
        height={size().height}
        kind={props.kind}
        corner={24}
        theme={appearance?.theme() === 'dark' ? 'dark' : 'light'}
      />
    </span>
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
      <GameSurface class={styles.settingsSurface} shape="settings">
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
            <GameControlMaterial kind="pill" />
            <GameIcon name="play" />
            Resume
          </button>
        </footer>
      </GameSurface>
    </dialog>
  )
}

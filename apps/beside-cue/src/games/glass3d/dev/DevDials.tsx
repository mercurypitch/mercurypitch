// The dials, on the phone, while the game is running.
// ============================================================
//
// maff, 2026-09-04: "I would like as many debug options/dials in dev
// builds as possible ofc... add a sort of settings debug panel where I
// can do that. From the app."
//
// FROM THE APP is the whole requirement, and it is what rules out the
// tool the plan named. §8 of docs/games/glass-3d.md picked lil-gui, for
// good reasons that all assume a desktop: a mouse, a keyboard, and a
// developer sitting at the machine the code is on. The numbers that
// need dragging here are FEEL numbers -- how hard the glass throws, how
// long a breath costs, how high he jumps -- and feel is judged on the
// device, with a thumb, singing. So this is hand-rolled, in the app's
// own idiom, with rows big enough to hit.
//
// It is dev-only twice over: this module is imported behind
// `import.meta.env.DEV` so a production bundle never contains it, and
// the button that opens it is rendered behind the same check.
//
// It writes into the live config object -- see dials.ts for why that is
// the design rather than an accident.

import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import type { World3DConfig } from '../world3d-config'
import type { Dial } from './dials'
import { asOverride, DIALS, forget, GROUP_LABELS, GROUP_ORDER, load, readDial, restore, save, snapshot, writeDial, } from './dials'

export interface DevAction {
  label: string
  run(): void
}

interface DevDialsProps {
  /** The config object the running stage is reading. Mutated in place. */
  config: World3DConfig
  /** Which world this is, for the panel's own heading. */
  title: string
  /** Stage-specific buttons -- break a pane, hold a mode, warp. */
  actions?: readonly DevAction[]
  onClose(): void
}

export const DevDials = (props: DevDialsProps) => {
  // The values as they were when the panel first opened in this session,
  // which is what Reset returns to and what `asOverride` diffs against.
  // Taken before `load` runs, so a stored session can be undone.
  let baseline: World3DConfig | null = null

  // The config is a plain object mutated in place, so nothing about a
  // write is reactive on its own. This counter is the reactivity: every
  // write bumps it, and every read of a dial goes through `valueOf`,
  // which reads it. Discarding the getter here -- which the first draft
  // did -- gives a panel whose sliders move and whose numbers never do.
  const [tick, setTick] = createSignal(0)
  const bump = (): void => {
    setTick((n) => n + 1)
  }
  const valueOf = (dial: Dial): number => {
    tick()
    return readDial(props.config, dial)
  }
  const [copied, setCopied] = createSignal(false)
  const [open, setOpen] = createSignal<string>(GROUP_ORDER[0]!)

  onMount(() => {
    baseline = snapshot(props.config)
    load(props.config)
    bump()
  })

  const persist = (): void => {
    if (baseline === null) return
    save(asOverride(props.config, baseline))
  }

  const onInput = (dial: Dial, raw: string): void => {
    const value = Number(raw)
    if (!Number.isFinite(value)) return
    writeDial(props.config, dial, value)
    bump()
    persist()
  }

  const reset = (): void => {
    if (baseline === null) return
    restore(props.config, baseline)
    forget()
    bump()
  }

  const copy = (): void => {
    if (baseline === null) return
    const text = JSON.stringify(asOverride(props.config, baseline), null, 2)
    // `writeText` needs a secure context and a permission the WebView may
    // refuse; the textarea fallback is what makes the button work on the
    // http LAN address the phone actually loads.
    const fallback = (): void => {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      try {
        document.execCommand('copy')
      } catch {
        // Nothing else to try; the JSON is still on screen to read.
      }
      area.remove()
    }
    void (async () => {
      try {
        await navigator.clipboard.writeText(text)
      } catch {
        fallback()
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    })()
  }

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') props.onClose()
  }
  window.addEventListener('keydown', onKey)
  onCleanup(() => window.removeEventListener('keydown', onKey))

  const changed = (dial: Dial): boolean =>
    baseline !== null &&
    Math.abs(valueOf(dial) - readDial(baseline, dial)) > 1e-9

  const format = (dial: Dial, value: number): string => {
    const places =
      dial.step >= 1 ? 0 : dial.step >= 0.1 ? 1 : dial.step >= 0.01 ? 2 : 3
    return `${value.toFixed(places)}${dial.unit}`
  }

  return (
    <div class="dev-dials" role="dialog" aria-label="Developer dials">
      <div class="dev-dials__bar">
        <span class="dev-dials__title">{props.title}</span>
        <button type="button" class="dev-dials__ghost" onClick={reset}>
          Reset
        </button>
        <button type="button" class="dev-dials__ghost" onClick={copy}>
          {copied() ? 'Copied' : 'Copy JSON'}
        </button>
        <button
          type="button"
          class="dev-dials__ghost"
          onClick={() => props.onClose()}
          aria-label="Close dials"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <Show when={props.actions !== undefined && props.actions.length > 0}>
        <div class="dev-dials__actions">
          <For each={props.actions}>
            {(action) => (
              <button
                type="button"
                class="dev-dials__action"
                onClick={() => action.run()}
              >
                {action.label}
              </button>
            )}
          </For>
        </div>
      </Show>

      <div class="dev-dials__tabs">
        <For each={GROUP_ORDER}>
          {(group) => (
            <button
              type="button"
              class="dev-dials__tab"
              classList={{ 'is-on': open() === group }}
              onClick={() => setOpen(group)}
            >
              {GROUP_LABELS[group]}
            </button>
          )}
        </For>
      </div>

      <div class="dev-dials__rows">
        <For each={DIALS.filter((d) => d.group === open())}>
          {(dial) => (
            <label
              class="dev-dials__row"
              classList={{ 'is-changed': changed(dial) }}
            >
              <span class="dev-dials__label">
                {dial.label}
                <em class="dev-dials__value">{format(dial, valueOf(dial))}</em>
              </span>
              <input
                type="range"
                min={dial.min}
                max={dial.max}
                step={dial.step}
                value={valueOf(dial)}
                onInput={(event) => onInput(dial, event.currentTarget.value)}
              />
              <span class="dev-dials__does">{dial.does}</span>
            </label>
          )}
        </For>
      </div>
    </div>
  )
}

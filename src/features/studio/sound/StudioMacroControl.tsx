// Studio macro control — pointer or held-key drafts become one undoable sound change.
import { createEffect, createSignal } from 'solid-js'
import type { StudioSoundEdit } from '@/lib/studio/model/sound-commands'
import type { StudioProject } from '@/lib/studio/model/types'
import type { MacroKey } from '@/lib/studio-fx/mix-macros'
import { MACRO_LABELS } from '@/lib/studio-fx/mix-macros'
import styles from './StudioSound.module.css'

interface Props {
  name: MacroKey
  project: StudioProject
  writable: boolean
  onCommand(command: StudioSoundEdit): boolean
}
const RANGE_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
])

export function StudioMacroControl(props: Props) {
  const [draft, setDraft] = createSignal<number | null>(null)
  let baseline: { id: string; revision: number } | null = null
  let keyHeld = false
  let pointerHeld = false
  let blockedPointer = false
  let blockedKey = false
  let ignoreChange = false
  const value = () => draft() ?? props.project.mix.macros[props.name]

  function cancel(): void {
    baseline = null
    blockedPointer = pointerHeld
    blockedKey = keyHeld
    keyHeld = false
    ignoreChange = true
    setDraft(null)
  }
  createEffect(() => {
    const project = props.project
    const writable = props.writable
    if (
      baseline &&
      (!writable ||
        baseline.id !== project.id ||
        baseline.revision !== project.revision)
    )
      cancel()
  })

  function commit(): void {
    const next = draft()
    const current = baseline
    baseline = null
    keyHeld = false
    if (
      next !== null &&
      current?.id === props.project.id &&
      current.revision === props.project.revision &&
      props.writable
    ) {
      props.onCommand({
        type: 'set-sound-macros',
        macros: { ...props.project.mix.macros, [props.name]: next },
      })
    }
    setDraft(null)
  }
  return (
    <label class={styles.macro}>
      <span class={styles.macroTitle}>
        <span>{MACRO_LABELS[props.name].label}</span>
        <output>
          {value() > 0 ? '+' : ''}
          {value()}
        </output>
      </span>
      <input
        type="range"
        aria-label={MACRO_LABELS[props.name].label}
        min="-100"
        max="100"
        step="1"
        value={value()}
        disabled={!props.writable}
        aria-valuetext={`${value()}`}
        onInput={(event) => {
          if (blockedPointer || blockedKey) {
            event.currentTarget.value = String(
              props.project.mix.macros[props.name],
            )
            return
          }
          ignoreChange = false
          baseline ??= {
            id: props.project.id,
            revision: props.project.revision,
          }
          setDraft(event.currentTarget.valueAsNumber)
        }}
        onChange={() => {
          if (!keyHeld && !ignoreChange) commit()
        }}
        on:keydown={(event) => {
          if (RANGE_KEYS.has(event.key)) {
            if (event.repeat && blockedKey) {
              event.preventDefault()
              return
            }
            blockedKey = false
            blockedPointer = false
            keyHeld = true
          }
          if (event.key === 'Escape' && draft() !== null) {
            event.preventDefault()
            event.stopPropagation()
            cancel()
          }
        }}
        on:keyup={(event) => {
          if (RANGE_KEYS.has(event.key)) {
            blockedKey = false
            commit()
          }
        }}
        onPointerDown={() => {
          pointerHeld = true
          blockedPointer = false
          ignoreChange = false
        }}
        onPointerUp={() => {
          pointerHeld = false
        }}
        onBlur={commit}
        onPointerCancel={() => {
          cancel()
          pointerHeld = false
        }}
      />
      <span class={styles.macroEnds}>
        <span>{MACRO_LABELS[props.name].low}</span>
        <span>{MACRO_LABELS[props.name].high}</span>
      </span>
    </label>
  )
}

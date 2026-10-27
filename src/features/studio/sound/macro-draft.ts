// ============================================================
// Studio macro draft — one undoable sound change per pointer gesture or held key
// ============================================================
//
// Shared by the Sound panel's slider and the mixing desk's dial, so both edit
// `project.mix.macros` through the same `set-sound-macros` command. A draft
// remembers the revision it started from: an edit that lands from elsewhere
// (undo, another control, another tab) drops the draft instead of saving it
// over the newer song.
import { createEffect, createSignal } from 'solid-js'
import type { StudioSoundEdit } from '@/lib/studio/model/sound-commands'
import type { StudioProject } from '@/lib/studio/model/types'
import type { MacroKey } from '@/lib/studio-fx/mix-macros'
import { MACRO_LABELS } from '@/lib/studio-fx/mix-macros'

export interface StudioMacroDraftProps {
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

/** What a screen reader hears: how far the control leans, and towards which end. */
export function studioMacroValueText(name: MacroKey, value: number): string {
  if (value === 0) return 'Centre'
  const labels = MACRO_LABELS[name]
  return `${Math.abs(value)} toward ${value < 0 ? labels.low : labels.high}`
}

export function createStudioMacroDraft(props: StudioMacroDraftProps) {
  const [draft, setDraft] = createSignal<number | null>(null)
  let baseline: { id: string; revision: number } | null = null
  let keyHeld = false
  let pointerHeld = false
  let blockedPointer = false
  let blockedKey = false
  let ignoreChange = false
  const saved = () => props.project.mix.macros[props.name]
  const value = () => draft() ?? saved()

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

  function begin(next: number): void {
    ignoreChange = false
    baseline ??= {
      id: props.project.id,
      revision: props.project.revision,
    }
    setDraft(next)
  }

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

  return {
    value,
    commit,
    /** A value from outside the native input, such as a dial drag. */
    set(next: number): void {
      const clamped = Math.max(-100, Math.min(100, Math.round(next)))
      if (!props.writable || blockedPointer || clamped === value()) return
      begin(clamped)
    },
    input(event: Event & { currentTarget: HTMLInputElement }): void {
      if (blockedPointer || blockedKey) {
        event.currentTarget.value = String(saved())
        return
      }
      begin(event.currentTarget.valueAsNumber)
    },
    change(): void {
      if (!keyHeld && !ignoreChange) commit()
    },
    keyDown(event: KeyboardEvent): void {
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
    },
    keyUp(event: KeyboardEvent): void {
      if (RANGE_KEYS.has(event.key)) {
        blockedKey = false
        commit()
      }
    },
    pointerDown(): void {
      pointerHeld = true
      blockedPointer = false
      ignoreChange = false
    },
    pointerUp(): void {
      pointerHeld = false
    },
    pointerCancel(): void {
      cancel()
      pointerHeld = false
    },
  }
}

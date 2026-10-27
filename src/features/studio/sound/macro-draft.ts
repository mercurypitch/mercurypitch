// ============================================================
// Studio macro draft — one undoable sound change per pointer gesture or run of keys
// ============================================================
//
// Shared by the Sound panel's slider and the mixing desk's dial, so both edit
// `project.mix.macros` through the same `set-sound-macros` command. A draft
// remembers the revision it started from: an edit that lands from elsewhere
// (undo, another control, another tab) drops the draft instead of saving it
// over the newer song.
//
// While it moves, the draft goes to the live mix: the playing song follows
// the control, and the other view of the same macro shows the same value. A
// run of arrow keys saves once, when the keys go quiet (key-burst.ts).
import { createEffect, createSignal, untrack } from 'solid-js'
import { createStudioKeyBurst, STUDIO_RANGE_KEYS, } from '@/features/studio/mix/key-burst'
import { useStudioLiveMix } from '@/features/studio/mix/live-mix'
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

/** What a screen reader hears: how far the control leans, and towards which end. */
export function studioMacroValueText(name: MacroKey, value: number): string {
  if (value === 0) return 'Centre'
  const labels = MACRO_LABELS[name]
  return `${Math.abs(value)} toward ${value < 0 ? labels.low : labels.high}`
}

export function createStudioMacroDraft(props: StudioMacroDraftProps) {
  const live = useStudioLiveMix()
  const [draft, setDraft] = createSignal<number | null>(null)
  let baseline: { id: string; revision: number } | null = null
  let pointerHeld = false
  let blockedPointer = false
  let blockedKey = false
  let ignoreChange = false
  const burst = createStudioKeyBurst(() => commit())
  const saved = () => props.project.mix.macros[props.name]
  const value = () => draft() ?? live.macro(props.name) ?? saved()

  function end(): void {
    setDraft(null)
    if (live.macro(props.name) !== undefined) live.setMacro(props.name, null)
  }

  function cancel(): void {
    baseline = null
    blockedPointer = pointerHeld
    blockedKey = burst.active()
    burst.cancel()
    ignoreChange = true
    end()
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
      untrack(cancel)
  })

  function begin(next: number): void {
    ignoreChange = false
    baseline ??= {
      id: props.project.id,
      revision: props.project.revision,
    }
    setDraft(next)
    live.setMacro(props.name, next)
  }

  // The command first, then the preview ends: the song never hears the old value.
  function commit(): void {
    const next = draft()
    const current = baseline
    baseline = null
    burst.cancel()
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
    end()
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
      if (burst.active()) burst.moved()
      else if (!ignoreChange) commit()
    },
    keyDown(event: KeyboardEvent): void {
      if (STUDIO_RANGE_KEYS.has(event.key)) {
        if (event.repeat && blockedKey) {
          event.preventDefault()
          return
        }
        blockedKey = false
        blockedPointer = false
      }
      if (event.key === 'Escape' && draft() !== null) {
        event.preventDefault()
        event.stopPropagation()
        cancel()
        return
      }
      burst.keyDown(event)
    },
    keyUp(event: KeyboardEvent): void {
      if (STUDIO_RANGE_KEYS.has(event.key)) {
        blockedKey = false
        burst.moved()
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

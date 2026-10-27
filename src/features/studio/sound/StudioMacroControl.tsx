// Studio macro control — pointer or held-key drafts become one undoable sound change.
import type { StudioSoundEdit } from '@/lib/studio/model/sound-commands'
import type { StudioProject } from '@/lib/studio/model/types'
import type { MacroKey } from '@/lib/studio-fx/mix-macros'
import { MACRO_LABELS } from '@/lib/studio-fx/mix-macros'
import { createStudioMacroDraft, studioMacroValueText } from './macro-draft'
import styles from './StudioSound.module.css'

interface Props {
  name: MacroKey
  project: StudioProject
  writable: boolean
  onCommand(command: StudioSoundEdit): boolean
}

export function StudioMacroControl(props: Props) {
  const draft = createStudioMacroDraft(props)
  const value = draft.value
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
        style={{ '--value': value() }}
        aria-valuetext={studioMacroValueText(props.name, value())}
        onInput={(event) => draft.input(event)}
        onChange={() => draft.change()}
        on:keydown={(event) => draft.keyDown(event)}
        on:keyup={(event) => draft.keyUp(event)}
        onPointerDown={() => draft.pointerDown()}
        onPointerUp={() => draft.pointerUp()}
        onBlur={() => draft.commit()}
        onPointerCancel={() => draft.pointerCancel()}
      />
      <span class={styles.macroEnds}>
        <span>{MACRO_LABELS[props.name].low}</span>
        <span>{MACRO_LABELS[props.name].high}</span>
      </span>
    </label>
  )
}

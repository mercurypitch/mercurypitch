// Studio takes button — a clip's takes listed from a button: on the selected clip's toolbar, and in a phone's clip note, as a phone has no right-click. Its rows are the clip menu's (clip-take-menu.ts).
import { createSignal } from 'solid-js'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioAsset, StudioClip } from '@/lib/studio/model/types'
import { TakeStack } from '../studio-icons'
import { studioClipTakeMenu } from './clip-take-menu'
import type { StudioClipMenuAnchor } from './StudioClipMenu'
import { StudioClipMenu } from './StudioClipMenu'

export function StudioTakesButton(props: {
  clip: StudioClip
  assets: ReadonlyMap<string, StudioAsset>
  writable: boolean
  /** The host's own button look, and its words' (a folding bar hides them). */
  class?: string
  textClass?: string
  onCommand(command: StudioCommand): boolean
}) {
  const [menu, setMenu] = createSignal<StudioClipMenuAnchor | null>(null)
  return (
    <>
      <button
        type="button"
        class={props.class}
        aria-haspopup="menu"
        aria-expanded={menu() !== null}
        title="This clip's takes. T and Shift+T step through them."
        data-studio-takes-button=""
        onClick={(event) => {
          const button = event.currentTarget
          setMenu(
            menu() === null
              ? { rect: button.getBoundingClientRect(), element: button }
              : null,
          )
        }}
      >
        <TakeStack size={15} />
        <span class={props.textClass}>Takes</span>
      </button>
      <StudioClipMenu
        anchor={menu()}
        label="Takes"
        items={studioClipTakeMenu(
          props.clip,
          props.assets,
          (command) => props.onCommand(command),
          props.writable,
        )}
        onClose={() => setMenu(null)}
      />
    </>
  )
}

// Night import keeps its action sheet off room startup paths until an explicit open or external drag.
import { lazy, Show, Suspense } from 'solid-js'
import { Plus } from '@/components/icons'
import styles from './NightMusicImport.module.css'
import type { NightMusicImportController } from './useNightMusicImport'

const ActionSheet = lazy(async () => {
  const module = await import('./NightMusicImport')
  return { default: module.NightMusicImport }
})

export function NightMusicImportButton(props: {
  onClick: () => void
  class?: string
}) {
  return (
    <button
      type="button"
      class={props.class ?? styles.trigger}
      onClick={() => props.onClick()}
      data-testid="night-add-music"
    >
      <Plus size={16} /> Add music
    </button>
  )
}

export function NightMusicImport(props: {
  controller: NightMusicImportController
}) {
  return (
    <Show when={props.controller.isOpen() || props.controller.dragging()}>
      <Suspense>
        <ActionSheet controller={props.controller} />
      </Suspense>
    </Show>
  )
}

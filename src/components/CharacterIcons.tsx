import type { Component } from 'solid-js'
import { createEffect, createSignal, For, on, onCleanup, onMount, Show, } from 'solid-js'
import { Info } from '@/components/icons'
import type { CharacterName } from '@/stores/settings-store'
import { CHARACTER_INFO, selectedCharacter, setSelectedCharacter, } from '@/stores/settings-store'
import { targetFocusEvent } from '@/stores/ui-store'
import styles from './CharacterIcons.module.css'

interface CharacterIconsProps {
  onSelect?: (name: CharacterName) => void
}

export const CharacterIcons: Component<CharacterIconsProps> = (props) => {
  const characters: CharacterName[] = [
    'aria',
    'echo',
    'harmony',
    'nova',
    'spark',
    'blaze',
    'luna',
    'flux',
    'glint',
  ]

  const [infoFor, setInfoFor] = createSignal<CharacterName | null>(null)

  const handleSelect = (name: CharacterName) => {
    setSelectedCharacter(name)
    props.onSelect?.(name)
  }

  const toggleInfo = (name: CharacterName) => {
    setInfoFor((cur) => (cur === name ? null : name))
  }

  onMount(() => {
    const close = (e: MouseEvent) => {
      const target = e.target as Element | null
      if (target?.closest(`.${styles.infoBadge}, .${styles.infoPanel}`)) return
      setInfoFor(null)
    }
    // Escape closes it too, the same as every other panel in the app —
    // a click-only dismissal strands keyboard users with it open.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInfoFor(null)
    }
    document.addEventListener('click', close)
    document.addEventListener('keydown', onKeyDown)
    onCleanup(() => {
      document.removeEventListener('click', close)
      document.removeEventListener('keydown', onKeyDown)
    })
  })

  let gridRef!: HTMLDivElement
  createEffect(
    on(
      targetFocusEvent,
      (e) => {
        if (e?.ids.includes('sidebar-character') === true) {
          if (gridRef !== undefined) {
            gridRef.classList.remove('target-focus-flash')
            void gridRef.offsetWidth // force reflow
            gridRef.classList.add('target-focus-flash')
          }
        }
      },
      { defer: true },
    ),
  )

  return (
    <>
      <div id="character-icons" ref={gridRef} class={styles.grid}>
        <For each={characters}>
          {(name) => (
            <div class={styles.cell}>
              <button
                class={`${styles.btn} ${selectedCharacter() === name ? styles.selected : ''} ${styles[name] ?? ''} ${selectedCharacter() === name ? styles.selectedAnim : ''}`}
                onClick={() => handleSelect(name)}
                title={`${CHARACTER_INFO[name].displayName} (${CHARACTER_INFO[name].title}) - ${CHARACTER_INFO[name].description}`}
              >
                <img
                  src={`characters/${name}_idle.svg`}
                  alt={CHARACTER_INFO[name].displayName}
                  class={styles.iconImg}
                />
              </button>
              <button
                type="button"
                class={styles.infoBadge}
                aria-label={`About ${CHARACTER_INFO[name].displayName}`}
                aria-expanded={infoFor() === name}
                onClick={() => toggleInfo(name)}
              >
                <Info size={10} />
              </button>
            </div>
          )}
        </For>
      </div>
      <Show when={infoFor()}>
        {(name) => (
          <div
            class={styles.infoPanel}
            role="note"
            onClick={(e) => e.stopPropagation()}
          >
            <strong>{CHARACTER_INFO[name()].displayName}</strong>
            <span class={styles.infoPanelTitle}>
              {CHARACTER_INFO[name()].title}
            </span>
            <p>{CHARACTER_INFO[name()].description}</p>
          </div>
        )}
      </Show>
    </>
  )
}

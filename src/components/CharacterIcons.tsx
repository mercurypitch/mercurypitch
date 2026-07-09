import type { Component } from 'solid-js'
import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import type { CharacterName } from '@/stores/settings-store'
import { CHARACTER_INFO, selectedCharacter, setSelectedCharacter, } from '@/stores/settings-store'
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
    document.addEventListener('click', close)
    onCleanup(() => document.removeEventListener('click', close))
  })

  return (
    <>
      <div id="character-icons" class={styles.grid}>
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
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="4" r="0.5" fill="currentColor" />
                  <path d="M12 10v10" />
                </svg>
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

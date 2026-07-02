import type { Component } from 'solid-js'
import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import '@/styles/characters.css'
import type { CharacterName } from '@/stores/settings-store'
import { CHARACTER_INFO, selectedCharacter, setSelectedCharacter, } from '@/stores/settings-store'

interface CharacterIconsProps {
  onSelect?: (name: CharacterName) => void
}

/**
 * Character picker. Selection is now persisted in the settings store
 * (`selectedCharacter`) so EngineContext can react to changes and swap
 * the playback instrument when "Character Sounds" is enabled in
 * Settings.
 *
 * Each button carries a small "i" badge that toggles an inline info panel
 * below the grid — hover title attributes don't exist on touch devices, so
 * this is how mobile users read who a character is.
 */
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

  const toggleInfo = (name: CharacterName, e: MouseEvent) => {
    // Don't select the character underneath, and don't let the
    // outside-click closer immediately undo the toggle.
    e.stopPropagation()
    setInfoFor((cur) => (cur === name ? null : name))
  }

  onMount(() => {
    const close = () => setInfoFor(null)
    document.addEventListener('click', close)
    onCleanup(() => document.removeEventListener('click', close))
  })

  return (
    <>
      <div id="character-icons" class="character-icons-grid">
        <For each={characters}>
          {(name) => (
            <div class="character-icon-cell">
              <button
                class={`character-icon-btn ${selectedCharacter() === name ? 'selected' : ''} character-${name} ${selectedCharacter() === name ? 'selected-anim' : ''}`}
                onClick={() => handleSelect(name)}
                title={`${CHARACTER_INFO[name].displayName} (${CHARACTER_INFO[name].title}) - ${CHARACTER_INFO[name].description}`}
              >
                <img
                  src={`characters/${name}_idle.svg`}
                  alt={CHARACTER_INFO[name].displayName}
                  class="character-icon-img"
                />
              </button>
              <button
                type="button"
                class="character-info-badge"
                aria-label={`About ${CHARACTER_INFO[name].displayName}`}
                aria-expanded={infoFor() === name}
                onClick={(e) => toggleInfo(name, e)}
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
            class="character-info-panel"
            role="note"
            onClick={(e) => e.stopPropagation()}
          >
            <strong>{CHARACTER_INFO[name()].displayName}</strong>
            <span class="character-info-panel-title">
              {CHARACTER_INFO[name()].title}
            </span>
            <p>{CHARACTER_INFO[name()].description}</p>
          </div>
        )}
      </Show>
    </>
  )
}

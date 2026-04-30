import type { Component } from 'solid-js'
import { For } from 'solid-js'
import '@/styles/characters.css'
import type { CharacterName } from '@/stores/settings-store'
import { selectedCharacter, setSelectedCharacter, } from '@/stores/settings-store'

interface CharacterIconsProps {
  onSelect?: (name: CharacterName) => void
}

/**
 * Character picker. Selection is now persisted in the settings store
 * (`selectedCharacter`) so EngineContext can react to changes and swap
 * the playback instrument when "Character Sounds" is enabled in
 * Settings. Previously this was a local `createSignal`, which kept the
 * choice purely visual — the audio engine had no way to see it.
 */
export const CharacterIcons: Component<CharacterIconsProps> = (props) => {
  const characters: CharacterName[] = [
    'blaze',
    'aria',
    'flux',
    'luna',
    'glint',
    'echo',
  ]

  const handleSelect = (name: CharacterName) => {
    setSelectedCharacter(name)
    props.onSelect?.(name)
  }

  return (
    <div id="character-icons" class="character-icons-grid">
      <For each={characters}>
        {(name) => (
          <button
            class={`character-icon-btn ${selectedCharacter() === name ? 'selected' : ''} character-${name} ${selectedCharacter() === name ? 'selected-anim' : ''}`}
            onClick={() => handleSelect(name)}
            title={`Select ${name}`}
          >
            <img
              src={`characters/${name}_idle.svg`}
              alt={name}
              class="character-icon-img"
            />
          </button>
        )}
      </For>
    </div>
  )
}

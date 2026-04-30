import type { Component } from 'solid-js'
import { createSignal, For } from 'solid-js'
import '@/styles/characters.css'

type CharacterName = 'blaze' | 'aria' | 'flux' | 'luna' | 'glint' | 'echo'

interface CharacterIconsProps {
  onSelect?: (name: CharacterName) => void
}

export const CharacterIcons: Component<CharacterIconsProps> = (props) => {
  const characters: CharacterName[] = [
    'blaze',
    'aria',
    'flux',
    'luna',
    'glint',
    'echo',
  ]
  const [selected, setSelected] = createSignal<CharacterName | null>('aria')

  const handleSelect = (name: CharacterName) => {
    setSelected(name)
    props.onSelect?.(name)
  }

  return (
    <div id='character-icons' class="character-icons-grid">
      <For each={characters}>
        {(name) => (
          <button
            class={`character-icon-btn ${selected() === name ? 'selected' : ''} character-${name} ${selected() === name ? 'selected-anim' : ''}`}
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

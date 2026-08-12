// Character picker — only meaningful where a voice character drives the
// engine (Singing, Exercises, Home). The focus anchor for the header's
// "now loaded" chip lives inside CharacterIcons itself.

import type { Component } from 'solid-js'
import { CharacterIcons } from '@/components/CharacterIcons'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { showNotification } from '@/stores'

export const CharacterPanel: Component = () => (
  <CollapsibleSection title="Character" storageKey="sidebar-character-open">
    <CharacterIcons
      onSelect={(name) => showNotification(`Selected ${name}!`, 'info')}
    />
  </CollapsibleSection>
)

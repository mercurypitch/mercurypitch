import type { Component } from 'solid-js'

export interface GuitarViewToggleProps {
  activeView: () => 'interactive' | 'hero'
  onViewChange: (view: 'interactive' | 'hero') => void
}

export const GuitarViewToggle: Component<GuitarViewToggleProps> = (props) => {
  return (
    <div class="gp-view-toggle">
      <button
        class="gp-view-tab"
        classList={{
          'gp-view-tab-active': props.activeView() === 'interactive',
        }}
        onClick={() => props.onViewChange('interactive')}
      >
        Fretboard
      </button>
      <button
        class="gp-view-tab"
        classList={{ 'gp-view-tab-active': props.activeView() === 'hero' }}
        onClick={() => props.onViewChange('hero')}
      >
        Practice
      </button>
    </div>
  )
}

import type { Component } from 'solid-js'

export interface GuitarViewToggleProps {
  activeView: () => 'interactive' | 'hero' | '3d'
  onViewChange: (view: 'interactive' | 'hero' | '3d') => void
}

export const GuitarViewToggle: Component<GuitarViewToggleProps> = (props) => {
  return (
    <div class="gp-view-toggle">
      <button
        class="gp-view-tab"
        data-tour="guitar.view-fretboard"
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
      <button
        class="gp-view-tab"
        classList={{ 'gp-view-tab-active': props.activeView() === '3d' }}
        onClick={() => props.onViewChange('3d')}
      >
        3D
      </button>
    </div>
  )
}

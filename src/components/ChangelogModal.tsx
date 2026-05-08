import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'

interface VersionEntry {
  version: string
  date: string
  sections: { label: string; items: string[] }[]
}

const changelog: VersionEntry[] = [
  {
    version: '0.1.3',
    date: '2026-04-20',
    sections: [
      {
        label: 'Added',
        items: [
          'Vite-based build pipeline with pnpm workspace support',
          'McLeod pitch detection algorithm option alongside YIN',
          'Pitch buffer size presets (256, 512, 1024, 2048, 4096) with descriptions',
          'Score popup optional visibility setting',
          'Perfect pitch deviance presets for accuracy bands',
        ],
      },
      {
        label: 'Changed',
        items: [
          'White/light theme restyled across dropdowns and controls',
          'Sidebar header redesigned for cleaner layout',
          'Note and accuracy score display redesigned',
          'Crash modal updated with improved UI',
        ],
      },
      {
        label: 'Fixed',
        items: [
          'Safari error handling for audio context',
          'YIN pitch detection when using 4K buffer size',
          'Various style consistency issues',
        ],
      },
    ],
  },
  {
    version: '0.1.2',
    date: '2026-03-15',
    sections: [
      {
        label: 'Added',
        items: [
          'Vocal separation (UVR) panel with upload and processing UI',
          'Yousician-style ball physics visualization for pitch tracking',
          'Community leaderboard for sharing practice results',
          'Vocal analysis and challenges modules',
          'Practice result popup with score overlay',
          'App error boundary with crash modal dialog',
          'Walkthrough tour system for onboarding',
        ],
      },
      {
        label: 'Changed',
        items: [
          'Piano roll canvas with improved rendering',
          'Session editor timeline refinements',
          'Transport controls unified and simplified',
        ],
      },
      {
        label: 'Fixed',
        items: [
          'Session sequence advance after rest notes',
          'Per-note accuracy percentage display',
          'Focus mode vertical playhead and pitch dot animation',
          'Release envelope on stopTone for smooth note transitions',
        ],
      },
    ],
  },
  {
    version: '0.1.1',
    date: '2026-02-01',
    sections: [
      {
        label: 'Added',
        items: [
          'Real-time pitch detection with YIN algorithm',
          'Piano roll editor for composing melodies',
          'Practice mode with accuracy tracking',
          'Session recording and playback',
          'MIDI import functionality',
          'Metronome with adjustable BPM',
          'Focus mode for distraction-free practice',
          'Welcome screen with tour introduction',
        ],
      },
      {
        label: 'Changed',
        items: [
          'TypeScript and SolidJS migration from vanilla JS',
          'Settings panel refactored with sections layout',
        ],
      },
      {
        label: 'Fixed',
        items: [
          'Audio engine initialization on mobile browsers',
          'Preset modal scale note playback',
          'Playback resume after pause edge cases',
        ],
      },
    ],
  },
  {
    version: '0.1.0',
    date: '2025-12-10',
    sections: [
      {
        label: 'Added',
        items: [
          'Initial release of PitchPerfect',
          'Basic pitch detection via microphone',
          'Simple melody playback engine',
          'Dark theme interface',
          'Session history storage',
        ],
      },
    ],
  },
]

const sectionBadgeClass = (label: string): string => {
  if (label === 'Added') return 'changelog-badge badge-added'
  if (label === 'Changed') return 'changelog-badge badge-changed'
  return 'changelog-badge badge-fixed'
}

interface ChangelogModalProps {
  open: boolean
  onClose: () => void
}

export const ChangelogModal: Component<ChangelogModalProps> = (props) => {
  return (
    <Show when={props.open}>
      <div class="modal-overlay" onClick={() => props.onClose()}>
        <div class="modal-content" onClick={(e) => e.stopPropagation()}>
          <div class="modal-header">
            <h2>What's New</h2>
            <button class="modal-close" onClick={() => props.onClose()}>
              &times;
            </button>
          </div>
          <div class="modal-body">
            <For each={changelog}>
              {(entry, i) => (
                <>
                  {i() > 0 && <div class="changelog-divider" />}
                  <div class="changelog-version">
                    <div class="changelog-version-header">
                      <span class="changelog-version-tag">
                        v{entry.version}
                      </span>
                      <span class="changelog-date">{entry.date}</span>
                    </div>
                    <For each={entry.sections}>
                      {(section) => (
                        <div class="changelog-section">
                          <span class={sectionBadgeClass(section.label)}>
                            {section.label}
                          </span>
                          <ul class="changelog-entries">
                            <For each={section.items}>
                              {(item) => (
                                <li class="changelog-entry">{item}</li>
                              )}
                            </For>
                          </ul>
                        </div>
                      )}
                    </For>
                  </div>
                </>
              )}
            </For>
          </div>
        </div>
      </div>
    </Show>
  )
}

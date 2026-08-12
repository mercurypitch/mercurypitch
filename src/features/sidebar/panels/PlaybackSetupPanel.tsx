// Playback Setup — key / octave / scale, plus the custom-scale builder.
// Gated by the user's showPlaybackSetupInfo() setting, as before the
// registry existed. The key dropdown transposes the melody only on the
// Compose tab; everywhere else it is a view-only change.

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import styles from '@/components/AppSidebar.module.css'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { IconDiamond } from '@/components/exercise-icons'
import { SafeSelect } from '@/components/shared/SafeSelect'
import { useSidebarHost } from '@/features/sidebar/sidebar-host'
import { TAB_COMPOSE } from '@/features/tabs/constants'
import { KEY_OFFSETS, midiToFreq, midiToNote } from '@/lib/scale-data'
import { activeTab } from '@/stores'
import { keyName, scaleType, setKeyName, setScaleType, showPlaybackSetupInfo, } from '@/stores'
import { melodyStore } from '@/stores/melody-store'
import { customScales as customScalesMap, customScaleTypeId, } from '@/stores/settings-store'

export const PlaybackSetupPanel: Component = () => {
  const host = useSidebarHost()

  // The octave shown between the up/down buttons is the reference grid's
  // root octave, read off the scale itself (built high→low, so the root is
  // the last row). Derived rather than kept as local state so it stays
  // right when a loaded melody re-anchors the grid underneath the sidebar.
  const viewOctave = (): number => {
    const scale = melodyStore.currentScale()
    return scale.length > 0
      ? scale[scale.length - 1].octave
      : melodyStore.getCurrentOctave()
  }

  return (
    <Show when={showPlaybackSetupInfo()}>
      <CollapsibleSection
        title="Playback Setup"
        storageKey="sidebar-playback-open"
        defaultOpen={false}
      >
        <div class={styles.scaleInfo} data-tour="singing.key-scale">
          <SafeSelect
            class={['dropdown-select-style', styles.keySelect].join(' ')}
            id="key-select"
            value={keyName()}
            onChange={(e) => {
              const newKey = e.currentTarget.value
              const currentKey = keyName()

              // In Editor tab, the key dropdown is an editing operation and
              // may transpose the actual melody. In Practice/sidebar usage it
              // must be view-only: update key/scale display, but never write
              // transposed notes back into the user's melody.
              const melody = melodyStore.getCurrentItems()
              if (activeTab() === TAB_COMPOSE && melody.length > 0) {
                const currentOffset = KEY_OFFSETS[currentKey] ?? 0
                const newOffset = KEY_OFFSETS[newKey] ?? 0
                const delta = newOffset - currentOffset

                if (delta !== 0) {
                  const transposed = melody.map((item) => {
                    const newMidi = item.note.midi + delta
                    const { name, octave } = midiToNote(newMidi)
                    return {
                      ...item,
                      note: {
                        ...item.note,
                        midi: newMidi,
                        name,
                        octave,
                        freq: midiToFreq(newMidi),
                      },
                    }
                  })
                  melodyStore.setMelody(transposed)
                }
              }

              setKeyName(newKey)
              melodyStore.refreshScale(
                newKey,
                melodyStore.getCurrentOctave(),
                scaleType(),
              )
            }}
          >
            <option value="C">C</option>
            <option value="G">G</option>
            <option value="D">D</option>
            <option value="A">A</option>
            <option value="E">E</option>
            <option value="B">B</option>
            <option value="F">F</option>
            <option value="Bb">Bb</option>
          </SafeSelect>

          <div class={styles.octaveCtrl} data-testid="octave-ctrl">
            <button
              class={styles.octaveBtn}
              data-testid="octave-btn-down"
              title="Lower octave"
              aria-label="Lower octave"
              onClick={() => host.onOctaveShift(-1)}
            >
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path
                  fill="currentColor"
                  d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"
                />
              </svg>
            </button>
            <span class={styles.octaveValue} data-testid="octave-value">
              {viewOctave()}
            </span>
            <button
              class={styles.octaveBtn}
              data-testid="octave-btn-up"
              title="Higher octave"
              aria-label="Higher octave"
              onClick={() => host.onOctaveShift(1)}
            >
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path
                  fill="currentColor"
                  d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"
                />
              </svg>
            </button>
          </div>

          <SafeSelect
            id="scale-select"
            class={['dropdown-select-style', styles.scaleSelect].join(' ')}
            value={scaleType()}
            onChange={(e) => {
              const st = e.currentTarget.value
              setScaleType(st)
              melodyStore.refreshScale(
                keyName(),
                melodyStore.getCurrentOctave(),
                st,
              )
            }}
          >
            <option value="major">Major</option>
            <option value="natural-minor">Minor (Natural)</option>
            <option value="harmonic-minor">Harmonic Minor</option>
            <option value="melodic-minor">Melodic Minor</option>
            <option value="dorian">Dorian</option>
            <option value="mixolydian">Mixolydian</option>
            <option value="phrygian">Phrygian</option>
            <option value="lydian">Lydian</option>
            <option value="pentatonic-major">Pentatonic Major</option>
            <option value="pentatonic-minor">Pentatonic Minor</option>
            <option value="blues">Blues</option>
            <option value="chromatic">Chromatic</option>
            {/* Custom scales saved by the user */}
            <Show when={Object.keys(customScalesMap()).length > 0}>
              <option disabled class={styles.customScaleSeparator}>
                {'─── Custom Scales ───'}
              </option>
              <For each={Object.keys(customScalesMap()).sort()}>
                {(name) => (
                  <option
                    class={styles.customScaleOption}
                    value={customScaleTypeId(name, customScalesMap()[name])}
                  >
                    <IconDiamond size={12} /> {name}
                  </option>
                )}
              </For>
            </Show>
          </SafeSelect>
          <button
            id="open-scale-builder"
            class={['ctrl-btn', 'roll-ctrl-btn', styles.openScaleBuilder].join(
              ' ',
            )}
            title="Build custom scale"
            onClick={() => host.onOpenScaleBuilder()}
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              style={{ 'margin-right': '4px' }}
            >
              <path
                fill="currentColor"
                d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"
              />
            </svg>
            Custom
          </button>
        </div>
      </CollapsibleSection>
    </Show>
  )
}

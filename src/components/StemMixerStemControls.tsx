// ============================================================
// StemMixerStemControls — stem control strips (shared by both layouts)
// ============================================================
// Two user-switchable views, persisted across sessions:
//   compact  — a vertical list; each stem is one horizontal row
//              (name · actions · left-to-right slider). Scales to any
//              number of stems and any screen width.
//   expanded — classic mixer deck; stems side by side, actions stacked
//              above a vertical fader, horizontal scroll on overflow.

import type { Component } from 'solid-js'
import type { Accessor } from 'solid-js'
import { createSignal, For, Index, Show } from 'solid-js'
import { Download, Ear, ListRows, SlidersVertical, Volume2, VolumeX, } from './icons'

interface StemTrack {
  label: string
  url: string
  color: string
  buffer: AudioBuffer | null
  gainNode: GainNode | null
  analyserNode: AnalyserNode | null
  sourceNode: AudioBufferSourceNode | null
  muted: boolean
  soloed: boolean
  volume: number
}

export interface StemMixerStemControlsProps {
  vocal: Accessor<StemTrack>
  midi: Accessor<StemTrack>
  instrumental: Accessor<StemTrack>
  /** Dynamic extra tracks (instrument parts) — one strip each. */
  extras: Accessor<StemTrack[]>
  anySoloed: Accessor<boolean>
  toggleSolo: (label: string) => void
  toggleMute: (label: string) => void
  setTrackVolume: (label: string, volume: number) => void
  handleDownload: (track: StemTrack) => Promise<void>
  practiceMode?: 'vocal' | 'instrumental' | 'full' | 'midi'
  requestedStems?: { vocal?: boolean; instrumental?: boolean; midi?: boolean }
  direction?: 'row' | 'column'
  /** Session stems on this device but not yet in the mix — rendered as
   *  add pills under the strips, so nobody has to leave the mixer (or
   *  the karaoke page, which has no stem-results view at all) to bring
   *  in drums/guitar/piano. Absent or empty hides the row. */
  addableStems?: Accessor<
    ReadonlyArray<{ key: string; label: string; color: string }>
  >
  onAddStem?: (key: string) => void
  /** Key of the stem currently hydrating, for the pill's busy state. */
  addingStem?: Accessor<string | null>
}

type StripView = 'compact' | 'expanded'

const VIEW_STORAGE_KEY = 'pitchperfect_mixer_strip_view'

const loadStripView = (): StripView => {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'expanded'
      ? 'expanded'
      : 'compact'
  } catch {
    return 'compact'
  }
}

// Module-scope so the panel-header button (rendered by the workspaces) and
// the strips (rendered here) share one persisted preference.
const [stripView, setStripView] = createSignal<StripView>(loadStripView())

/** Compact ⟷ expanded toggle for the stem strips. Lives in the panel's
 *  HEADER row (all three workspaces), not inside the strips themselves. */
export const StemStripViewToggle: Component = () => {
  const toggleView = () => {
    const next: StripView = stripView() === 'compact' ? 'expanded' : 'compact'
    setStripView(next)
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next)
    } catch {
      /* private mode — the toggle still works for this session */
    }
  }
  return (
    <button
      class="sm-action-btn sm-strip-view-toggle"
      onClick={toggleView}
      // The grid workspace's header doubles as a drag handle — the toggle
      // must not start a panel drag.
      onPointerDown={(e) => e.stopPropagation()}
      title={
        stripView() === 'compact'
          ? 'Switch to the fader deck (vertical sliders)'
          : 'Switch to the compact list'
      }
    >
      {stripView() === 'compact' ? <SlidersVertical /> : <ListRows />}
    </button>
  )
}

const calcVolPct = (track: StemTrack, anySoloed: boolean) =>
  Math.round(
    track.muted || (anySoloed && !track.soloed) ? 0 : track.volume * 100,
  )

const StemStrip: Component<{
  track: Accessor<StemTrack>
  label: string
  anySoloed: Accessor<boolean>
  toggleSolo: (label: string) => void
  toggleMute: (label: string) => void
  setTrackVolume: (label: string, volume: number) => void
  handleDownload: (track: StemTrack) => Promise<void>
  downloadTitle?: string
}> = (props) => {
  const track = () => props.track()
  return (
    <div class="sm-stem-strip">
      <div class="sm-stem-header">
        <span class="sm-stem-dot" style={{ background: track().color }} />
        <span class="sm-stem-label">{track().label}</span>
        <span class="sm-stem-vol-pct">
          {calcVolPct(track(), props.anySoloed())}%
        </span>
      </div>
      {/* Actions + slider share a wrapper so the compact row can only break
          between the header and this group — never between the buttons and
          the slider (a short stem name used to orphan the slider on its own
          line). Expanded mode flattens it with display: contents. */}
      <div class="sm-stem-controls">
        <div class="sm-stem-actions">
          <button
            class={`sm-action-btn ${track().soloed ? 'sm-active' : ''}`}
            onClick={() => props.toggleSolo(props.label)}
            title="Solo"
            style={{ color: track().soloed ? track().color : '' }}
          >
            <Ear />
          </button>
          <button
            class={`sm-action-btn ${track().muted ? 'sm-muted' : ''}`}
            onClick={() => props.toggleMute(props.label)}
            title="Mute"
          >
            {track().muted ? <VolumeX /> : <Volume2 />}
          </button>
          <button
            class="sm-action-btn"
            onClick={() => {
              void props.handleDownload(track())
            }}
            title={props.downloadTitle ?? 'Download'}
          >
            <Download />
          </button>
        </div>
        <input
          type="range"
          class="sm-volume-slider"
          min="0"
          max="100"
          value={Math.round(track().volume * 100)}
          onInput={(e) =>
            props.setTrackVolume(
              props.label,
              parseInt(e.currentTarget.value) / 100,
            )
          }
        />
      </div>
    </div>
  )
}

export const StemMixerStemControls: Component<StemMixerStemControlsProps> = (
  props,
) => {
  /** Strips in display order: the named tracks, then every extra part. */
  const strips = () => {
    const list: {
      track: () => StemTrack
      label: string
      downloadTitle?: string
    }[] = []
    if (props.vocal().url) list.push({ track: props.vocal, label: 'Vocal' })
    if (
      props.midi().buffer &&
      (props.practiceMode === 'midi' || props.requestedStems?.midi === true)
    ) {
      list.push({
        track: props.midi,
        label: 'MIDI',
        downloadTitle: 'Download MIDI',
      })
    }
    if (props.instrumental().url) {
      list.push({ track: props.instrumental, label: 'Instrumental' })
    }
    props.extras().forEach((extra, i) => {
      list.push({
        // Read through the accessor so volume/mute updates flow into the
        // strip without Index recreating it (see the Index note below).
        track: () => props.extras()[i] ?? extra,
        label: extra.label,
      })
    })
    return list
  }

  return (
    <div
      class="sm-strips"
      classList={{
        'sm-strips-compact': stripView() === 'compact',
        'sm-strips-expanded': stripView() === 'expanded',
      }}
      data-tour="mixer.stems"
    >
      {/* Index, not For: a volume/mute commit replaces the track object,
          and For would recreate the strip mid-gesture (dropping the slider
          drag). Index keys by position and streams updates through the
          accessor instead. */}
      <div class="sm-strips-body">
        <Index each={strips()}>
          {(strip) => (
            <StemStrip
              track={strip().track}
              label={strip().label}
              downloadTitle={strip().downloadTitle}
              anySoloed={props.anySoloed}
              toggleSolo={props.toggleSolo}
              toggleMute={props.toggleMute}
              setTrackVolume={props.setTrackVolume}
              handleDownload={props.handleDownload}
            />
          )}
        </Index>
      </div>
      <Show when={(props.addableStems?.() ?? []).length > 0}>
        <div class="sm-add-stem-row">
          <span class="sm-add-stem-label">Add stem</span>
          <For each={props.addableStems?.() ?? []}>
            {(part) => (
              <button
                type="button"
                class="sm-add-stem-pill"
                style={{ '--stem-color': part.color }}
                disabled={props.addingStem?.() !== null}
                onClick={() => props.onAddStem?.(part.key)}
                title={`Add the ${part.label} stem to the mix`}
              >
                <span
                  class="sm-add-stem-dot"
                  style={{ background: part.color }}
                />
                {props.addingStem?.() === part.key
                  ? 'Adding…'
                  : `+ ${part.label}`}
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}

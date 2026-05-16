// ============================================================
// StemMixerStemControls — stem control strips (shared by both layouts)
// ============================================================

import type { Component } from 'solid-js'
import type { Accessor } from 'solid-js'
import { Download, Ear, Volume2, VolumeX } from './icons'

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
  anySoloed: Accessor<boolean>
  toggleSolo: (label: string) => void
  toggleMute: (label: string) => void
  setTrackVolume: (label: string, volume: number) => void
  handleDownload: (track: StemTrack) => Promise<void>
  practiceMode?: 'vocal' | 'instrumental' | 'full' | 'midi'
  requestedStems?: { vocal?: boolean; instrumental?: boolean; midi?: boolean }
  direction?: 'row' | 'column'
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
  )
}

export const StemMixerStemControls: Component<StemMixerStemControlsProps> = (
  props,
) => {
  return (
    <div
      class="sm-strips-row"
      style={
        props.direction === 'column'
          ? { 'flex-direction': 'column', 'align-items': 'stretch' }
          : undefined
      }
    >
      {props.vocal().url && (
        <StemStrip
          track={props.vocal}
          label="Vocal"
          anySoloed={props.anySoloed}
          toggleSolo={props.toggleSolo}
          toggleMute={props.toggleMute}
          setTrackVolume={props.setTrackVolume}
          handleDownload={props.handleDownload}
        />
      )}
      {props.midi().buffer &&
        (props.practiceMode === 'midi' ||
          props.requestedStems?.midi === true) && (
          <StemStrip
            track={props.midi}
            label="MIDI"
            anySoloed={props.anySoloed}
            toggleSolo={props.toggleSolo}
            toggleMute={props.toggleMute}
            setTrackVolume={props.setTrackVolume}
            handleDownload={props.handleDownload}
            downloadTitle="Download MIDI"
          />
        )}
      {props.instrumental().url && (
        <StemStrip
          track={props.instrumental}
          label="Instrumental"
          anySoloed={props.anySoloed}
          toggleSolo={props.toggleSolo}
          toggleMute={props.toggleMute}
          setTrackVolume={props.setTrackVolume}
          handleDownload={props.handleDownload}
        />
      )}
    </div>
  )
}

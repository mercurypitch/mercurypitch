// ============================================================
// TV — the Karaoke room on a connected TV, two proofs of concept
// ============================================================
//
// AirPlay screen mirroring, or a cable, gives the iPhone a TV, and by default
// the TV mirrors it. Two switches put something of the room's own there
// instead, while the phone stays the room and the microphone:
//
//   Lyrics on a connected TV: the lyrics full screen, drawn as the lyrics
//   window draws them (ios/App/App/LyricsWindow/TVLyrics.swift). They move
//   only with "Keep playing in the background" on, the default: like the
//   lyrics window, the TV runs on the clock the Now Playing report carries.
//
//   Stage on a connected TV: the pitch lane, the lyrics and the score in the
//   TV's own landscape, whatever way the phone is held (TVStage.swift, a
//   page of its own fed by the room, src/lib/tv-stage/). The picture can be
//   moved earlier or later in small steps, kept on the phone, for a TV whose
//   picture and sound end up apart (tv-stage-store.ts).
//
// A TV shows one or the other, so each switch turns the other off; the rows
// say whether a TV is connected and what it shows, as the plugin reports it.
//
// Registered by the native entry alone, behind VITE_PORTABLE_CONSOLE and
// through a dynamic import (main.tsx), so a store build carries none of it
// and its TV always mirrors.

import { onTvLyrics, onTvStage, readTvLyrics, readTvStage, setTvLyricsEnabled, setTvStageEnabled, } from '@irchiinnuss/mobile-runtime/platform'
import type { Component } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
import { theDevice, thisDeviceLower } from '@/lib/device-noun'
import { describeTvStageOffset, nudgeTvStageOffset, TV_STAGE_OFFSET_STEP_MS, tvStageOffsetMs, } from '@/stores/tv-stage-store'
import { SettingsGroup, SettingsRow } from './settings/SettingsList'
import { SettingsSwitch } from './settings/SettingsSwitch'

export const TvLyricsPanel: Component = () => {
  const [present, setPresent] = createSignal(true)
  const [enabled, setEnabled] = createSignal(false)
  const [connected, setConnected] = createSignal(false)
  const [showing, setShowing] = createSignal(false)
  const [stagePresent, setStagePresent] = createSignal(true)
  const [stageEnabled, setStageEnabled] = createSignal(false)
  const [stageShowing, setStageShowing] = createSignal(false)

  const readLyrics = async (): Promise<void> => {
    const state = await readTvLyrics()
    if (state === null) {
      setPresent(false)
      return
    }
    setEnabled(state.enabled)
    setConnected(state.connected)
    setShowing(state.showing)
  }
  const readStage = async (): Promise<void> => {
    const state = await readTvStage()
    if (state === null) {
      setStagePresent(false)
      return
    }
    setStageEnabled(state.enabled)
    setStageShowing(state.showing)
  }
  const read = async (): Promise<void> => {
    await Promise.all([readLyrics(), readStage()])
  }
  void read()
  onCleanup(
    onTvLyrics((state) => {
      setConnected(state.connected)
      setShowing(state.showing)
    }),
  )
  onCleanup(
    onTvStage((state) => {
      setConnected(state.connected)
      setStageShowing(state.showing)
    }),
  )

  // Each switch turns the other off on the phone, so both are read again.
  const flip = (next: boolean): void => {
    setEnabled(next)
    void setTvLyricsEnabled(next).then(read)
  }
  const flipStage = (next: boolean): void => {
    setStageEnabled(next)
    void setTvStageEnabled(next).then(read)
  }

  const tv = (): string => {
    if (!present()) return `none on ${thisDeviceLower()}`
    return connected() ? 'connected' : 'none'
  }
  const shows = (): string => {
    if (!connected()) return 'nothing'
    if (stageShowing()) return 'the stage'
    return showing() ? 'the lyrics' : `${theDevice()}, mirrored`
  }

  return (
    <div class="mp-dev__audio" data-testid="dev-tv-lyrics">
      <SettingsGroup>
        <SettingsRow
          id="tv-lyrics"
          label="Lyrics on a connected TV"
          sub={`With AirPlay screen mirroring, the TV shows the Karaoke room's lyrics full screen in place of ${theDevice()}, which stays the room and the microphone. Off, the TV mirrors ${theDevice()}. The lyrics move only with Keep playing in the background on.`}
          accessory={
            <SettingsSwitch
              checked={enabled()}
              label="Lyrics on a connected TV"
              testId="dev-tv-lyrics-switch"
              disabled={!present()}
              onChange={flip}
            />
          }
        />
        <SettingsRow
          id="tv-stage"
          label="Stage on a connected TV"
          sub={`With AirPlay screen mirroring, the TV shows the Karaoke room's pitch lane, lyrics and score in its own landscape, however ${theDevice()} is held. Turning it on turns the lyrics off: the TV shows one or the other.`}
          accessory={
            <SettingsSwitch
              checked={stageEnabled()}
              label="Stage on a connected TV"
              testId="dev-tv-stage-switch"
              disabled={!stagePresent()}
              onChange={flipStage}
            />
          }
        />
        <SettingsRow
          id="tv-stage-offset"
          label="Stage picture"
          sub="Earlier for a picture that runs behind the sound on the TV, later for one ahead of it."
          value={describeTvStageOffset(tvStageOffsetMs())}
          accessory={
            // Side by side in the row's accessory place; a test build's
            // screen, so no stylesheet rule of its own.
            <span style={{ display: 'inline-flex', flex: 'none', gap: '8px' }}>
              <button
                type="button"
                class="mp-set-button mp-set-button--secondary mp-set-button--small"
                data-testid="dev-tv-stage-earlier"
                onClick={() => {
                  nudgeTvStageOffset(TV_STAGE_OFFSET_STEP_MS)
                }}
              >
                Earlier
              </button>
              <button
                type="button"
                class="mp-set-button mp-set-button--secondary mp-set-button--small"
                data-testid="dev-tv-stage-later"
                onClick={() => {
                  nudgeTvStageOffset(-TV_STAGE_OFFSET_STEP_MS)
                }}
              >
                Later
              </button>
            </span>
          }
        />
      </SettingsGroup>
      <dl class="mp-dev__readout">
        <div class="mp-dev__readout-row" data-tv-row="tv">
          <dt>TV</dt>
          <dd>{tv()}</dd>
        </div>
        <div class="mp-dev__readout-row" data-tv-row="shows">
          <dt>It shows</dt>
          <dd>{shows()}</dd>
        </div>
      </dl>
    </div>
  )
}

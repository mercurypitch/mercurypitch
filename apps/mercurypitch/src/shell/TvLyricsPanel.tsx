// ============================================================
// TV — the Karaoke room's lyrics on a connected TV, a proof of concept
// ============================================================
//
// AirPlay screen mirroring, or a cable, gives the iPhone a TV, and by default
// the TV mirrors it. With this switch on, the TV shows the Karaoke room's
// lyrics full screen instead, drawn as the lyrics window draws them
// (ios/App/App/LyricsWindow/TVLyrics.swift), while the phone stays the room
// and the microphone. The rows say whether a TV is connected and what it
// shows, as the plugin reports it.
//
// The lyrics move only with "Keep playing in the background" on, the
// default: like the lyrics window, the TV runs on the clock the Now Playing
// report carries, and the room sends that report only with the setting on.
//
// Registered by the native entry alone, behind VITE_PORTABLE_CONSOLE and
// through a dynamic import (main.tsx), so a store build carries none of it
// and its TV always mirrors.

import { onTvLyrics, readTvLyrics, setTvLyricsEnabled, } from '@irchiinnuss/mobile-runtime/platform'
import type { Component } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
import { theDevice, thisDeviceLower } from '@/lib/device-noun'
import { SettingsGroup, SettingsRow } from './settings/SettingsList'
import { SettingsSwitch } from './settings/SettingsSwitch'

export const TvLyricsPanel: Component = () => {
  const [present, setPresent] = createSignal(true)
  const [enabled, setEnabled] = createSignal(false)
  const [connected, setConnected] = createSignal(false)
  const [showing, setShowing] = createSignal(false)

  const read = async (): Promise<void> => {
    const state = await readTvLyrics()
    if (state === null) {
      setPresent(false)
      return
    }
    setEnabled(state.enabled)
    setConnected(state.connected)
    setShowing(state.showing)
  }
  void read()
  onCleanup(
    onTvLyrics((state) => {
      setConnected(state.connected)
      setShowing(state.showing)
    }),
  )

  const flip = (next: boolean): void => {
    setEnabled(next)
    void setTvLyricsEnabled(next).then(read)
  }

  const tv = (): string => {
    if (!present()) return `none on ${thisDeviceLower()}`
    return connected() ? 'connected' : 'none'
  }
  const shows = (): string => {
    if (!connected()) return 'nothing'
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

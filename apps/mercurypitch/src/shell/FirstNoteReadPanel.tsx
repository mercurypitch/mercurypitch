// ============================================================
// First note — read the singer's own songs again
// ============================================================
//
// First note reads each song of the singer's own once, and keeps what it
// found (first-note-own-songs.ts); each read tells the debug console what
// became of every line of the song. The console holds this launch alone, so
// once the app has closed since a read, nothing says why a song sat out.
// This row lets go of every kept read: the songs are read again when First
// note next opens (at once, if it is open), and the console has a fresh log
// to copy.
//
// Registered by the native entry alone, behind VITE_PORTABLE_CONSOLE and
// through a dynamic import (main.tsx), so a store build carries none of it.

import type { Component } from 'solid-js'
import { createSignal } from 'solid-js'
import { readOwnSongsAgain } from '@/features/first-note/first-note-own-songs'
import { SettingsGroup, SettingsRow } from './settings/SettingsList'

export const FirstNoteReadPanel: Component = () => {
  const [done, setDone] = createSignal(false)

  return (
    <SettingsGroup>
      <SettingsRow
        id="first-note-read-again"
        label="Read my songs again"
        sub="First note forgets what it found in your own songs and reads them again when it opens. The debug console then says what became of every line."
        value={done() ? 'Done' : undefined}
        onPress={() => {
          readOwnSongsAgain()
          setDone(true)
        }}
      />
    </SettingsGroup>
  )
}

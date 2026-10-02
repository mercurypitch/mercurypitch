// ============================================================
// Karaoke audio — the no-streaming path, on a phone that streams
// ============================================================
//
// Every iPhone before iOS 26 plays the Karaoke room without AudioDecoder:
// Safari has had one only since 26.0, and the app supports iOS 16. There the
// room decodes a stem up to the guard whole and refuses a song with a bigger
// one (stem-memory.ts, HOSTED_WHOLE_DECODE_MAX_BYTES), and no phone the owner
// tests on takes that path by itself (owner, 28 Sep). This section is how it
// is taken on purpose, and read afterwards:
//
//   "Force the no-streaming path" makes the room behave as if AudioDecoder
//   were undefined (stream-switches.ts): songs past the guard are refused,
//   a smaller one is decoded whole.
//
//   "Allow full decode past the guard" is the crash test: a song the guard
//   refuses is decoded whole instead, to learn whether this phone survives
//   it. The last song's line says so after a relaunch if it did not.
//
//   The rows: whether this phone has AudioDecoder, what isConfigSupported
//   says about each codec the room streams and about the last song's own,
//   and which way the last song was held, with its size and what a whole
//   decode holds (stem-load-path.ts). Every decision is also a line in the
//   audio record, so the Audio section's Copy report carries them.
//
// Registered by the native entry alone, behind VITE_PORTABLE_CONSOLE and
// through a dynamic import (main.tsx), so a store build carries none of it.

import type { Component } from 'solid-js'
import { createEffect, createSignal, Index, on, onCleanup } from 'solid-js'
import { describeSongPath, PATH_SOURCE, readLastSongPath, } from '@/features/stem-mixer/stem-load-path'
import { HOSTED_WHOLE_DECODE_MAX_BYTES } from '@/features/stem-mixer/stem-memory'
import { decodePastGuard, noStreamForced, setDecodePastGuard, setNoStreamForced, } from '@/features/stem-mixer/stream-switches'
import { onAudioDiagnostic, recordAudioDiagnostic, } from '@/lib/audio-diagnostics'
import { theDevice, thisDeviceLower } from '@/lib/device-noun'
import { codecSupport, configLine, decoderRow, lastSongConfig, STREAMED_CODECS, } from './karaoke-audio-readout'
import { SettingsGroup, SettingsRow } from './settings/SettingsList'
import { SettingsSwitch } from './settings/SettingsSwitch'

/** The guard as the switch states it, read from the guard itself. */
const GUARD_MB = Math.round(HOSTED_WHOLE_DECODE_MAX_BYTES / (1024 * 1024))

interface Row {
  id: string
  label: string
  value: string
}

export const KaraokeAudioPanel: Component = () => {
  const [tick, setTick] = createSignal(0)
  const [answers, setAnswers] = createSignal<Record<string, string>>({})
  const [lastAnswer, setLastAnswer] = createSignal<string | null>(null)

  // A song the room opens while this is on screen redraws the last-song rows.
  const unsubscribe = onAudioDiagnostic(() => setTick((n) => n + 1))
  onCleanup(unsubscribe)

  // Asked once per visit, and written into the audio record, so a copied
  // report says what this phone answered beside what the room then did.
  void Promise.all(
    STREAMED_CODECS.map(
      async (codec) => [codec.id, await codecSupport(codec.config)] as const,
    ),
  ).then((pairs) => {
    const found = Object.fromEntries(pairs)
    setAnswers(found)
    recordAudioDiagnostic(PATH_SOURCE, 'codec-support', {
      audioDecoder: typeof AudioDecoder === 'undefined' ? 'absent' : 'present',
      ...found,
    })
  })

  const record = () => {
    tick()
    return readLastSongPath()
  }

  // The last song's own codec, asked again whenever the song changes. The
  // newest question wins: an answer to an older one is dropped.
  let asked = 0
  createEffect(
    on(
      () => {
        const config = lastSongConfig(record())
        return config === null ? null : JSON.stringify(config)
      },
      (key) => {
        asked += 1
        const mine = asked
        setLastAnswer(null)
        if (key === null) return
        void codecSupport(JSON.parse(key) as AudioDecoderConfig).then(
          (answer) => {
            if (mine === asked) setLastAnswer(answer)
          },
        )
      },
    ),
  )

  const rows = (): Row[] => {
    const last = record()
    const config = lastSongConfig(last)
    return [
      {
        id: 'decoder',
        label: 'AudioDecoder',
        value: decoderRow(noStreamForced()),
      },
      ...STREAMED_CODECS.map((codec) => ({
        id: codec.id,
        label: codec.label,
        value: answers()[codec.id] ?? 'checking',
      })),
      { id: 'last-song', label: 'Last song', value: describeSongPath(last) },
      {
        id: 'last-codec',
        label: 'Its codec',
        value:
          config === null
            ? 'none yet'
            : configLine(config, lastAnswer() ?? 'checking'),
      },
    ]
  }

  return (
    <div class="mp-dev__audio" data-testid="dev-karaoke-audio">
      <SettingsGroup>
        <SettingsRow
          id="karaoke-force-no-stream"
          label="Force the no-streaming path"
          sub={`The Karaoke room behaves as if ${thisDeviceLower()} had no AudioDecoder, as every iPhone before iOS 26 has none. A song with a stem over ${GUARD_MB} MB is refused; a smaller stem is decoded whole.`}
          accessory={
            <SettingsSwitch
              checked={noStreamForced()}
              label="Force the no-streaming path"
              testId="dev-karaoke-force-no-stream"
              onChange={setNoStreamForced}
            />
          }
        />
        <SettingsRow
          id="karaoke-decode-past-guard"
          label="Allow full decode past the guard"
          sub={`A crash test. A song the room would refuse is decoded whole instead, about 90 MB a stem for four minutes. If the app restarts, ${theDevice()} did not survive it, and Last song says so.`}
          accessory={
            <SettingsSwitch
              checked={decodePastGuard()}
              label="Allow full decode past the guard"
              testId="dev-karaoke-decode-past-guard"
              onChange={setDecodePastGuard}
            />
          }
        />
      </SettingsGroup>
      <dl class="mp-dev__readout">
        <Index each={rows()}>
          {(row) => (
            <div class="mp-dev__readout-row" data-karaoke-row={row().id}>
              <dt>{row().label}</dt>
              <dd>{row().value}</dd>
            </div>
          )}
        </Index>
      </dl>
      <p class="mp-dev__row-sub">
        Every decision is also a line in the Audio section's Copy report.
      </p>
    </div>
  )
}

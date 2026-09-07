// Recorded-song settings compose the shared input, amp and manual-alignment controls.
import type { Accessor } from 'solid-js'
import { Show } from 'solid-js'
import { GuitarNightAmpControls } from './GuitarNightAmpControls'
import roomStyles from './GuitarNightApp.module.css'
import { GuitarNightHandSync } from './GuitarNightHandSync'
import { GuitarNightInputHealth } from './GuitarNightInputHealth'
import { GuitarNightInputPicker } from './GuitarNightInputPicker'
import { GuitarNightListeningAction } from './GuitarNightListeningAction'
import { GuitarNightMixerDialog } from './GuitarNightMixControls'
import type { GuitarNightRoomHandSync } from './GuitarNightRoom'
import styles from './GuitarNightSongSession.module.css'
import { GuitarRecordingLiveNotesToggle } from './GuitarRecordingControls'
import type { GuitarListeningController } from './useGuitarListeningController'
import type { GuitarNightAmpSettingsController } from './useGuitarNightAmpSettings'
import type { useGuitarNightSongPlayback } from './useGuitarNightSongPlayback'

interface GuitarNightSongSessionProps {
  isOpen: boolean
  onClose(): void
  listening: GuitarListeningController
  playback: ReturnType<typeof useGuitarNightSongPlayback>
  amp: GuitarNightAmpSettingsController
  isListening: Accessor<boolean>
  isCalibrating: Accessor<boolean>
  position: Accessor<number>
  formatTime(seconds: number): string
  handSync?: Accessor<GuitarNightRoomHandSync | null>
  focusHandPlacement?: boolean
  routePending?: boolean
  recordingPreview?:
    | {
        enabled: Accessor<boolean>
        onChange(enabled: boolean): void
      }
    | undefined
}

export function GuitarNightSongSession(props: GuitarNightSongSessionProps) {
  let handSyncHost: HTMLDivElement | undefined

  function initialFocus(): HTMLElement | undefined {
    if (props.focusHandPlacement !== true) return undefined
    const host = handSyncHost
    if (host?.isConnected !== true) return undefined
    const panel = host.closest<HTMLElement>('[role="dialog"]')
    if (panel) {
      // Scroll only this sheet; scrollIntoView also moves the fixed room.
      const offset =
        host.getBoundingClientRect().top -
        panel.getBoundingClientRect().top +
        panel.scrollTop
      panel.scrollTop = Math.max(0, offset - 8)
    }
    return host.querySelector<HTMLButtonElement>('button') ?? undefined
  }

  return (
    <GuitarNightMixerDialog
      isOpen={props.isOpen}
      label="Session"
      kicker="Song practice"
      title="Session"
      detail="Input and tone. Track levels live in Mix; A/B lives beside Play."
      closeLabel="Close Session"
      initialFocus={initialFocus}
      onClose={() => props.onClose()}
    >
      <div class={styles.sections}>
        <div>
          <GuitarNightInputPicker
            profile={props.listening.inputProfile}
            profileLabel={props.listening.inputProfileLabel}
            audioInputs={props.listening.audioInputs}
            selectedAudioInputId={props.listening.selectedAudioInputId}
            midiInputs={props.listening.midiInputs}
            selectedMidiInputId={props.listening.selectedMidiInputId}
            midiStatus={props.listening.midiConnectionStatus}
            evidenceExportEnabled={props.listening.evidenceExportEnabled}
            canExportEvidence={props.listening.canExportEvidence}
            switching={() =>
              props.routePending === true ||
              props.listening.status() === 'requesting' ||
              props.isCalibrating() ||
              props.listening.inputTakeoverPending() ||
              props.listening.midiConnectionStatus() === 'requesting'
            }
            onProfile={(kind) => void props.playback.selectInputProfile(kind)}
            onAudioInput={(id) => void props.playback.selectAudioInput(id)}
            onMidiInput={(id) => void props.playback.selectMidiInput(id)}
            onRefreshAudio={() => void props.listening.refreshAudioInputs()}
            onRefreshMidi={() => void props.listening.refreshMidiInputs()}
            onExportEvidence={props.listening.exportEvidenceReport}
          />
          <p class={styles.note}>
            Direct input can stay on while the song plays. Room mic and MIDI
            pause the backing when Listening starts.
          </p>
        </div>
        <GuitarNightListeningAction
          status={props.listening.status()}
          listening={props.isListening()}
          disabled={props.routePending}
          detail="Hear your notes while you practice."
          onToggle={props.playback.toggleListening}
        />
        <Show
          when={
            props.listening.status() !== 'off' &&
            props.listening.error() === null
          }
        >
          <GuitarNightInputHealth
            profile={props.listening.inputProfile}
            listening={props.isListening}
            calibrating={props.isCalibrating}
            health={props.listening.health}
            timingSource={props.listening.timingSource}
            latencyMs={props.listening.latencyMs}
            onCalibrate={() => void props.playback.calibrate()}
          />
        </Show>
        <div>
          <GuitarNightAmpControls
            targetLabel="Live input + take playback"
            takeNotice="Record keeps your dry input. Take playback can reapply the amp without changing that audio."
            parameters={props.amp.parameters}
            presetId={() => props.amp.settings().presetId}
            inputProfile={props.listening.inputProfile}
            listeningStatus={props.listening.status}
            onStartListening={props.playback.startListening}
            canMonitor={props.listening.canAmpMonitor}
            monitoringEnabled={props.listening.ampMonitoringEnabled}
            monitoringActive={props.listening.ampMonitoringActive}
            monitorDiagnostics={props.listening.monitorDiagnostics}
            monitorInputChannel={props.listening.monitorInputChannel}
            monitorInputChannelCount={props.listening.monitorInputChannelCount}
            onMonitorInputChannel={props.listening.selectMonitorInputChannel}
            onEnabled={props.amp.setEnabled}
            onPreset={props.amp.selectPreset}
            onParameter={props.amp.setContinuousParameter}
            onParameterCommit={props.amp.persist}
            onCabinet={props.amp.setCabinet}
            onMonitor={(enabled) =>
              void props.listening.setAmpMonitoringEnabled(enabled)
            }
            onReset={props.amp.reset}
          />
          <p class={styles.note}>
            The amp shapes your live guitar and Current amp take playback, not
            the backing song or stems.
          </p>
        </div>
        <Show when={props.recordingPreview}>
          {(preview) => (
            <div>
              <GuitarRecordingLiveNotesToggle
                enabled={preview().enabled()}
                onChange={(enabled) => preview().onChange(enabled)}
              />
              <p class={styles.note}>
                Show detected notes while recording. This changes only the
                preview, not the saved audio, notes or monitoring.
              </p>
            </div>
          )}
        </Show>
        <Show when={props.handSync?.()}>
          {(sync) => (
            <div ref={handSyncHost} class={roomStyles.handSyncHost}>
              <GuitarNightHandSync
                partName={sync().partName}
                firstMarkSeconds={sync().firstMarkSeconds}
                lastMarkSeconds={sync().lastMarkSeconds}
                placed={sync().placed}
                format={props.formatTime}
                onMarkFirst={() => sync().onMark('first', props.position())}
                onMarkLast={() => sync().onMark('last', props.position())}
                onClear={() => sync().onClear()}
                onNudge={(delta) => sync().onNudge(delta)}
              />
            </div>
          )}
        </Show>
      </div>
    </GuitarNightMixerDialog>
  )
}

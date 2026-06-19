// ============================================================
// UvrStemUploadControl — add a session from uploaded stems
// ============================================================
//
// Lets the user package a pre-separated vocal and/or instrumental into a
// session WITHOUT running the separation algorithm.

import type { Component, JSX } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { createManualStemSession } from '@/db/services/manual-stem-service'
import { showNotification } from '@/stores/notifications-store'
import { Music, Voice, X } from './icons'

interface UvrStemUploadControlProps {
  onCreated?: (sessionId: string) => void
  disabled?: boolean
}

const stripExt = (name: string) => name.replace(/\.[^.]+$/, '')

export const UvrStemUploadControl: Component<UvrStemUploadControlProps> = (
  props,
) => {
  const [songName, setSongName] = createSignal('')
  const [vocal, setVocal] = createSignal<File | null>(null)
  const [instrumental, setInstrumental] = createSignal<File | null>(null)
  const [busy, setBusy] = createSignal(false)

  const canSubmit = () =>
    !busy() &&
    props.disabled !== true &&
    (vocal() !== null || instrumental() !== null)

  // Returns a file-input change handler; used as an event handler via props.
  // eslint-disable-next-line solid/reactivity
  const pick = (setter: (f: File | null) => void) => (e: Event) => {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0] ?? null
    setter(file)
    // Default the song name from the first chosen file.
    if (file && songName().trim() === '') setSongName(stripExt(file.name))
    input.value = ''
  }

  const reset = () => {
    setSongName('')
    setVocal(null)
    setInstrumental(null)
  }

  const submit = async () => {
    if (!canSubmit()) return
    setBusy(true)
    try {
      const id = await createManualStemSession({
        songName: songName(),
        vocal: vocal() ?? undefined,
        instrumental: instrumental() ?? undefined,
      })
      if (id !== null) {
        showNotification('Stem session added to library', 'success')
        reset()
        props.onCreated?.(id)
      }
    } catch (err) {
      console.error('[UvrStemUpload] failed:', err)
      showNotification('Failed to add stems', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class="stem-upload">
      <div class="stem-upload-header">
        <h5>Upload pre-separated stems</h5>
        <span class="stem-upload-hint">
          No separation — packaged as a session
        </span>
      </div>

      <input
        class="stem-upload-name"
        type="text"
        placeholder="Song name…"
        value={songName()}
        onInput={(e) => setSongName(e.currentTarget.value)}
        disabled={busy()}
      />

      <div class="stem-upload-pickers">
        <StemPicker
          label="Vocal"
          icon={<Voice />}
          file={vocal()}
          onPick={pick(setVocal)}
          onClear={() => setVocal(null)}
          disabled={busy()}
        />
        <StemPicker
          label="Instrumental"
          icon={<Music />}
          file={instrumental()}
          onPick={pick(setInstrumental)}
          onClear={() => setInstrumental(null)}
          disabled={busy()}
        />
      </div>

      <button
        class="stem-upload-submit"
        onClick={() => void submit()}
        disabled={!canSubmit()}
      >
        {busy() ? 'Adding…' : 'Add to library'}
      </button>
    </div>
  )
}

const StemPicker: Component<{
  label: string
  icon: JSX.Element
  file: File | null
  onPick: (e: Event) => void
  onClear: () => void
  disabled: boolean
}> = (props) => {
  return (
    <div
      class="stem-picker"
      classList={{ 'stem-picker--set': props.file !== null }}
    >
      <label class="stem-picker-label">
        {props.icon}
        <span class="stem-picker-text">
          <Show
            when={props.file}
            fallback={`Choose ${props.label.toLowerCase()}`}
          >
            {props.file!.name}
          </Show>
        </span>
        <input
          type="file"
          accept="audio/*"
          style={{ display: 'none' }}
          onChange={(e) => props.onPick(e)}
          disabled={props.disabled}
        />
      </label>
      <Show when={props.file}>
        <button
          class="stem-picker-clear"
          title={`Remove ${props.label.toLowerCase()}`}
          onClick={() => props.onClear()}
        >
          <X />
        </button>
      </Show>
    </div>
  )
}

// Microphone input recovery — choose the next capture route without opening or moving a live microphone.

import { createMemo, createSignal, createUniqueId, For, onCleanup, onMount, Show, } from 'solid-js'
import type { GlassMicrophoneInput } from '../host'
import type { MicrophoneIssue } from './mic-error'
import styles from './MicrophoneInputRecovery.module.css'

interface MicrophoneInputRecoveryProps {
  microphoneInput?: GlassMicrophoneInput
  issue: MicrophoneIssue
}

interface MicrophoneChoice {
  deviceId: string
  label: string
  unavailable?: boolean
}

const SYSTEM_DEFAULT: MicrophoneChoice = {
  deviceId: '',
  label: 'System default',
}
const MAXIMUM_LABEL_LENGTH = 120

function boundedLabel(label: string): string {
  const normalized = label.replace(/\s+/g, ' ').trim()
  if (normalized.length <= MAXIMUM_LABEL_LENGTH) return normalized
  return `${normalized.slice(0, MAXIMUM_LABEL_LENGTH - 1)}…`
}

function namedChoices(
  choices: readonly { deviceId: string; label: string }[],
): readonly MicrophoneChoice[] {
  const seen = new Set<string>()
  const named: MicrophoneChoice[] = []
  for (const choice of choices) {
    if (
      typeof choice?.deviceId !== 'string' ||
      typeof choice.label !== 'string' ||
      seen.has(choice.deviceId)
    )
      continue
    seen.add(choice.deviceId)
    const label = boundedLabel(choice.label)
    named.push({
      deviceId: choice.deviceId,
      label:
        label ||
        (choice.deviceId === ''
          ? SYSTEM_DEFAULT.label
          : `Microphone ${named.length + 1}`),
    })
  }
  if (!seen.has(SYSTEM_DEFAULT.deviceId)) named.unshift(SYSTEM_DEFAULT)
  return named
}

export function MicrophoneInputRecovery(props: MicrophoneInputRecoveryProps) {
  const selectId = createUniqueId()
  const [choices, setChoices] = createSignal<readonly MicrophoneChoice[]>([
    SYSTEM_DEFAULT,
  ])
  const [selected, setSelected] = createSignal('')
  const [listing, setListing] = createSignal(false)
  const [saving, setSaving] = createSignal(false)
  const [listError, setListError] = createSignal('')
  const [selectionError, setSelectionError] = createSignal('')
  let input: GlassMicrophoneInput | undefined
  let mediaDevices: MediaDevices | undefined
  let mounted = true
  let listAttempt = 0
  let selectionAttempt = 0
  let selectionQueue = Promise.resolve()

  const visibleChoices = createMemo<readonly MicrophoneChoice[]>(() => {
    const available = choices()
    const current = selected()
    if (available.some((choice) => choice.deviceId === current))
      return available
    return [
      ...available,
      {
        deviceId: current,
        label: 'Saved microphone unavailable',
        unavailable: true,
      },
    ]
  })

  async function loadChoices(
    currentInput: GlassMicrophoneInput,
    attempt: number,
  ): Promise<void> {
    try {
      const available = await currentInput.list()
      if (!mounted || attempt !== listAttempt) return
      setChoices(namedChoices(available))
      setListError('')
    } catch {
      if (!mounted || attempt !== listAttempt) return
      setListError('Microphone choices could not be refreshed.')
    } finally {
      if (mounted && attempt === listAttempt) setListing(false)
    }
  }

  function refreshChoices(): void {
    const currentInput = input
    if (currentInput === undefined) return
    const attempt = ++listAttempt
    setListing(true)
    void loadChoices(currentInput, attempt)
  }

  function handleSelection(
    event: Event & { currentTarget: HTMLSelectElement },
  ) {
    const currentInput = input
    const deviceId = event.currentTarget.value
    if (currentInput === undefined) return
    const attempt = ++selectionAttempt
    setSelected(deviceId)
    setSaving(true)
    setSelectionError('')
    selectionQueue = selectionQueue
      .then(() => {
        if (!mounted) return
        return currentInput.select(deviceId)
      })
      .then(
        () => {
          if (!mounted || attempt !== selectionAttempt) return
          setSelectionError('')
          setSaving(false)
        },
        () => {
          if (!mounted || attempt !== selectionAttempt) return
          setSelectionError(
            'That microphone choice could not be saved. Choose an input again.',
          )
          setSaving(false)
        },
      )
    void selectionQueue
  }

  const handleDeviceChange = (): void => refreshChoices()

  onMount(() => {
    const currentInput = props.microphoneInput
    input = currentInput
    if (currentInput === undefined) return
    try {
      setSelected(currentInput.selected())
    } catch {
      setListError('The saved microphone choice could not be read.')
    }
    refreshChoices()
    mediaDevices =
      typeof navigator === 'undefined' ? undefined : navigator.mediaDevices
    mediaDevices?.addEventListener('devicechange', handleDeviceChange)
  })

  onCleanup(() => {
    mounted = false
    listAttempt++
    selectionAttempt++
    mediaDevices?.removeEventListener('devicechange', handleDeviceChange)
  })

  return (
    <Show when={props.issue.action === 'retry'}>
      <div class={styles.recovery} data-testid="microphone-input-recovery">
        <Show when={props.microphoneInput !== undefined}>
          <label class={styles.field} for={selectId}>
            <span>Microphone</span>
            <select
              id={selectId}
              class={styles.select}
              name="microphone"
              value={selected()}
              disabled={listing() && choices().length === 0}
              aria-busy={listing() || saving()}
              onChange={handleSelection}
            >
              <For each={visibleChoices()}>
                {(choice) => (
                  <option
                    value={choice.deviceId}
                    selected={choice.deviceId === selected()}
                    disabled={choice.unavailable === true}
                  >
                    {choice.label}
                  </option>
                )}
              </For>
            </select>
          </label>
          <Show when={listError() || selectionError()}>
            <p class={styles.error} role="alert">
              {selectionError() || listError()}
            </p>
          </Show>
          <Show
            when={!listError() && !selectionError() && (listing() || saving())}
          >
            <p class={styles.status} role="status">
              {saving() ? 'Saving microphone…' : 'Finding microphones…'}
            </p>
          </Show>
        </Show>
        <Show when={props.issue.diagnostic}>
          {(diagnostic) => (
            <details class={styles.details}>
              <summary>Technical details</summary>
              <code>
                {diagnostic().name}
                <Show when={diagnostic().message}>
                  {`: ${diagnostic().message}`}
                </Show>
              </code>
            </details>
          )}
        </Show>
      </div>
    </Show>
  )
}

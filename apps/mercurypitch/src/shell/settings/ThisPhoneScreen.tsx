// ============================================================
// ThisPhoneScreen — a readout a singer can paste into a message
// ============================================================
//
// S6 step 9 (8a). The phone and the app (model, system, the version with
// its build, the graphics tier), then the sound (the audio rate, the audio
// session, the microphone's state), and one button that copies it all as a
// block. Until now the only readout was the Developer screen's, in test
// builds only. Nothing on it is personal: the phone's own name is never
// read.

import type { JSX } from 'solid-js'
import { createSignal, For, onCleanup, onMount } from 'solid-js'
import { singMicGranted } from '@/features/sing-room/sing-room-settings'
import { AppIcon, CopyIcon, GraphicsIcon, InfoIcon, MicIcon, PhoneIcon, SpeakerIcon, WaveIcon, } from '../icons'
import { copyText } from './copy-text'
import type { DeviceFacts } from './device-facts'
import { audioRate, audioSession, audioSessionLine, detailsText, graphicsTier, loadDeviceFacts, tierLabel, } from './device-facts'
import { knownInput } from './level-check'
import { SettingsGroup, SettingsRow } from './SettingsList'

const UNREAD = 'Not available'

interface Reading {
  id: string
  label: string
  icon: () => JSX.Element
  value: string
}

/** The microphone's state in a word: what the phone last said about it. */
function microphoneLine(): string {
  const heard = knownInput()
  if (heard === 'denied') return 'Off'
  if (heard !== null || singMicGranted()) return 'Allowed'
  return 'Not asked yet'
}

function audioLine(): string {
  const rate = audioRate()
  return rate === null
    ? 'Starts with the first sound'
    : `${Number((rate / 1000).toFixed(1))} kHz`
}

export function ThisPhoneScreen(): JSX.Element {
  const [facts, setFacts] = createSignal<DeviceFacts | null>(null)
  const [copied, setCopied] = createSignal(false)
  let copiedTimer: ReturnType<typeof setTimeout> | undefined
  let live = true
  onCleanup(() => {
    live = false
    clearTimeout(copiedTimer)
  })

  onMount(() => {
    void loadDeviceFacts().then((read) => {
      if (live) setFacts(read)
    })
  })

  const phone = (): Reading[] => [
    {
      id: 'phone-model',
      label: 'Model',
      icon: () => <PhoneIcon />,
      value: facts()?.model ?? UNREAD,
    },
    {
      id: 'phone-system',
      label: 'System',
      icon: () => <InfoIcon />,
      value: facts()?.system ?? UNREAD,
    },
    {
      id: 'phone-app',
      label: 'App',
      icon: () => <AppIcon />,
      value: facts()?.version ?? UNREAD,
    },
    {
      id: 'phone-graphics',
      label: 'Graphics',
      icon: () => <GraphicsIcon />,
      value: tierLabel(graphicsTier()),
    },
  ]

  const sound = (): Reading[] => [
    {
      id: 'phone-audio',
      label: 'Audio',
      icon: () => <SpeakerIcon />,
      value: audioLine(),
    },
    {
      id: 'phone-session',
      label: 'Audio session',
      icon: () => <WaveIcon />,
      value: audioSessionLine(audioSession()),
    },
    {
      id: 'phone-mic',
      label: 'Microphone',
      icon: () => <MicIcon />,
      value: microphoneLine(),
    },
  ]

  async function copy(): Promise<void> {
    const text = detailsText([...phone(), ...sound()])
    if (!(await copyText(text)) || !live) return
    setCopied(true)
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div class="mp-set" data-testid="this-phone-screen">
      <div class="mp-set__cols">
        <div class="mp-set__col">
          <SettingsGroup>
            <For each={phone()}>
              {(reading) => (
                <SettingsRow
                  id={reading.id}
                  icon={reading.icon()}
                  label={reading.label}
                  value={reading.value}
                />
              )}
            </For>
          </SettingsGroup>
        </div>
        <div class="mp-set__col">
          <SettingsGroup>
            <For each={sound()}>
              {(reading) => (
                <SettingsRow
                  id={reading.id}
                  icon={reading.icon()}
                  label={reading.label}
                  value={reading.value}
                />
              )}
            </For>
          </SettingsGroup>
          <button
            type="button"
            class="mp-set-button mp-set-button--secondary"
            data-testid="phone-copy"
            onClick={() => {
              void copy()
            }}
          >
            <CopyIcon size={18} />
            {copied() ? 'Copied' : 'Copy details'}
          </button>
          <p class="mp-set__caption mp-set__caption--center">
            Paste them into a message to us when something goes wrong.
          </p>
        </div>
      </div>
    </div>
  )
}

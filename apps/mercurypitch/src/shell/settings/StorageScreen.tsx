// ============================================================
// StorageScreen — what is kept on this phone, a clear for each
// ============================================================
//
// S6 step 7 (mock 6a to 6c). One total and a bar in the four categories'
// colours, then each category with its count, its size and its own Clear.
// The pitch model has no Clear: it goes only with the app. Every clear asks
// first and says what it removes and what it leaves, and a clear that fails
// says so. Start fresh lives here too (REQ-NAM-023), offered only with no
// account signed in, and it says before it happens that the old identity's
// history cannot be reached from this phone again.

import type { JSX } from 'solid-js'
import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { needsSignIn } from '@/db/services/auth-service'
import { getAuthToken } from '@/db/services/user-service'
import { wipeVoiceTakes } from '@/db/services/voice-take-service'
import { clearLocalVoiceprints } from '@/db/services/voiceprint-service'
import { RefreshIcon } from '../icons'
import { STORAGE_COPY, takesLine } from './account-copy'
import { accountSignedIn } from './account-state'
import { askSettings } from './settings-alert'
import { SettingsGroup, SettingsRow } from './SettingsList'
import { startFresh } from './start-fresh'
import type { StorageFacts } from './storage-facts'
import { formatBytes, loadStorageFacts } from './storage-facts'

/** The four categories, in the order the screen lists them. Each has its
 *  colour class, on its row's dot and on its part of the bar. */
type Category = 'takes' | 'prints' | 'models' | 'rooms'

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/**
 * What a voiceprint clear leaves, said truly. Signed in, the account keeps
 * its copies. Signed out, a phone that has held a session (the phone's own,
 * made when it first saved practice, or an account's it signed out of) sent
 * its voiceprints online with it, and they stay there. Only a phone that
 * never held one keeps them nowhere else.
 */
function voiceprintsClearText(): string {
  if (accountSignedIn()) return STORAGE_COPY.clearVoiceprints.account
  if (getAuthToken() !== null || needsSignIn()) {
    return STORAGE_COPY.clearVoiceprints.online
  }
  return STORAGE_COPY.clearVoiceprints.phoneOnly
}

/** What the bar shows, for a screen reader: every category and its size. */
function barLabel(known: StorageFacts): string {
  const rooms =
    known.cachedRooms.bytes === 0
      ? 'none'
      : formatBytes(known.cachedRooms.bytes)
  return [
    known.takes === null
      ? 'Takes unreadable'
      : `Takes ${formatBytes(known.takes.bytes)}`,
    `voiceprints ${formatBytes(known.voiceprints.bytes)}`,
    `models ${formatBytes(known.models.bytes)}`,
    `cached rooms ${rooms}`,
  ].join(', ')
}

/** The bar's parts, in proportion to the total; an empty category is none. */
function barParts(
  known: StorageFacts,
): { category: Category; share: number }[] {
  if (known.total <= 0) return []
  const sizes: [Category, number][] = [
    ['takes', known.takes?.bytes ?? 0],
    ['prints', known.voiceprints.bytes],
    ['models', known.models.bytes],
    ['rooms', known.cachedRooms.bytes],
  ]
  return sizes
    .filter(([, bytes]) => bytes > 0)
    .map(([category, bytes]) => ({ category, share: bytes / known.total }))
}

function Dot(props: { category: Category }): JSX.Element {
  return <span class={`mp-storage__dot is-${props.category}`} />
}

function ClearButton(props: {
  label: string
  disabled: boolean
  onPress?: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      class="mp-set-button mp-set-button--secondary mp-set-button--small"
      aria-label={props.label}
      disabled={props.disabled}
      onClick={() => props.onPress?.()}
    >
      Clear
    </button>
  )
}

export function StorageScreen(): JSX.Element {
  const [facts, setFacts] = createSignal<StorageFacts | null>(null)
  const [error, setError] = createSignal('')
  let live = true
  onCleanup(() => {
    live = false
  })

  async function load(): Promise<void> {
    const next = await loadStorageFacts()
    if (live) setFacts(next)
  }

  onMount(() => {
    void load()
  })

  async function clearTakes(): Promise<void> {
    setError('')
    // The wipe is one transaction: when it fails, nothing went.
    if (!(await wipeVoiceTakes()) && live) {
      setError('Could not clear the takes. They are all still here.')
    }
    await load()
  }

  function askClearTakes(count: number): void {
    askSettings({
      title: `Clear ${plural(count, 'take', 'takes')}?`,
      text: STORAGE_COPY.clearTakes,
      confirmLabel: 'Clear',
      destructive: true,
      onConfirm: () => void clearTakes(),
    })
  }

  function askClearVoiceprints(count: number): void {
    askSettings({
      title: `Clear ${plural(count, 'voiceprint', 'voiceprints')}?`,
      text: voiceprintsClearText(),
      confirmLabel: 'Clear',
      destructive: true,
      onConfirm: () => {
        clearLocalVoiceprints()
        void load()
      },
    })
  }

  function askStartFresh(): void {
    askSettings({
      title: 'Start fresh on this phone?',
      text: 'This phone gets a new identity. The history made under the old one cannot be reached from this phone again.',
      confirmLabel: 'Start fresh',
      destructive: true,
      onConfirm: startFresh,
    })
  }

  return (
    <div class="mp-set" data-testid="storage-screen">
      <Show when={facts()}>
        {(known) => (
          <div class="mp-storage">
            <div class="mp-set-card mp-storage__head">
              <div class="mp-storage__sum">
                <strong class="mp-storage__total">
                  {formatBytes(known().total)}
                </strong>
              </div>
              <p class="mp-storage__caption">
                Kept by MercuryPitch on this phone
              </p>
              <div
                class="mp-storage__bar"
                role="img"
                aria-label={barLabel(known())}
              >
                <For each={barParts(known())}>
                  {(part) => (
                    <i
                      class={`is-${part.category}`}
                      style={{ '--p': `${(part.share * 100).toFixed(2)}%` }}
                    />
                  )}
                </For>
              </div>
            </div>
            <div class="mp-storage__kept">
              <SettingsGroup>
                <SettingsRow
                  id="storage-takes"
                  icon={<Dot category="takes" />}
                  label="Takes"
                  sub={
                    known().takes === null
                      ? 'Could not read the takes just now'
                      : takesLine(known().takes?.count ?? 0)
                  }
                  value={
                    known().takes === null
                      ? undefined
                      : formatBytes(known().takes?.bytes ?? 0)
                  }
                  accessory={
                    <Show when={known().takes}>
                      {(takes) => (
                        <ClearButton
                          label="Clear takes"
                          disabled={takes().count === 0}
                          onPress={() => {
                            askClearTakes(takes().count)
                          }}
                        />
                      )}
                    </Show>
                  }
                />
                <SettingsRow
                  id="storage-voiceprints"
                  icon={<Dot category="prints" />}
                  label="Voiceprints"
                  sub={plural(
                    known().voiceprints.count,
                    'voiceprint',
                    'voiceprints',
                  )}
                  value={formatBytes(known().voiceprints.bytes)}
                  accessory={
                    <ClearButton
                      label="Clear voiceprints"
                      disabled={known().voiceprints.count === 0}
                      onPress={() => {
                        askClearVoiceprints(known().voiceprints.count)
                      }}
                    />
                  }
                />
                <SettingsRow
                  id="storage-models"
                  icon={<Dot category="models" />}
                  label="Models"
                  sub="The pitch model and its runtime, part of the app"
                  value={formatBytes(known().models.bytes)}
                />
                {/* Nothing is ever cached in a build where every room ships
                    inside the app, so its Clear stays off. */}
                <SettingsRow
                  id="storage-rooms"
                  icon={<Dot category="rooms" />}
                  label="Cached rooms"
                  sub="None yet: every room ships with the app"
                  value={formatBytes(known().cachedRooms.bytes)}
                  accessory={
                    <ClearButton label="Clear cached rooms" disabled={true} />
                  }
                />
              </SettingsGroup>
              <Show when={error() !== ''}>
                <p
                  class="mp-set__error"
                  role="alert"
                  data-testid="storage-error"
                >
                  {error()}
                </p>
              </Show>
            </div>
            <Show when={!accountSignedIn()}>
              <div class="mp-storage__fresh">
                <SettingsGroup>
                  <SettingsRow
                    id="start-fresh"
                    icon={<RefreshIcon />}
                    label="Start fresh"
                    sub="A new identity for this phone"
                    tone="danger"
                    onPress={askStartFresh}
                  />
                </SettingsGroup>
              </div>
            </Show>
          </div>
        )}
      </Show>
    </div>
  )
}

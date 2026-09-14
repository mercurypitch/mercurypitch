// Night audio choices expose the saved processing method and account-aware actions before any job starts.
import { createEffect, createMemo, createSignal, For, onCleanup, Show, untrack, } from 'solid-js'
import { Cloud, Cpu } from '@/components/icons'
import { MercuryCheckbox } from '@/components/MercuryCheckbox'
import { accountHeld, currentAccountId } from '@/db/services/auth-service'
import { authVersion } from '@/db/services/user-service'
import { balanceVersion } from '@/stores/billing-store'
import { setUvrProcessingMode, uvrProcessingMode } from '@/stores/uvr-store'
import { loadNightAudioFacts } from './night-audio-access'
import type { NightAudioFacts } from './night-audio-eligibility'
import { nightAudioEligibility } from './night-audio-eligibility'
import { readNightAudioPreferences, saveNightAudioPreferences, } from './night-audio-preferences'
import type { NightMusicAction } from './night-music-import'
import styles from './NightAudioChoices.module.css'
import shared from './NightMusicImport.module.css'
import type { NightMusicImportController } from './useNightMusicImport'

export function NightAudioChoices(props: {
  controller: NightMusicImportController
}) {
  const actions = createMemo(() =>
    props.controller.actions().filter((action) => action.audio),
  )
  const request = createMemo(
    () =>
      (
        actions().find((action) => action.audio?.target !== 'vocals') ??
        actions()[0]
      )?.audio,
  )
  const [facts, setFacts] = createSignal<NightAudioFacts>()
  const [failure, setFailure] = createSignal('')
  const [revision, setRevision] = createSignal(0)
  const [preferences, setPreferences] = createSignal(
    untrack(() => readNightAudioPreferences(props.controller.room)),
  )
  const [preferenceNotice, setPreferenceNotice] = createSignal('')
  // Snapshot once on entry. Changing the checkbox or signing in is never an instruction to run.
  let auto = untrack(
    () => props.controller.claimAutoImport() && preferences().auto,
  )
  const automaticOutput = untrack(() => preferences().output)
  const automaticMode = untrack(uvrProcessingMode)
  const automaticAccount = untrack(currentAccountId)
  const refresh = () => setRevision((value) => value + 1)
  window.addEventListener('focus', refresh)
  onCleanup(() => window.removeEventListener('focus', refresh))

  createEffect(() => {
    const source = request()
    authVersion()
    balanceVersion()
    revision()
    const abort = new AbortController()
    onCleanup(() => abort.abort())
    setFacts(undefined)
    setFailure('')
    if (!source) return
    void loadNightAudioFacts(source, abort.signal)
      .then((result) => {
        if (!abort.signal.aborted) setFacts(result)
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted) {
          auto = false
          setFailure(
            error instanceof Error
              ? error.message
              : 'Music options could not be checked. Retry to check again.',
          )
        }
      })
  })

  const access = (action: NightMusicAction) => {
    const current = facts()
    if (!current || !action.audio) return null
    return nightAudioEligibility(
      { ...current, signedIn: accountHeld() },
      uvrProcessingMode(),
      action.audio.target,
    )
  }
  const chooseMode = (mode: 'local' | 'server') => {
    auto = false
    try {
      setUvrProcessingMode(mode)
    } catch {
      setPreferenceNotice(
        'This browser could not remember the processing method. Enable local storage and try again.',
      )
    }
  }
  const remember = (next: ReturnType<typeof preferences>) => {
    setPreferences(next)
    if (!saveNightAudioPreferences(props.controller.room, next))
      setPreferenceNotice(
        'This choice works for this visit, but could not be remembered on this device.',
      )
  }
  const run = (action: NightMusicAction) => {
    auto = false
    remember({
      ...preferences(),
      output: action.audio?.target === 'vocals' ? 'vocals' : 'band',
    })
    void props.controller.run(action, uvrProcessingMode())
  }
  createEffect(() => {
    if (!auto || !facts()) return
    auto = false
    const action = actions().find((item) =>
      automaticOutput === 'vocals'
        ? item.audio?.target === 'vocals'
        : item.audio?.target !== 'vocals',
    )
    if (
      action &&
      action.unavailable === undefined &&
      props.controller.blockedReason() === null &&
      uvrProcessingMode() === automaticMode &&
      currentAccountId() === automaticAccount &&
      access(action)?.available === true
    )
      void props.controller.run(action, automaticMode)
    else
      setPreferenceNotice(
        'Queued for you: the preferred preparation is unavailable. Choose an available option when you are ready.',
      )
  })

  return (
    <section class={styles.audioChoices} aria-label="Audio preparation options">
      <h3>Where to separate</h3>
      <div class={styles.method} role="group" aria-label="Processing method">
        <button
          type="button"
          aria-pressed={uvrProcessingMode() === 'local'}
          onClick={() => chooseMode('local')}
        >
          <Cpu />
          <span>
            <strong>Local</strong>
            <small>Free · on this device</small>
          </span>
        </button>
        <button
          type="button"
          aria-pressed={uvrProcessingMode() === 'server'}
          onClick={() => chooseMode('server')}
        >
          <Cloud />
          <span>
            <strong>Cloud</strong>
            <small>
              {accountHeld() ? 'GPU · uses credits' : 'Sign-in required'}
            </small>
          </span>
        </button>
      </div>
      <p class={styles.methodNote}>
        {uvrProcessingMode() === 'local'
          ? 'Audio processing stays on this device. The first run downloads the separation model.'
          : 'Audio is sent to our cloud GPU for separation. Check the estimate below before starting.'}
      </p>
      <Show when={failure()}>
        <p class={shared.error} role="alert">
          {failure()}{' '}
          <button type="button" onClick={refresh}>
            Retry check
          </button>
        </p>
      </Show>
      <Show when={!facts() && !failure()}>
        <p class={shared.notice} role="status">
          Checking saved parts and preparation options…
        </p>
      </Show>
      <div class={styles.audioActions}>
        <For each={actions()}>
          {(action) => (
            <div class={styles.audioAction}>
              <button
                type="button"
                disabled={
                  access(action)?.available !== true ||
                  action.unavailable !== undefined ||
                  props.controller.blockedReason() !== null
                }
                onClick={() => run(action)}
              >
                <strong>{action.label}</strong>
                <span>{action.unavailable ?? action.detail}</span>
              </button>
              <Show when={access(action)}>
                {(choice) => (
                  <>
                    <p class={styles.accessNote}>{choice().message}</p>
                    <Show when={choice().recovery}>
                      {(recovery) => (
                        <button
                          class={styles.recovery}
                          type="button"
                          onClick={() => {
                            auto = false
                            const section = recovery()
                            if (section === 'retry') refresh()
                            else if (section === 'cloud') chooseMode('server')
                            else props.controller.resolveAccess(section)
                          }}
                        >
                          {recovery() === 'account'
                            ? 'Sign in'
                            : recovery() === 'credits'
                              ? 'Get credits'
                              : recovery() === 'cloud'
                                ? 'Use Cloud'
                                : 'Retry check'}
                        </button>
                      )}
                    </Show>
                  </>
                )}
              </Show>
            </div>
          )}
        </For>
      </div>
      <Show when={props.controller.file()}>
        <div class={styles.autoChoice}>
          <MercuryCheckbox
            checked={preferences().auto}
            onChange={(checked) => {
              auto = false
              remember({ ...preferences(), auto: checked })
            }}
          >
            Automatically separate new songs
          </MercuryCheckbox>
          <p>
            Use this method and the last separation you choose in this room. If
            unavailable, keep the song queued. Playback stays paused.
          </p>
        </div>
      </Show>
      <Show when={preferenceNotice()}>
        <p class={shared.notice} role="status">
          {preferenceNotice()}
        </p>
      </Show>
    </section>
  )
}

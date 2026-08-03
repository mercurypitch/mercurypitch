import type { Component, JSX } from 'solid-js'
import { createSignal, For, Match, onCleanup, onMount, Show, Switch, } from 'solid-js'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { X } from '@/components/icons'
import { AdminWeeklyPage } from '@/features/challenges/AdminWeeklyPage'
import { getAdminKey, listAllWeekly, setAdminKey, } from '@/features/challenges/weekly-service'
import { refreshGuidedContent } from '@/features/zen/guided-content-store'
import { useConfirm } from '@/lib/use-confirm'
import { useFocusTrap } from '@/lib/use-focus-trap'
import type { AdminContentLeaveIntent, AdminSection } from '@/stores/ui-store'
import { registerAdminContentCloseGuard } from '@/stores/ui-store'
import { AdminAscentPage } from './AdminAscentPage'
import styles from './AdminContentStudio.module.css'
import { AdminExercisesPage } from './AdminExercisesPage'

type AuthStatus = 'locked' | 'checking' | 'unlocked' | 'failed'

interface AdminContentStudioProps {
  section: AdminSection
  onNavigate: (section: AdminSection) => void
  onClose: () => boolean
}

interface SectionMeta {
  id: AdminSection
  label: string
  shortLabel: string
  description: string
}

type ContentStudioLeaveAction = AdminContentLeaveIntent | { type: 'change-key' }

const SECTIONS: readonly SectionMeta[] = [
  {
    id: 'exercises',
    label: 'Vocal Exercises',
    shortLabel: 'Exercises',
    description:
      'Author reusable pitch patterns, singing cues, guidance, and example audio.',
  },
  {
    id: 'ascent',
    label: 'The Ascent',
    shortLabel: 'Ascent',
    description:
      'Arrange published exercises into a deliberate seven-week practice journey.',
  },
  {
    id: 'weekly',
    label: 'Weekly Challenges',
    shortLabel: 'Weekly',
    description:
      'Schedule the live challenge, scoring target, and reference material.',
  },
] as const

/**
 * THESIS: one focused production room for the content that guides a singer.
 * OWN WORLD: Pitch Studio's dark instrument shell, amber action colour and
 * compact technical type, carried into a quieter editorial workspace.
 * STORY: unlock once, author an exercise, publish an immutable version, then
 * pin that exact version into The Ascent.
 * FIRST VIEWPORT: catalogue, active editor and production canvas remain
 * legible together on desktop; mobile becomes one deliberate vertical flow.
 * FORM: studio console rather than dashboard, with navigation as a permanent
 * rail and content tools treated as parts of the same instrument.
 */

export const AdminContentStudio: Component<AdminContentStudioProps> = (
  props,
) => {
  const storedKey = getAdminKey()
  const [keyInput, setKeyInput] = createSignal(storedKey)
  const [verifiedKey, setVerifiedKey] = createSignal('')
  const [authStatus, setAuthStatus] = createSignal<AuthStatus>(
    storedKey === '' ? 'locked' : 'checking',
  )
  const [authMessage, setAuthMessage] = createSignal('')
  const [contentDirty, setContentDirty] = createSignal(false)
  const discardConfirm = useConfirm()
  let authInput: HTMLInputElement | undefined
  let studio: HTMLElement | undefined
  let workspaceHeading: HTMLHeadingElement | undefined
  let authRequest = 0
  let previousBodyOverflow = ''

  const currentSection = (): SectionMeta =>
    SECTIONS.find((section) => section.id === props.section) ?? SECTIONS[0]

  const performLeave = (action: ContentStudioLeaveAction): void => {
    setContentDirty(false)
    if (action.type === 'section') {
      props.onNavigate(action.section)
      return
    }
    if (action.type === 'close') {
      props.onClose()
      return
    }
    ++authRequest
    setAdminKey('')
    setVerifiedKey('')
    setKeyInput('')
    setAuthMessage('')
    setAuthStatus('locked')
    focusAuthInput()
  }

  const requestLeave = (action: ContentStudioLeaveAction): void => {
    if (!contentDirty()) {
      performLeave(action)
      return
    }
    discardConfirm.request({
      title: 'Leave unsaved changes?',
      message:
        'This Content Studio page has unsaved changes. Discard them and continue?',
      confirmLabel: 'Discard changes',
      onConfirm: () => performLeave(action),
    })
  }

  const guardContentExit = (intent: AdminContentLeaveIntent): boolean => {
    if (!contentDirty()) return true
    requestLeave(intent)
    return false
  }

  const navigate = (section: AdminSection): void => {
    if (section === props.section) return
    requestLeave({ type: 'section', section })
  }

  const close = (): void => {
    requestLeave({ type: 'close' })
  }

  const focusAuthInput = (): void => {
    queueMicrotask(() => authInput?.focus({ preventScroll: true }))
  }

  const focusWorkspace = (): void => {
    queueMicrotask(() => workspaceHeading?.focus({ preventScroll: true }))
  }

  useFocusTrap(() => studio, {
    isOpen: () => true,
    onClose: close,
    initialFocus: () => (storedKey === '' ? authInput : studio),
  })

  const refreshRuntimeContent = (): void => {
    void refreshGuidedContent(true)
  }

  const verifyKey = async (candidate: string): Promise<void> => {
    const request = ++authRequest
    setAuthStatus('checking')
    setAuthMessage('')
    const rows = await listAllWeekly(candidate)
    if (request !== authRequest) return
    if (rows === null) {
      setAuthStatus('failed')
      setAuthMessage(
        'The key could not be verified. Check it and try again, or retry when the content API is reachable.',
      )
      focusAuthInput()
      return
    }
    setAdminKey(candidate)
    setVerifiedKey(candidate)
    setAuthStatus('unlocked')
    focusWorkspace()
  }

  const submitKey: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (event) => {
    event.preventDefault()
    const candidate = keyInput().trim()
    if (candidate === '') {
      setAuthStatus('failed')
      setAuthMessage('Enter the admin key to continue.')
      authInput?.focus()
      return
    }
    void verifyKey(candidate)
  }

  const changeKey = (): void => {
    requestLeave({ type: 'change-key' })
  }

  onMount(() => {
    const unregisterCloseGuard =
      registerAdminContentCloseGuard(guardContentExit)
    onCleanup(unregisterCloseGuard)
    const warnBeforeTabExit = (event: BeforeUnloadEvent): void => {
      if (!contentDirty()) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeTabExit)
    onCleanup(() =>
      window.removeEventListener('beforeunload', warnBeforeTabExit),
    )
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (storedKey !== '') {
      void verifyKey(storedKey)
    } else {
      focusAuthInput()
    }
  })

  onCleanup(() => {
    ++authRequest
    document.body.style.overflow = previousBodyOverflow
  })

  return (
    <div class={styles.overlay}>
      <section
        ref={studio}
        class={styles.studio}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-studio-title"
        tabindex="-1"
      >
        <header class={styles.header}>
          <div class={styles.identity}>
            <span class={styles.monogram} aria-hidden="true">
              MP
            </span>
            <div>
              <span class={styles.productName}>MercuryPitch</span>
              <h1 id="admin-studio-title">Content Studio</h1>
            </div>
          </div>
          <div class={styles.headerActions}>
            <Show when={authStatus() === 'unlocked'}>
              <span class={styles.verified}>
                <span aria-hidden="true" />
                Owner access
              </span>
              <button
                type="button"
                class={styles.mobileChangeKey}
                onClick={changeKey}
                aria-label="Change admin key"
              >
                Key
              </button>
            </Show>
            <button
              type="button"
              class={styles.closeButton}
              onClick={close}
              aria-label="Close Content Studio"
              title="Close Content Studio"
            >
              <X />
            </button>
          </div>
        </header>

        <div class={styles.body}>
          <nav class={styles.navigation} aria-label="Content Studio sections">
            <div class={styles.navHeading}>Authoring</div>
            <For each={SECTIONS}>
              {(section) => (
                <button
                  type="button"
                  class={styles.navItem}
                  classList={{
                    [styles.navItemActive]: props.section === section.id,
                  }}
                  aria-current={
                    props.section === section.id ? 'page' : undefined
                  }
                  onClick={() => navigate(section.id)}
                >
                  <span>{section.shortLabel}</span>
                  <small>{section.description}</small>
                </button>
              )}
            </For>
            <Show when={authStatus() === 'unlocked'}>
              <button
                type="button"
                class={styles.changeKey}
                onClick={changeKey}
              >
                Change admin key
              </button>
            </Show>
          </nav>

          <main class={styles.main} aria-busy={authStatus() === 'checking'}>
            <Show
              when={authStatus() === 'unlocked'}
              fallback={
                <div class={styles.authStage}>
                  <div class={styles.authPanel}>
                    <span class={styles.authLabel}>Owner access</span>
                    <h2>
                      {authStatus() === 'checking'
                        ? 'Verifying access'
                        : 'Unlock Content Studio'}
                    </h2>
                    <p>
                      {authStatus() === 'checking'
                        ? 'Checking the saved admin key before loading authoring data.'
                        : 'Enter the admin key once to use every Content Studio section.'}
                    </p>

                    <Show
                      when={authStatus() !== 'checking'}
                      fallback={
                        <div class={styles.checking} role="status">
                          <span aria-hidden="true" />
                          Verifying admin key…
                        </div>
                      }
                    >
                      <form class={styles.authForm} onSubmit={submitKey}>
                        <label for="content-studio-admin-key">Admin key</label>
                        <div class={styles.authControls}>
                          <input
                            ref={authInput}
                            id="content-studio-admin-key"
                            type="password"
                            autocomplete="current-password"
                            value={keyInput()}
                            onInput={(event) =>
                              setKeyInput(event.currentTarget.value)
                            }
                            aria-invalid={authStatus() === 'failed'}
                            aria-describedby={
                              authStatus() === 'failed'
                                ? 'content-studio-auth-error'
                                : undefined
                            }
                          />
                          <button type="submit">Unlock studio</button>
                        </div>
                        <Show when={authStatus() === 'failed'}>
                          <p
                            id="content-studio-auth-error"
                            class={styles.authError}
                            role="alert"
                          >
                            {authMessage()}
                          </p>
                        </Show>
                      </form>
                    </Show>
                  </div>
                </div>
              }
            >
              <div
                class={styles.workspace}
                classList={{
                  [styles.workspaceWide]: props.section !== 'weekly',
                }}
              >
                <div class={styles.contentHeader}>
                  <div>
                    <span class={styles.sectionLabel}>Content Studio</span>
                    <h2 ref={workspaceHeading} tabindex="-1">
                      {currentSection().label}
                    </h2>
                    <p>{currentSection().description}</p>
                  </div>
                </div>

                <Switch>
                  <Match when={props.section === 'weekly'}>
                    <AdminWeeklyPage
                      embedded
                      class={styles.weeklyAdmin}
                      adminKey={verifiedKey()}
                      onDirtyChange={setContentDirty}
                    />
                  </Match>
                  <Match when={props.section === 'ascent'}>
                    <AdminAscentPage
                      adminKey={verifiedKey()}
                      onAssignmentsChanged={refreshRuntimeContent}
                      onDirtyChange={setContentDirty}
                    />
                  </Match>
                  <Match when={props.section === 'exercises'}>
                    <AdminExercisesPage
                      adminKey={verifiedKey()}
                      onPublished={refreshRuntimeContent}
                      onDirtyChange={setContentDirty}
                    />
                  </Match>
                </Switch>
              </div>
            </Show>
          </main>
        </div>
      </section>
      <ConfirmDialog
        open={discardConfirm.pending() !== null}
        title={discardConfirm.pending()?.title ?? ''}
        message={discardConfirm.pending()?.message ?? ''}
        confirmLabel={discardConfirm.pending()?.confirmLabel}
        confirmIcon={discardConfirm.pending()?.confirmIcon}
        onConfirm={discardConfirm.accept}
        onCancel={discardConfirm.cancel}
      />
    </div>
  )
}

export default AdminContentStudio

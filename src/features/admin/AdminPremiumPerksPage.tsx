// ============================================================
// AdminPremiumPerksPage — protected art and supporter access console
// ============================================================
//
// THESIS: a premium background is not live until its exact art revision and
// audience are both visible in one owner-only console.
// OWN WORLD: the Content Studio's dark instrument shell, with art treated as
// a stage monitor and lifecycle/access controls as compact channel strips.
// STORY: inspect what is live, replace its fixed variants, ship only after
// validation, grant it to a group, then audit short-lived room passes.
// FIRST VIEWPORT: lifecycle library and selected-art monitor share the wide
// workspace; supporter access and room passes are explicit switches away.
// FORM: dense production console, preserving familiar buttons, fields and
// confirmation dialogs rather than inventing custom admin gestures.

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, Match, onCleanup, onMount, Show, Switch, } from 'solid-js'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { AlertTriangle, CheckCircle, FileUpload, Plus, RotateCcw, Trash2, UserPlus, } from '@/components/icons'
import type { BackgroundPerkId } from '@/lib/backgrounds/background-catalog'
import { useConfirm } from '@/lib/use-confirm'
import styles from './AdminPremiumPerksPage.module.css'
import type { AdminApiResult, AdminBackgroundVersion, AdminEnvironment, AdminPremiumBackground, AdminPremiumCapability, PremiumBackgroundLifecycle, PremiumBackgroundVariant, PremiumPerksSnapshot, SupporterGroup, SupporterGroupDraft, } from './premium-perks-admin-service'
import { addSupporterGroupMember, assignBackgroundToGroup, createBackgroundVersion, createSupporterGroup, loadBackgroundVariantPreview, loadPremiumPerks, PREMIUM_BACKGROUND_VARIANTS, publishBackgroundVersion, removeBackgroundFromGroup, removeBackgroundVariant, restoreBackground, retireBackground, revokePremiumBackgroundCapability, revokeSupporterGroupMember, updateSupporterGroup, uploadBackgroundVariant, } from './premium-perks-admin-service'

interface AdminPremiumPerksPageProps {
  adminKey: string
  onDirtyChange?: (dirty: boolean) => void
}

type LoadState = 'loading' | 'ready' | 'failed'
type Workspace = 'backgrounds' | 'groups' | 'passes'
type PreviewRevision = 'published' | 'draft'
type PreviewState = 'idle' | 'loading' | 'ready' | 'failed'
type PassState = 'active' | 'expired' | 'revoked'
type GroupFormMode = 'closed' | 'create' | 'edit'

interface LifecycleBand {
  id: PremiumBackgroundLifecycle
  label: string
  description: string
}

const LIFECYCLE_BANDS: readonly LifecycleBand[] = [
  {
    id: 'draft',
    label: 'Draft revisions',
    description:
      'Has a private replacement in progress; any shipped revision stays live.',
  },
  {
    id: 'published',
    label: 'Shipped',
    description: 'Available to assigned supporter groups.',
  },
  {
    id: 'retired',
    label: 'Retired',
    description: 'Kept for restoration, but unavailable for new selection.',
  },
] as const

const EMPTY_GROUP_DRAFT: SupporterGroupDraft = {
  name: '',
  description: '',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function versionByNumber(
  background: AdminPremiumBackground,
  version: number | null,
): AdminBackgroundVersion | null {
  if (version === null) return null
  return background.versions.find((item) => item.version === version) ?? null
}

function variantLabel(variant: PremiumBackgroundVariant): string {
  switch (variant) {
    case 'landscape-2k':
      return 'Landscape 2K'
    case 'landscape-4k':
      return 'Landscape 4K'
    case 'portrait-2k':
      return 'Portrait 2K'
  }
}

function environmentTone(environment: AdminEnvironment): 'prod' | 'nonprod' {
  return environment.kind === 'production' ? 'prod' : 'nonprod'
}

function lifecycleLabel(lifecycle: PremiumBackgroundLifecycle): string {
  switch (lifecycle) {
    case 'published':
      return 'Shipped'
    case 'draft':
      return 'Draft'
    case 'retired':
      return 'Retired'
  }
}

function passState(
  capability: AdminPremiumCapability,
  now = Date.now(),
): PassState {
  if (capability.revokedAt !== null) return 'revoked'
  const expiresAt = Date.parse(capability.expiresAt)
  return Number.isFinite(expiresAt) && expiresAt > now ? 'active' : 'expired'
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function AdminPremiumPerksPage(
  props: AdminPremiumPerksPageProps,
): ReturnType<Component<AdminPremiumPerksPageProps>> {
  const [state, setState] = createSignal<LoadState>('loading')
  const [snapshot, setSnapshot] = createSignal<PremiumPerksSnapshot | null>(
    null,
  )
  const [error, setError] = createSignal('')
  const [notice, setNotice] = createSignal('')
  const [workspace, setWorkspace] = createSignal<Workspace>('backgrounds')
  const [busyAction, setBusyAction] = createSignal('')
  const [selectedBackgroundId, setSelectedBackgroundId] =
    createSignal<BackgroundPerkId | null>(null)
  const [previewRevision, setPreviewRevision] =
    createSignal<PreviewRevision>('published')
  const [previewVariant, setPreviewVariant] =
    createSignal<PremiumBackgroundVariant>('landscape-2k')
  const [previewState, setPreviewState] = createSignal<PreviewState>('idle')
  const [previewSrc, setPreviewSrc] = createSignal<string | null>(null)
  const [previewError, setPreviewError] = createSignal('')
  const [uploadFiles, setUploadFiles] = createSignal<
    Partial<Record<PremiumBackgroundVariant, File>>
  >({})
  const [selectedGroupId, setSelectedGroupId] = createSignal<string | null>(
    null,
  )
  const [groupFormMode, setGroupFormMode] =
    createSignal<GroupFormMode>('closed')
  const [groupDraft, setGroupDraft] =
    createSignal<SupporterGroupDraft>(EMPTY_GROUP_DRAFT)
  const [groupFormDirty, setGroupFormDirty] = createSignal(false)
  const [memberEmail, setMemberEmail] = createSignal('')
  const [perkToAssign, setPerkToAssign] = createSignal<BackgroundPerkId | ''>(
    '',
  )
  const confirm = useConfirm()
  const [passClock, setPassClock] = createSignal(Date.now())
  let previewRequest = 0
  let previewObjectUrl: string | null = null

  const backgrounds = createMemo(() => snapshot()?.backgrounds ?? [])
  const groups = createMemo(() => snapshot()?.groups ?? [])
  const capabilities = createMemo(() => snapshot()?.capabilities ?? [])
  const orderedCapabilities = createMemo(() => {
    const now = passClock()
    return [...capabilities()].sort((left, right) => {
      const priority: Record<PassState, number> = {
        active: 0,
        expired: 1,
        revoked: 2,
      }
      const stateOrder =
        priority[passState(left, now)] - priority[passState(right, now)]
      return stateOrder === 0
        ? Date.parse(right.issuedAt) - Date.parse(left.issuedAt)
        : stateOrder
    })
  })
  const activePassCount = createMemo(() => {
    const now = passClock()
    return capabilities().filter((item) => passState(item, now) === 'active')
      .length
  })
  const endedPassCount = createMemo(
    () => capabilities().length - activePassCount(),
  )
  const selectedBackground = createMemo(
    () =>
      backgrounds().find((item) => item.id === selectedBackgroundId()) ?? null,
  )
  const selectedGroup = createMemo(
    () => groups().find((item) => item.id === selectedGroupId()) ?? null,
  )
  const publishedVersion = createMemo(() => {
    const background = selectedBackground()
    return background === null
      ? null
      : versionByNumber(background, background.publishedVersion)
  })
  const draftVersion = createMemo(() => {
    const background = selectedBackground()
    return background === null
      ? null
      : versionByNumber(background, background.draftVersion)
  })
  const previewVersion = createMemo(() =>
    previewRevision() === 'draft' ? draftVersion() : publishedVersion(),
  )
  const previewAsset = createMemo(
    () => previewVersion()?.variants[previewVariant()] ?? null,
  )
  const dirty = createMemo(
    () => groupFormDirty() || Object.keys(uploadFiles()).length > 0,
  )
  const allDraftVariantsPresent = createMemo(() => {
    const version = draftVersion()
    return (
      version !== null &&
      PREMIUM_BACKGROUND_VARIANTS.every(
        (variant) => version.variants[variant] !== undefined,
      )
    )
  })
  const assignableBackgrounds = createMemo(() => {
    const group = selectedGroup()
    if (group === null) return []
    return backgrounds().filter(
      (background) =>
        background.publishedVersion !== null &&
        background.lifecycle !== 'retired' &&
        !group.backgroundIds.includes(background.id),
    )
  })

  createEffect(() => props.onDirtyChange?.(dirty()))
  onCleanup(() => props.onDirtyChange?.(false))

  createEffect(() => {
    const background = selectedBackground()
    const revision = previewVersion()
    const variant = previewVariant()
    const asset = revision?.variants[variant]
    const adminKey = props.adminKey
    const requestId = ++previewRequest

    if (previewObjectUrl !== null) {
      URL.revokeObjectURL(previewObjectUrl)
      previewObjectUrl = null
    }
    setPreviewSrc(null)
    setPreviewError('')

    if (background === null || revision === null || asset === undefined) {
      setPreviewState('idle')
      return
    }

    setPreviewState('loading')
    void loadBackgroundVariantPreview(
      adminKey,
      background.id,
      revision.id,
      variant,
    ).then((result) => {
      if (requestId !== previewRequest) return
      if (!result.ok) {
        setPreviewState('failed')
        setPreviewError(result.error)
        return
      }

      const source = URL.createObjectURL(result.value)
      if (requestId !== previewRequest) {
        URL.revokeObjectURL(source)
        return
      }
      previewObjectUrl = source
      setPreviewSrc(source)
      setPreviewState('ready')
    })
  })

  onCleanup(() => {
    previewRequest += 1
    if (previewObjectUrl !== null) URL.revokeObjectURL(previewObjectUrl)
  })

  /* These helpers are invoked only from lifecycle hooks or DOM event
     handlers. They intentionally sample the current selection at invocation
     time instead of creating nested reactive scopes. */
  /* eslint-disable solid/reactivity */
  const selectInitialRows = (next: PremiumPerksSnapshot): void => {
    const currentBackground = selectedBackgroundId()
    const selected =
      next.backgrounds.find((item) => item.id === currentBackground) ??
      next.backgrounds[0]
    const selectionChanged = selected?.id !== currentBackground
    if (selectionChanged) {
      setSelectedBackgroundId(selected?.id ?? null)
    }
    if (
      selectionChanged ||
      selected === undefined ||
      (previewRevision() === 'draft' && selected.draftVersion === null) ||
      (previewRevision() === 'published' &&
        selected.publishedVersion === null &&
        selected.draftVersion !== null)
    ) {
      setPreviewRevision(
        selected === undefined || selected.draftVersion === null
          ? 'published'
          : 'draft',
      )
    }
    const currentGroup = selectedGroupId()
    if (
      currentGroup === null ||
      !next.groups.some((item) => item.id === currentGroup)
    ) {
      setSelectedGroupId(
        next.groups.find((group) => group.kind === 'automatic')?.id ??
          next.groups[0]?.id ??
          null,
      )
    }
  }

  const load = async (): Promise<void> => {
    setState('loading')
    setError('')
    const result = await loadPremiumPerks(props.adminKey)
    if (!result.ok) {
      setError(result.error)
      setState('failed')
      return
    }
    setSnapshot(result.value)
    selectInitialRows(result.value)
    setState('ready')
  }

  onMount(() => {
    void load()
    const passClockInterval = window.setInterval(
      () => setPassClock(Date.now()),
      30_000,
    )
    onCleanup(() => window.clearInterval(passClockInterval))
  })

  const replaceBackground = (next: AdminPremiumBackground): void => {
    setSnapshot((current) =>
      current === null
        ? current
        : {
            ...current,
            backgrounds: current.backgrounds.map((item) =>
              item.id === next.id ? next : item,
            ),
          },
    )
  }

  const replaceGroup = (next: SupporterGroup): void => {
    setSnapshot((current) =>
      current === null
        ? current
        : {
            ...current,
            groups: current.groups.map((item) =>
              item.id === next.id ? next : item,
            ),
            backgrounds: current.backgrounds.map((background) => ({
              ...background,
              assignedGroupIds: next.backgroundIds.includes(background.id)
                ? Array.from(new Set([...background.assignedGroupIds, next.id]))
                : background.assignedGroupIds.filter(
                    (groupId) => groupId !== next.id,
                  ),
            })),
          },
    )
  }

  const runBackgroundAction = async (
    action: string,
    task: () => Promise<AdminApiResult<AdminPremiumBackground>>,
    success: string,
  ): Promise<boolean> => {
    if (busyAction() !== '') return false
    setBusyAction(action)
    setError('')
    setNotice('')
    const result = await task()
    setBusyAction('')
    if (!result.ok) {
      setError(result.error)
      return false
    }
    replaceBackground(result.value)
    setNotice(success)
    return true
  }

  const runGroupAction = async (
    action: string,
    task: () => Promise<AdminApiResult<SupporterGroup>>,
    success: string,
  ): Promise<boolean> => {
    if (busyAction() !== '') return false
    setBusyAction(action)
    setError('')
    setNotice('')
    const result = await task()
    setBusyAction('')
    if (!result.ok) {
      setError(result.error)
      return false
    }
    replaceGroup(result.value)
    setNotice(success)
    return true
  }

  const performChooseBackground = (id: BackgroundPerkId): void => {
    setSelectedBackgroundId(id)
    setUploadFiles({})
    const background = backgrounds().find((item) => item.id === id)
    setPreviewRevision(
      background?.draftVersion === null ? 'published' : 'draft',
    )
    setPreviewVariant('landscape-2k')
  }

  const requestChooseBackground = (id: BackgroundPerkId): void => {
    if (id === selectedBackgroundId()) return
    if (Object.keys(uploadFiles()).length === 0) {
      performChooseBackground(id)
      return
    }
    confirm.request({
      title: 'Discard selected upload files?',
      message:
        'The files have not been uploaded. Changing backgrounds will clear them from this form.',
      confirmLabel: 'Discard files',
      onConfirm: () => performChooseBackground(id),
    })
  }

  const createRevision = async (): Promise<void> => {
    const background = selectedBackground()
    if (background === null) return
    const completed = await runBackgroundAction(
      `create:${background.id}`,
      () => createBackgroundVersion(props.adminKey, background.id),
      `Draft revision created for ${background.label}.`,
    )
    if (completed) setPreviewRevision('draft')
  }

  const chooseUpload = (
    variant: PremiumBackgroundVariant,
    file: File | undefined,
  ): void => {
    if (file === undefined) return
    if (file.type !== 'image/webp') {
      setError(`${variantLabel(variant)} must be a WebP image.`)
      return
    }
    setError('')
    setUploadFiles((current) => ({ ...current, [variant]: file }))
  }

  const uploadVariant = async (
    variant: PremiumBackgroundVariant,
  ): Promise<void> => {
    const background = selectedBackground()
    const version = draftVersion()
    const file = uploadFiles()[variant]
    if (background === null || version === null || file === undefined) return
    const completed = await runBackgroundAction(
      `upload:${variant}`,
      () =>
        uploadBackgroundVariant(
          props.adminKey,
          background.id,
          version.id,
          variant,
          file,
        ),
      `${variantLabel(variant)} uploaded to draft v${version.version}.`,
    )
    if (completed) {
      setUploadFiles((current) => {
        const next = { ...current }
        delete next[variant]
        return next
      })
      setPreviewRevision('draft')
      setPreviewVariant(variant)
    }
  }

  const requestRemoveVariant = (variant: PremiumBackgroundVariant): void => {
    const background = selectedBackground()
    const version = draftVersion()
    if (background === null || version === null) return
    confirm.request({
      title: `Remove ${variantLabel(variant)}?`,
      message:
        'The draft file will be removed. The currently shipped revision is not changed.',
      confirmLabel: 'Remove draft file',
      onConfirm: () => {
        void runBackgroundAction(
          `remove:${variant}`,
          () =>
            removeBackgroundVariant(
              props.adminKey,
              background.id,
              version.id,
              variant,
            ),
          `${variantLabel(variant)} removed from the draft.`,
        )
      },
    })
  }

  const requestPublish = (): void => {
    const background = selectedBackground()
    const version = draftVersion()
    if (background === null || version === null) return
    confirm.request({
      title: `Ship ${background.label} v${version.version}?`,
      message:
        'The server will validate every fixed WebP variant, make this revision current, and retire the previous revision. Assigned supporter groups will receive the new art.',
      confirmLabel: 'Ship revision',
      onConfirm: () => {
        void runBackgroundAction(
          `publish:${background.id}`,
          () =>
            publishBackgroundVersion(props.adminKey, background.id, version.id),
          `${background.label} v${version.version} is shipped.`,
        ).then((completed) => {
          if (completed) {
            setUploadFiles({})
            setPreviewRevision('published')
          }
        })
      },
    })
  }

  const requestRetire = (): void => {
    const background = selectedBackground()
    if (background === null) return
    confirm.request({
      title: `Retire ${background.label}?`,
      message:
        'The background will stop being offered for selection. Its revisions and group assignments remain available for restoration.',
      confirmLabel: 'Retire background',
      onConfirm: () => {
        void runBackgroundAction(
          `retire:${background.id}`,
          () => retireBackground(props.adminKey, background.id),
          `${background.label} is retired.`,
        )
      },
    })
  }

  const restore = async (): Promise<void> => {
    const background = selectedBackground()
    if (background === null) return
    await runBackgroundAction(
      `restore:${background.id}`,
      () => restoreBackground(props.adminKey, background.id),
      `${background.label} is restored.`,
    )
  }

  const openGroupForm = (mode: 'create' | 'edit'): void => {
    if (mode === 'edit') {
      const group = selectedGroup()
      if (group === null || group.kind === 'automatic') return
      setGroupDraft({ name: group.name, description: group.description })
    } else {
      setGroupDraft(EMPTY_GROUP_DRAFT)
    }
    setGroupFormMode(mode)
    setGroupFormDirty(false)
  }

  const closeGroupForm = (): void => {
    setGroupFormMode('closed')
    setGroupDraft(EMPTY_GROUP_DRAFT)
    setGroupFormDirty(false)
  }

  const selectGroup = (id: string): void => {
    const perform = (): void => {
      setSelectedGroupId(id)
      setMemberEmail('')
      setPerkToAssign('')
      closeGroupForm()
    }
    if (!groupFormDirty()) {
      perform()
      return
    }
    confirm.request({
      title: 'Discard group changes?',
      message:
        'This supporter group form has not been saved. Changing groups will discard its edits.',
      confirmLabel: 'Discard changes',
      onConfirm: perform,
    })
  }

  const editGroupDraft = (
    key: keyof SupporterGroupDraft,
    value: string,
  ): void => {
    setGroupDraft((current) => ({ ...current, [key]: value }))
    setGroupFormDirty(true)
  }

  const saveGroup = async (): Promise<void> => {
    const draft = {
      name: groupDraft().name.trim(),
      description: groupDraft().description.trim(),
    }
    if (draft.name === '') {
      setError('Give the supporter group a name.')
      return
    }
    const mode = groupFormMode()
    const group = selectedGroup()
    let result: AdminApiResult<SupporterGroup>
    setBusyAction('save-group')
    setError('')
    setNotice('')
    if (mode === 'create') {
      result = await createSupporterGroup(props.adminKey, draft)
    } else if (mode === 'edit' && group !== null) {
      result = await updateSupporterGroup(props.adminKey, group.id, draft)
    } else {
      setBusyAction('')
      return
    }
    setBusyAction('')
    if (!result.ok) {
      setError(result.error)
      return
    }
    setSnapshot((current) => {
      if (current === null) return current
      const exists = current.groups.some((item) => item.id === result.value.id)
      return {
        ...current,
        groups: exists
          ? current.groups.map((item) =>
              item.id === result.value.id ? result.value : item,
            )
          : [...current.groups, result.value],
      }
    })
    setSelectedGroupId(result.value.id)
    setNotice(mode === 'create' ? 'Supporter group created.' : 'Group updated.')
    closeGroupForm()
  }

  const addMember = async (): Promise<void> => {
    const group = selectedGroup()
    const email = memberEmail()
    if (group === null || group.kind === 'automatic' || email.trim() === '')
      return
    const completed = await runGroupAction(
      `add-member:${email}`,
      () => addSupporterGroupMember(props.adminKey, group.id, email),
      'Supporter added to the group.',
    )
    if (completed) setMemberEmail('')
  }

  const requestRevokeMember = (email: string): void => {
    const group = selectedGroup()
    if (group === null || group.kind === 'automatic') return
    confirm.request({
      title: `Revoke ${email}?`,
      message:
        'This account will immediately lose perks that are available only through this group.',
      confirmLabel: 'Revoke membership',
      onConfirm: () => {
        void runGroupAction(
          `revoke:${email}`,
          () => revokeSupporterGroupMember(props.adminKey, group.id, email),
          `${email} removed from ${group.name}.`,
        )
      },
    })
  }

  const assignPerk = async (): Promise<void> => {
    const group = selectedGroup()
    const backgroundId = perkToAssign()
    if (group === null || backgroundId === '') return
    const completed = await runGroupAction(
      `assign:${backgroundId}`,
      () => assignBackgroundToGroup(props.adminKey, group.id, backgroundId),
      'Background assigned to the supporter group.',
    )
    if (completed) setPerkToAssign('')
  }

  const requestRemovePerk = (backgroundId: BackgroundPerkId): void => {
    const group = selectedGroup()
    const background = backgrounds().find((item) => item.id === backgroundId)
    if (group === null) return
    confirm.request({
      title: `Remove ${background?.label ?? backgroundId}?`,
      message:
        'Members will immediately lose access unless another entitlement or group still grants this background.',
      confirmLabel: 'Remove perk',
      onConfirm: () => {
        void runGroupAction(
          `remove-perk:${backgroundId}`,
          () =>
            removeBackgroundFromGroup(props.adminKey, group.id, backgroundId),
          'Background removed from the supporter group.',
        )
      },
    })
  }

  const requestRevokePass = (capability: AdminPremiumCapability): void => {
    if (passState(capability, passClock()) !== 'active') return
    const background = backgrounds().find(
      (item) => item.id === capability.backgroundId,
    )
    confirm.request({
      title: `Revoke ${background?.label ?? capability.backgroundId} room pass?`,
      message: `Room ${capability.roomId} will stop receiving this protected background through this pass. This does not remove the supporter’s underlying entitlement.`,
      confirmLabel: 'Revoke room pass',
      onConfirm: () => {
        if (busyAction() !== '') return
        setBusyAction(`revoke-pass:${capability.id}`)
        setError('')
        setNotice('')
        void revokePremiumBackgroundCapability(
          props.adminKey,
          capability.id,
        ).then((result) => {
          setBusyAction('')
          if (!result.ok) {
            setError(result.error)
            return
          }
          setSnapshot((current) =>
            current === null
              ? current
              : { ...current, capabilities: result.value },
          )
          setNotice('Room pass revoked and the capability list refreshed.')
        })
      },
    })
  }

  /* eslint-enable solid/reactivity */

  return (
    <div class={styles.page} data-testid="admin-premium-perks">
      <div class={styles.consoleBar}>
        <div
          class={styles.workspaceTabs}
          role="tablist"
          aria-label="Premium perks tools"
        >
          <button
            type="button"
            id="premium-backgrounds-tab"
            role="tab"
            aria-controls="premium-backgrounds-panel"
            aria-selected={workspace() === 'backgrounds'}
            classList={{ [styles.tabActive]: workspace() === 'backgrounds' }}
            onClick={() => setWorkspace('backgrounds')}
          >
            Background library
          </button>
          <button
            type="button"
            id="premium-groups-tab"
            role="tab"
            aria-controls="premium-groups-panel"
            aria-selected={workspace() === 'groups'}
            classList={{ [styles.tabActive]: workspace() === 'groups' }}
            onClick={() => setWorkspace('groups')}
          >
            Supporter access
          </button>
          <button
            type="button"
            id="premium-passes-tab"
            role="tab"
            aria-controls="premium-passes-panel"
            aria-selected={workspace() === 'passes'}
            classList={{ [styles.tabActive]: workspace() === 'passes' }}
            onClick={() => setWorkspace('passes')}
          >
            Room passes
          </button>
        </div>
        <div class={styles.targetStrip}>
          <Show when={snapshot() !== null}>
            <span
              class={styles.environment}
              data-tone={environmentTone(snapshot()!.environment)}
              title="This is the API environment receiving every change"
            >
              {snapshot()!.environment.label}
            </span>
          </Show>
          <button
            type="button"
            class={styles.refreshButton}
            disabled={state() === 'loading' || busyAction() !== '' || dirty()}
            title={
              dirty() ? 'Upload or discard selected files first' : undefined
            }
            onClick={() => void load()}
          >
            <RotateCcw />
            Refresh
          </button>
        </div>
      </div>

      <Show when={error() !== ''}>
        <div class={styles.error} role="alert">
          <AlertTriangle />
          <span>{error()}</span>
          <button
            type="button"
            onClick={() => setError('')}
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </div>
      </Show>
      <Show when={notice() !== ''}>
        <div class={styles.success} role="status">
          <CheckCircle />
          <span>{notice()}</span>
        </div>
      </Show>

      <Switch>
        <Match when={state() === 'loading'}>
          <div class={styles.loading} role="status" aria-live="polite">
            <span />
            <div>
              <strong>Loading premium perks</strong>
              <small>
                Checking revisions, supporter groups and active room passes.
              </small>
            </div>
          </div>
        </Match>
        <Match when={state() === 'failed'}>
          <div class={styles.emptyState}>
            <AlertTriangle />
            <h3>Premium perks could not be loaded</h3>
            <p>{error()}</p>
            <button type="button" onClick={() => void load()}>
              Try again
            </button>
          </div>
        </Match>
        <Match when={state() === 'ready'}>
          <Show
            when={workspace() === 'backgrounds'}
            fallback={
              <Show
                when={workspace() === 'groups'}
                fallback={
                  <section
                    id="premium-passes-panel"
                    class={styles.passesPanel}
                    role="tabpanel"
                    aria-labelledby="premium-passes-tab"
                  >
                    <div class={styles.passesHeading}>
                      <div>
                        <span class={styles.kindBadge}>Protected delivery</span>
                        <h3>Room passes</h3>
                        <p>
                          Short-lived grants issued when a supporter shares a
                          premium background with a Jam Room. Active passes are
                          listed first; refresh reads the owner ledger again.
                        </p>
                      </div>
                      <dl class={styles.passStats}>
                        <div>
                          <dt>Active</dt>
                          <dd>{activePassCount()}</dd>
                        </div>
                        <div>
                          <dt>Ended</dt>
                          <dd>{endedPassCount()}</dd>
                        </div>
                      </dl>
                    </div>
                    <Show
                      when={orderedCapabilities().length > 0}
                      fallback={
                        <div class={styles.emptyState}>
                          <CheckCircle />
                          <h3>No room passes issued</h3>
                          <p>
                            The ledger is clear in this environment. Passes
                            appear here after a supporter shares protected art
                            with a room.
                          </p>
                        </div>
                      }
                    >
                      <div
                        class={styles.passTable}
                        role="table"
                        aria-label="Premium background room passes"
                      >
                        <div class={styles.passTableHeader} role="row">
                          <span role="columnheader">Background</span>
                          <span role="columnheader">Room and issuer</span>
                          <span role="columnheader">Timing</span>
                          <span role="columnheader">Action</span>
                        </div>
                        <For each={orderedCapabilities()}>
                          {(capability) => {
                            const status = () =>
                              passState(capability, passClock())
                            const background = backgrounds().find(
                              (item) => item.id === capability.backgroundId,
                            )
                            return (
                              <div
                                class={styles.passRow}
                                data-state={status()}
                                role="row"
                              >
                                <div class={styles.passAsset} role="cell">
                                  <span data-state={status()}>{status()}</span>
                                  <strong>
                                    {background?.label ??
                                      capability.backgroundId}
                                  </strong>
                                  <small>
                                    {capability.backgroundId} · v
                                    {capability.version}
                                  </small>
                                </div>
                                <div class={styles.passIdentity} role="cell">
                                  <strong title={capability.roomId}>
                                    {capability.roomId}
                                  </strong>
                                  <small title={capability.issuerUserId}>
                                    Issuer {capability.issuerUserId}
                                  </small>
                                </div>
                                <div class={styles.passTiming} role="cell">
                                  <span>
                                    Issued{' '}
                                    {formatTimestamp(capability.issuedAt)}
                                  </span>
                                  <span>
                                    {status() === 'revoked' &&
                                    capability.revokedAt !== null
                                      ? `Revoked ${formatTimestamp(capability.revokedAt)}`
                                      : `Expires ${formatTimestamp(capability.expiresAt)}`}
                                  </span>
                                </div>
                                <div class={styles.passAction} role="cell">
                                  <Show
                                    when={status() === 'active'}
                                    fallback={
                                      <span class={styles.passTerminal}>
                                        {status()}
                                      </span>
                                    }
                                  >
                                    <button
                                      type="button"
                                      class={styles.dangerButton}
                                      disabled={busyAction() !== ''}
                                      onClick={() =>
                                        requestRevokePass(capability)
                                      }
                                      aria-label={`Revoke ${background?.label ?? capability.backgroundId} pass for room ${capability.roomId}`}
                                    >
                                      {busyAction() ===
                                      `revoke-pass:${capability.id}`
                                        ? 'Revoking…'
                                        : 'Revoke'}
                                    </button>
                                  </Show>
                                </div>
                              </div>
                            )
                          }}
                        </For>
                      </div>
                    </Show>
                  </section>
                }
              >
                <div
                  id="premium-groups-panel"
                  class={styles.groupsLayout}
                  role="tabpanel"
                  aria-labelledby="premium-groups-tab"
                >
                  <aside class={styles.groupRail} aria-label="Supporter groups">
                    <div class={styles.railHeading}>
                      <div>
                        <strong>Access groups</strong>
                        <small>{groups().length} configured</small>
                      </div>
                      <button
                        type="button"
                        disabled={groupFormMode() !== 'closed'}
                        title={
                          groupFormMode() !== 'closed'
                            ? 'Save or cancel the open group form first'
                            : undefined
                        }
                        onClick={() => openGroupForm('create')}
                      >
                        <Plus size={15} />
                        New
                      </button>
                    </div>
                    <Show
                      when={groups().length > 0}
                      fallback={
                        <div class={styles.railEmpty}>
                          No groups were returned by this environment.
                        </div>
                      }
                    >
                      <For each={groups()}>
                        {(group) => (
                          <button
                            type="button"
                            class={styles.groupRow}
                            classList={{
                              [styles.groupRowActive]:
                                selectedGroupId() === group.id,
                            }}
                            aria-current={
                              selectedGroupId() === group.id
                                ? 'true'
                                : undefined
                            }
                            onClick={() => selectGroup(group.id)}
                          >
                            <span>
                              <strong>{group.name}</strong>
                              <small>
                                {group.kind === 'automatic'
                                  ? 'Automatic · Managed'
                                  : `Manual · ${group.memberCount} members`}
                              </small>
                            </span>
                            <b>{group.backgroundIds.length}</b>
                          </button>
                        )}
                      </For>
                    </Show>
                  </aside>

                  <section
                    class={styles.groupEditor}
                    aria-label="Selected supporter group"
                  >
                    <Show
                      when={groupFormMode() !== 'closed'}
                      fallback={
                        <Show
                          when={selectedGroup()}
                          fallback={
                            <div class={styles.emptyState}>
                              <UserPlus />
                              <h3>Create a supporter group</h3>
                              <p>
                                Manual groups let the owner grant a background
                                to a specific, normalised list of account
                                emails.
                              </p>
                              <button
                                type="button"
                                onClick={() => openGroupForm('create')}
                              >
                                New manual group
                              </button>
                            </div>
                          }
                        >
                          {(group) => (
                            <>
                              <div class={styles.groupTitle}>
                                <div>
                                  <span
                                    class={styles.kindBadge}
                                    data-kind={group().kind}
                                  >
                                    {group().kind === 'automatic'
                                      ? 'Automatic group'
                                      : 'Manual group'}
                                  </span>
                                  <h3>{group().name}</h3>
                                  <p>
                                    {group().description ||
                                      (group().kind === 'automatic'
                                        ? 'Membership follows active supporter status.'
                                        : 'No description has been added.')}
                                  </p>
                                </div>
                                <Show when={group().kind === 'manual'}>
                                  <button
                                    type="button"
                                    class={styles.secondaryButton}
                                    onClick={() => openGroupForm('edit')}
                                  >
                                    Edit group
                                  </button>
                                </Show>
                              </div>

                              <section class={styles.accessSection}>
                                <div class={styles.sectionHeading}>
                                  <div>
                                    <h4>Background access</h4>
                                    <p>
                                      Shipped art this group can select in the
                                      app.
                                    </p>
                                  </div>
                                </div>
                                <div class={styles.perkList}>
                                  <For each={group().backgroundIds}>
                                    {(backgroundId) => {
                                      const background = () =>
                                        backgrounds().find(
                                          (item) => item.id === backgroundId,
                                        )
                                      return (
                                        <div class={styles.perkRow}>
                                          <span>
                                            <strong>
                                              {background()?.label ??
                                                backgroundId}
                                            </strong>
                                            <small>
                                              {background()?.surface ??
                                                'unknown'}{' '}
                                              ·{' '}
                                              {background() === undefined
                                                ? 'Unavailable'
                                                : lifecycleLabel(
                                                    background()!.lifecycle,
                                                  )}
                                            </small>
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              requestRemovePerk(backgroundId)
                                            }
                                            aria-label={`Remove ${background()?.label ?? backgroundId} from ${group().name}`}
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      )
                                    }}
                                  </For>
                                  <Show
                                    when={group().backgroundIds.length === 0}
                                  >
                                    <p class={styles.inlineEmpty}>
                                      No backgrounds assigned yet. Shipped
                                      backgrounds can be added below.
                                    </p>
                                  </Show>
                                </div>
                                <div class={styles.inlineAction}>
                                  <select
                                    aria-label="Shipped background"
                                    value={perkToAssign()}
                                    disabled={
                                      assignableBackgrounds().length === 0
                                    }
                                    onChange={(event) =>
                                      setPerkToAssign(
                                        event.currentTarget.value as
                                          | BackgroundPerkId
                                          | '',
                                      )
                                    }
                                  >
                                    <option value="">
                                      {assignableBackgrounds().length === 0
                                        ? 'No unassigned shipped backgrounds'
                                        : 'Choose a shipped background'}
                                    </option>
                                    <For each={assignableBackgrounds()}>
                                      {(background) => (
                                        <option value={background.id}>
                                          {background.label}
                                        </option>
                                      )}
                                    </For>
                                  </select>
                                  <button
                                    type="button"
                                    disabled={
                                      perkToAssign() === '' ||
                                      busyAction() !== ''
                                    }
                                    onClick={() => void assignPerk()}
                                  >
                                    Assign
                                  </button>
                                </div>
                              </section>

                              <section class={styles.accessSection}>
                                <div class={styles.sectionHeading}>
                                  <div>
                                    <h4>Members</h4>
                                    <p>
                                      {group().kind === 'automatic'
                                        ? 'Resolved automatically from active supporter status; manual membership is disabled.'
                                        : 'Account emails are stored and matched in normalised lowercase form.'}
                                    </p>
                                  </div>
                                  <span>
                                    {group().kind === 'automatic'
                                      ? 'Managed'
                                      : group().memberCount}
                                  </span>
                                </div>
                                <Show
                                  when={group().kind === 'manual'}
                                  fallback={
                                    <div class={styles.automaticNote}>
                                      The billing entitlement is the source of
                                      truth for this group. There is no manual
                                      member list to drift.
                                    </div>
                                  }
                                >
                                  <form
                                    class={styles.inlineAction}
                                    onSubmit={(event) => {
                                      event.preventDefault()
                                      void addMember()
                                    }}
                                  >
                                    <input
                                      type="email"
                                      autocomplete="off"
                                      aria-label="Supporter account email"
                                      placeholder="supporter@example.com"
                                      value={memberEmail()}
                                      onInput={(event) =>
                                        setMemberEmail(
                                          event.currentTarget.value,
                                        )
                                      }
                                    />
                                    <button
                                      type="submit"
                                      disabled={
                                        memberEmail().trim() === '' ||
                                        busyAction() !== ''
                                      }
                                    >
                                      Add member
                                    </button>
                                  </form>
                                  <div class={styles.memberList}>
                                    <For each={group().members}>
                                      {(member) => (
                                        <div class={styles.memberRow}>
                                          <span>{member.email}</span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              requestRevokeMember(member.email)
                                            }
                                            aria-label={`Revoke ${member.email}`}
                                          >
                                            Revoke
                                          </button>
                                        </div>
                                      )}
                                    </For>
                                    <Show when={group().members.length === 0}>
                                      <p class={styles.inlineEmpty}>
                                        No manual members in this group.
                                      </p>
                                    </Show>
                                  </div>
                                </Show>
                              </section>
                            </>
                          )}
                        </Show>
                      }
                    >
                      <form
                        class={styles.groupForm}
                        onSubmit={(event) => {
                          event.preventDefault()
                          void saveGroup()
                        }}
                      >
                        <span class={styles.kindBadge}>Manual group</span>
                        <h3>
                          {groupFormMode() === 'create'
                            ? 'New supporter group'
                            : 'Edit supporter group'}
                        </h3>
                        <label>
                          <span>Name</span>
                          <input
                            type="text"
                            value={groupDraft().name}
                            placeholder="Launch patrons"
                            onInput={(event) =>
                              editGroupDraft('name', event.currentTarget.value)
                            }
                          />
                        </label>
                        <label>
                          <span>Description</span>
                          <textarea
                            rows="3"
                            value={groupDraft().description}
                            placeholder="Who this group is for and why it exists."
                            onInput={(event) =>
                              editGroupDraft(
                                'description',
                                event.currentTarget.value,
                              )
                            }
                          />
                        </label>
                        <div class={styles.formActions}>
                          <button
                            type="button"
                            class={styles.secondaryButton}
                            onClick={closeGroupForm}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            class={styles.primaryButton}
                            disabled={
                              busyAction() !== '' ||
                              groupDraft().name.trim() === ''
                            }
                          >
                            {busyAction() === 'save-group'
                              ? 'Saving…'
                              : groupFormMode() === 'create'
                                ? 'Create group'
                                : 'Save changes'}
                          </button>
                        </div>
                      </form>
                    </Show>
                  </section>
                </div>
              </Show>
            }
          >
            <div
              id="premium-backgrounds-panel"
              class={styles.backgroundLayout}
              role="tabpanel"
              aria-labelledby="premium-backgrounds-tab"
            >
              <section
                class={styles.library}
                aria-label="Background lifecycle library"
              >
                <Show
                  when={backgrounds().length > 0}
                  fallback={
                    <div class={styles.emptyState}>
                      <FileUpload />
                      <h3>No background records</h3>
                      <p>
                        This environment has not returned any allowlisted
                        premium background records.
                      </p>
                    </div>
                  }
                >
                  <For each={LIFECYCLE_BANDS}>
                    {(band) => {
                      const rows = () =>
                        backgrounds().filter(
                          (item) => item.lifecycle === band.id,
                        )
                      return (
                        <section class={styles.lifecycleBand}>
                          <div class={styles.bandHeading}>
                            <div>
                              <h3>{band.label}</h3>
                              <p>{band.description}</p>
                            </div>
                            <span>{rows().length}</span>
                          </div>
                          <Show
                            when={rows().length > 0}
                            fallback={
                              <p class={styles.bandEmpty}>
                                Nothing in this lifecycle.
                              </p>
                            }
                          >
                            <ul class={styles.backgroundList}>
                              <For each={rows()}>
                                {(background) => (
                                  <li>
                                    <button
                                      type="button"
                                      class={styles.backgroundRow}
                                      classList={{
                                        [styles.backgroundRowActive]:
                                          selectedBackgroundId() ===
                                          background.id,
                                      }}
                                      aria-current={
                                        selectedBackgroundId() === background.id
                                          ? 'true'
                                          : undefined
                                      }
                                      onClick={() =>
                                        requestChooseBackground(background.id)
                                      }
                                    >
                                      <span class={styles.rowPreview}>
                                        <span aria-hidden="true">MP</span>
                                      </span>
                                      <span class={styles.rowCopy}>
                                        <strong>{background.label}</strong>
                                        <small>
                                          {background.surface} ·{' '}
                                          {background.edition}
                                        </small>
                                      </span>
                                      <span class={styles.rowVersions}>
                                        <b>
                                          {background.publishedVersion === null
                                            ? 'Not shipped'
                                            : `Shipped v${background.publishedVersion}`}
                                        </b>
                                        <small>
                                          {background.draftVersion === null
                                            ? `${background.assignedGroupIds.length} groups`
                                            : `Draft v${background.draftVersion}`}
                                        </small>
                                      </span>
                                    </button>
                                  </li>
                                )}
                              </For>
                            </ul>
                          </Show>
                        </section>
                      )
                    }}
                  </For>
                </Show>
              </section>

              <aside
                class={styles.inspector}
                aria-label="Selected background editor"
              >
                <Show
                  when={selectedBackground()}
                  fallback={
                    <div class={styles.emptyState}>
                      <FileUpload />
                      <h3>Select a background</h3>
                      <p>
                        Choose one from the lifecycle library to inspect its
                        revisions.
                      </p>
                    </div>
                  }
                >
                  {(background) => (
                    <>
                      <div class={styles.inspectorHeading}>
                        <div>
                          <span
                            class={styles.lifecycle}
                            data-lifecycle={background().lifecycle}
                          >
                            {lifecycleLabel(background().lifecycle)}
                          </span>
                          <h3>{background().label}</h3>
                          <p>
                            {background().surface} · {background().edition}
                          </p>
                        </div>
                        <div class={styles.headingActions}>
                          <Show when={background().lifecycle === 'retired'}>
                            <button
                              type="button"
                              class={styles.secondaryButton}
                              disabled={busyAction() !== '' || dirty()}
                              title={
                                dirty()
                                  ? 'Upload or discard selected files first'
                                  : undefined
                              }
                              onClick={() => void restore()}
                            >
                              Restore
                            </button>
                          </Show>
                          <Show when={background().lifecycle !== 'retired'}>
                            <button
                              type="button"
                              class={styles.dangerButton}
                              disabled={busyAction() !== '' || dirty()}
                              title={
                                dirty()
                                  ? 'Upload or discard selected files first'
                                  : undefined
                              }
                              onClick={requestRetire}
                            >
                              Retire
                            </button>
                          </Show>
                        </div>
                      </div>

                      <div class={styles.monitor}>
                        <div class={styles.monitorBar}>
                          <div class={styles.revisionToggle}>
                            <button
                              type="button"
                              classList={{
                                [styles.toggleActive]:
                                  previewRevision() === 'published',
                              }}
                              disabled={publishedVersion() === null}
                              onClick={() => setPreviewRevision('published')}
                            >
                              Current
                            </button>
                            <button
                              type="button"
                              classList={{
                                [styles.toggleActive]:
                                  previewRevision() === 'draft',
                              }}
                              disabled={draftVersion() === null}
                              onClick={() => setPreviewRevision('draft')}
                            >
                              Draft
                            </button>
                          </div>
                          <select
                            aria-label="Preview variant"
                            value={previewVariant()}
                            onChange={(event) =>
                              setPreviewVariant(
                                event.currentTarget
                                  .value as PremiumBackgroundVariant,
                              )
                            }
                          >
                            <For each={PREMIUM_BACKGROUND_VARIANTS}>
                              {(variant) => (
                                <option value={variant}>
                                  {variantLabel(variant)}
                                </option>
                              )}
                            </For>
                          </select>
                        </div>
                        <div
                          class={styles.monitorImage}
                          data-orientation={
                            previewVariant() === 'portrait-2k'
                              ? 'portrait'
                              : 'landscape'
                          }
                        >
                          <Show when={previewSrc()}>
                            {(source) => (
                              <img
                                src={source()}
                                alt={`${background().label} ${variantLabel(previewVariant())}`}
                              />
                            )}
                          </Show>
                          <Show when={previewSrc() === null}>
                            <div
                              class={styles.noPreview}
                              role={
                                previewState() === 'failed' ? 'alert' : 'status'
                              }
                            >
                              <FileUpload />
                              <strong>
                                {previewState() === 'loading'
                                  ? `Loading ${variantLabel(previewVariant())}`
                                  : previewState() === 'failed'
                                    ? 'Preview unavailable'
                                    : `No ${variantLabel(previewVariant())} preview`}
                              </strong>
                              <small>
                                {previewState() === 'failed'
                                  ? previewError()
                                  : previewVersion() === null
                                    ? `There is no ${previewRevision()} revision.`
                                    : previewAsset() === null
                                      ? 'This variant has not been uploaded.'
                                      : 'Fetching the protected art from this environment.'}
                              </small>
                            </div>
                          </Show>
                        </div>
                        <Show when={previewAsset()}>
                          {(asset) => (
                            <div class={styles.assetMeta}>
                              <span>{formatBytes(asset().bytes)}</span>
                              <Show
                                when={
                                  asset().width !== undefined &&
                                  asset().height !== undefined
                                }
                              >
                                <span>
                                  {asset().width} × {asset().height}
                                </span>
                              </Show>
                              <span>v{previewVersion()!.version}</span>
                            </div>
                          )}
                        </Show>
                      </div>

                      <Show
                        when={draftVersion()}
                        fallback={
                          <div class={styles.revisionStart}>
                            <div>
                              <strong>No replacement in progress</strong>
                              <p>
                                Start a private revision, upload its fixed WebP
                                variants, then validate and ship it together.
                              </p>
                            </div>
                            <button
                              type="button"
                              class={styles.primaryButton}
                              disabled={busyAction() !== ''}
                              onClick={() => void createRevision()}
                            >
                              <Plus size={15} />
                              Create replacement
                            </button>
                          </div>
                        }
                      >
                        {(version) => (
                          <section class={styles.variantEditor}>
                            <div class={styles.sectionHeading}>
                              <div>
                                <h4>Draft v{version().version}</h4>
                                <p>
                                  Each slot accepts one WebP file. Uploading
                                  replaces only that draft slot.
                                </p>
                              </div>
                              <span>
                                {
                                  PREMIUM_BACKGROUND_VARIANTS.filter(
                                    (variant) =>
                                      version().variants[variant] !== undefined,
                                  ).length
                                }
                                /{PREMIUM_BACKGROUND_VARIANTS.length}
                              </span>
                            </div>
                            <div class={styles.variantList}>
                              <For each={PREMIUM_BACKGROUND_VARIANTS}>
                                {(variant) => {
                                  const uploaded = () =>
                                    version().variants[variant]
                                  const selected = () => uploadFiles()[variant]
                                  return (
                                    <div class={styles.variantRow}>
                                      <div class={styles.variantName}>
                                        <Show
                                          when={uploaded()}
                                          fallback={
                                            <span class={styles.missingDot} />
                                          }
                                        >
                                          <CheckCircle />
                                        </Show>
                                        <span>
                                          <strong>
                                            {variantLabel(variant)}
                                          </strong>
                                          <small>
                                            {selected()?.name ??
                                              (uploaded() === undefined
                                                ? 'Missing'
                                                : `${formatBytes(uploaded()!.bytes)} uploaded`)}
                                          </small>
                                        </span>
                                      </div>
                                      <div class={styles.variantActions}>
                                        <label class={styles.fileButton}>
                                          <input
                                            type="file"
                                            accept="image/webp,.webp"
                                            onChange={(event) =>
                                              chooseUpload(
                                                variant,
                                                event.currentTarget.files?.[0],
                                              )
                                            }
                                          />
                                          Choose WebP
                                        </label>
                                        <button
                                          type="button"
                                          class={styles.secondaryButton}
                                          disabled={
                                            selected() === undefined ||
                                            busyAction() !== ''
                                          }
                                          onClick={() =>
                                            void uploadVariant(variant)
                                          }
                                        >
                                          {busyAction() === `upload:${variant}`
                                            ? 'Uploading…'
                                            : 'Upload'}
                                        </button>
                                        <Show when={uploaded() !== undefined}>
                                          <button
                                            type="button"
                                            class={styles.iconDanger}
                                            disabled={busyAction() !== ''}
                                            onClick={() =>
                                              requestRemoveVariant(variant)
                                            }
                                            aria-label={`Remove ${variantLabel(variant)} from draft`}
                                          >
                                            <Trash2 />
                                          </button>
                                        </Show>
                                      </div>
                                    </div>
                                  )
                                }}
                              </For>
                            </div>
                            <div class={styles.publishBar}>
                              <div>
                                <strong>
                                  {allDraftVariantsPresent()
                                    ? 'Fixed variant set complete'
                                    : 'Complete all three fixed variants'}
                                </strong>
                                <small>
                                  The Worker performs the final image and
                                  lifecycle validation.
                                </small>
                              </div>
                              <button
                                type="button"
                                class={styles.primaryButton}
                                disabled={
                                  !allDraftVariantsPresent() ||
                                  busyAction() !== '' ||
                                  dirty()
                                }
                                title={
                                  dirty()
                                    ? 'Upload or discard selected files first'
                                    : undefined
                                }
                                onClick={requestPublish}
                              >
                                Validate and ship
                              </button>
                            </div>
                          </section>
                        )}
                      </Show>
                    </>
                  )}
                </Show>
              </aside>
            </div>
          </Show>
        </Match>
      </Switch>

      <ConfirmDialog
        open={confirm.pending() !== null}
        title={confirm.pending()?.title ?? ''}
        message={confirm.pending()?.message ?? ''}
        confirmLabel={confirm.pending()?.confirmLabel}
        confirmIcon={confirm.pending()?.confirmIcon}
        onConfirm={confirm.accept}
        onCancel={confirm.cancel}
      />
    </div>
  )
}

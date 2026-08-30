// ============================================================
// Drum Project Library host — lazy controller-to-ledger projection
// ============================================================
//
// Keeping this display projection beside the lazy ledger prevents project
// catalog and failure-copy machinery from joining Drum Night's first paint.

import type { JSX } from 'solid-js'
import { createMemo } from 'solid-js'
import type { FirstPocketVariantId } from '../session'
import { FIRST_POCKET_VARIANTS } from '../session'
import type { DrumProjectLibraryProps, DrumProjectLibraryView, DrumProjectOperationAction, } from './drum-persistence-ui'
import type { DrumProjectController } from './drum-project-controller'
import { DrumProjectLibrary } from './DrumProjectLibrary'

export interface DrumProjectLibraryHostProps extends Omit<
  DrumProjectLibraryProps,
  'view'
> {
  readonly controller: DrumProjectController | null
  readonly selectedVariantId: FirstPocketVariantId
  readonly unsavedDirty: boolean
  readonly savePromptOpen: boolean
}

function variantLabel(variantId: FirstPocketVariantId): string {
  return (
    FIRST_POCKET_VARIANTS.find((variant) => variant.id === variantId)?.label ??
    'First Pocket'
  )
}

function failureCopy(code: string | undefined): string {
  if (code === 'project-limit') {
    return 'This device already has the maximum of 32 drum projects.'
  }
  if (code === 'quota-exceeded') {
    return 'This device does not have enough local space for that project.'
  }
  if (code === 'conflict') {
    return 'The saved project changed elsewhere. Reopen it before saving again.'
  }
  if (code === 'not-found') return 'That saved project is no longer available.'
  if (code === 'invalid-project' || code === 'apply-rejected') {
    return 'That project could not be validated, so the live groove was left unchanged.'
  }
  return 'Local drum projects are unavailable. The live groove is still here.'
}

function operationAction(value: string): DrumProjectOperationAction {
  if (value === 'opening' || value === 'open') return 'open'
  if (value === 'renaming' || value === 'rename') return 'rename'
  if (value === 'deleting' || value === 'delete') return 'delete'
  if (value === 'reverting' || value === 'revert') return 'revert'
  if (value === 'erasing' || value === 'erase') return 'erase'
  return 'save'
}

export function DrumProjectLibraryHost(
  props: DrumProjectLibraryHostProps,
): JSX.Element {
  const view = createMemo<DrumProjectLibraryView>(() => {
    const controller = props.controller
    const current = controller?.currentProject() ?? null
    const libraryState = controller?.libraryState() ?? 'idle'
    const library: DrumProjectLibraryView['library'] =
      libraryState === 'ready'
        ? {
            kind: 'ready',
            projects: (controller?.projects() ?? []).map((project) => {
              const groove = project.variants[project.selectedVariantId]
              return {
                id: project.id,
                name: project.title,
                variationLabel: variantLabel(project.selectedVariantId),
                barCount: groove.barCount,
                hitCount: groove.hits.length,
                tempoBpm: project.tempoBpm,
                editedAt: Date.parse(project.updatedAt),
                onStage: current?.id === project.id,
              }
            }),
            skippedCount: controller?.skippedRecords() ?? 0,
            futureCount: controller?.futureRecords() ?? 0,
          }
        : libraryState === 'error'
          ? {
              kind: 'error',
              message: failureCopy(controller?.failure()?.code),
            }
          : { kind: libraryState }

    const operation = controller?.operation() ?? 'idle'
    const saveState = controller?.saveState() ?? 'idle'
    const failure = controller?.failure() ?? null
    let operationView: DrumProjectLibraryView['operation'] = { kind: 'idle' }
    if (operation !== 'idle' || saveState === 'saving') {
      operationView = {
        kind: 'pending',
        action: operationAction(operation),
      }
    } else if (
      failure !== null &&
      failure.action !== 'initialize' &&
      failure.action !== 'list'
    ) {
      operationView = {
        kind: 'error',
        action: operationAction(failure.action),
        message: failureCopy(failure.code),
      }
    }

    return {
      library,
      current: {
        id: current?.id ?? null,
        name: current?.title ?? '',
        suggestedName: `${variantLabel(props.selectedVariantId)} Pocket`,
        dirty: current === null ? props.unsavedDirty : controller!.dirty(),
        persisted: current !== null,
      },
      savePromptOpen: props.savePromptOpen,
      operation: operationView,
    }
  })

  return (
    <DrumProjectLibrary
      view={view()}
      onBack={props.onBack}
      onLoad={props.onLoad}
      onRetry={props.onRetry}
      onSaveCurrent={props.onSaveCurrent}
      onRetrySave={props.onRetrySave}
      onRevertCurrent={props.onRevertCurrent}
      onCancelSavePrompt={props.onCancelSavePrompt}
      onOpenProject={props.onOpenProject}
      onSaveCurrentThenOpen={props.onSaveCurrentThenOpen}
      onDiscardCurrentThenOpen={props.onDiscardCurrentThenOpen}
      onRenameProject={props.onRenameProject}
      onDeleteProject={props.onDeleteProject}
      onEraseAll={props.onEraseAll}
    />
  )
}

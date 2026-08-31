// ============================================================
// Drum Groove Editor — compact exact-articulation pattern editing
// ============================================================
//
// The grid renders one bar or a smaller slice at a time. Pointer movement is
// previewed locally and committed once on release so reactive document updates
// cannot interrupt an in-flight gesture.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { ESSENTIAL_DRUM_PADS } from '@/features/drum-night/runtime/drum-pad-layout'
import { drumScoreVoiceForGmKey } from '@/features/drum-night/session/drum-score'
import { FIRST_POCKET_VARIANTS } from '@/features/drum-night/session/prepared-grooves'
import { generalMidiPercussionName } from '@/lib/percussion'
import type { DrumGrooveDraftController, DrumGroovePageSize, } from './drum-groove-draft-controller'
import styles from './DrumGrooveEditor.module.css'
import type { EditableDrumGrooveHit } from './groove-editor'
import { activeDrumGrooveHits, DRUM_GROOVE_FAMILIES, DRUM_GROOVE_STEPS_PER_BAR, } from './groove-editor'

export interface DrumGrooveEditorProps {
  readonly controller: DrumGrooveDraftController
  readonly visibleStepCount?: DrumGroovePageSize
  readonly disabled?: boolean
  readonly label?: string
  /** Host-owned save/project identity; the editor never crosses storage. */
  readonly projectControls?: JSX.Element
}

interface GrooveCellModel {
  readonly hit: EditableDrumGrooveHit | null
  readonly hitCount: number
  readonly preview: boolean
  readonly previewValid: boolean
}

const SWING_PRESETS = [
  { label: 'Straight', amount: 0 },
  { label: 'Soft', amount: 0.5 },
  { label: 'Triplet', amount: 1 },
] as const

const DENSITY_PRESETS = [
  { label: 'Essential', amount: 0.55 },
  { label: 'Balanced', amount: 0.78 },
  { label: 'All hits', amount: 1 },
] as const

const STEP_SYLLABLES = ['', 'e', 'and', 'a'] as const

const FAMILY_ORDER = new Map(
  DRUM_GROOVE_FAMILIES.map((family) => [family.id, family.order]),
)
const FAMILY_LABEL = new Map(
  DRUM_GROOVE_FAMILIES.map((family) => [family.id, family.label]),
)

function familyForGmKey(gmKey: number) {
  return drumScoreVoiceForGmKey(gmKey).family
}

function barAndBeatLabel(stepIndex: number): string {
  const bar = Math.floor(stepIndex / DRUM_GROOVE_STEPS_PER_BAR) + 1
  const stepInBar = stepIndex % DRUM_GROOVE_STEPS_PER_BAR
  const beat = Math.floor(stepInBar / 4) + 1
  const syllable = STEP_SYLLABLES[stepInBar % 4]
  return `bar ${bar}, beat ${beat}${syllable === '' ? '' : ` ${syllable}`}`
}

function shortStepLabel(stepIndex: number): string {
  const stepInBar = stepIndex % DRUM_GROOVE_STEPS_PER_BAR
  const beat = Math.floor(stepInBar / 4) + 1
  const syllable = STEP_SYLLABLES[stepInBar % 4]
  return syllable === '' ? String(beat) : syllable === 'and' ? '&' : syllable
}

function recommendedPageSize(width: number): DrumGroovePageSize {
  if (width >= 860) return 16
  if (width >= 470) return 8
  return 4
}

export function DrumGrooveEditor(props: DrumGrooveEditorProps): JSX.Element {
  let rootElement: HTMLElement | undefined
  let activePointerId: number | null = null
  let activePointerElement: HTMLButtonElement | null = null
  let activeCellRail: HTMLElement | null = null
  let dragOriginCellKey: string | null = null
  let suppressClickCellKey: string | null = null
  const cellRefs = new Map<string, HTMLButtonElement>()
  const [focusedCellKey, setFocusedCellKey] = createSignal<string | null>(null)

  const allHits = createMemo(() => props.controller.state().hits)
  const sourceHits = createMemo(() => props.controller.state().sourceHits)
  const activeHitIds = createMemo(
    () =>
      new Set(
        activeDrumGrooveHits(props.controller.state()).map((hit) => hit.id),
      ),
  )
  const rowKeys = createMemo(() => {
    const keys = new Set([
      ...ESSENTIAL_DRUM_PADS.map((pad) => pad.gmKey),
      ...sourceHits().map((hit) => hit.gmKey),
      ...allHits().map((hit) => hit.gmKey),
    ])
    return [...keys].sort((left, right) => {
      const leftFamily = familyForGmKey(left)
      const rightFamily = familyForGmKey(right)
      return (
        (FAMILY_ORDER.get(leftFamily) ?? 99) -
          (FAMILY_ORDER.get(rightFamily) ?? 99) || left - right
      )
    })
  })
  const visibleSteps = createMemo(() => {
    const start = props.controller.pageStartStep()
    const end = Math.min(
      props.controller.state().stepCount,
      start + props.controller.pageSize(),
    )
    return Array.from({ length: end - start }, (_, index) => start + index)
  })
  const pageLabel = createMemo(() => {
    const first = visibleSteps()[0] ?? 0
    const last = visibleSteps().at(-1) ?? first
    const bar = Math.floor(first / DRUM_GROOVE_STEPS_PER_BAR) + 1
    if (props.controller.pageSize() === DRUM_GROOVE_STEPS_PER_BAR) {
      return `Bar ${bar}`
    }
    const firstBeat = Math.floor((first % DRUM_GROOVE_STEPS_PER_BAR) / 4) + 1
    const lastBeat = Math.floor((last % DRUM_GROOVE_STEPS_PER_BAR) / 4) + 1
    return firstBeat === lastBeat
      ? `Bar ${bar} · beat ${firstBeat}`
      : `Bar ${bar} · beats ${firstBeat}–${lastBeat}`
  })
  const selectedPosition = createMemo(() => {
    const hit = props.controller.selectedHit()
    return hit === null ? null : barAndBeatLabel(hit.stepIndex)
  })
  const soundingHitCount = createMemo(
    () => activeDrumGrooveHits(props.controller.state()).length,
  )

  createEffect(() => {
    const suppliedPageSize = props.visibleStepCount
    if (suppliedPageSize !== undefined) {
      untrack(() => props.controller.setPageSize(suppliedPageSize))
    }
  })

  createEffect(() => {
    const rows = rowKeys()
    const steps = visibleSteps()
    const current = focusedCellKey()
    if (rows.length === 0 || steps.length === 0) {
      if (current !== null) setFocusedCellKey(null)
      return
    }
    const validKeys = new Set(
      rows.flatMap((gmKey) =>
        steps.map((stepIndex) => `${gmKey}:${stepIndex}`),
      ),
    )
    if (current === null || !validKeys.has(current)) {
      setFocusedCellKey(`${rows[0]}:${steps[0]}`)
    }
  })

  onMount(() => {
    if (props.visibleStepCount !== undefined) return

    const updateFromWidth = (width: number) => {
      const fallbackWidth = window.innerWidth
      props.controller.setPageSize(
        recommendedPageSize(width > 0 ? width : fallbackWidth),
      )
    }
    updateFromWidth(rootElement?.getBoundingClientRect().width ?? 0)

    if (typeof ResizeObserver !== 'undefined' && rootElement !== undefined) {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (entry !== undefined) updateFromWidth(entry.contentRect.width)
      })
      observer.observe(rootElement)
      onCleanup(() => observer.disconnect())
      return
    }

    const handleResize = () =>
      updateFromWidth(rootElement?.getBoundingClientRect().width ?? 0)
    window.addEventListener('resize', handleResize)
    onCleanup(() => window.removeEventListener('resize', handleResize))
  })

  onCleanup(() => props.controller.cancelMovePreview())

  function cellModel(gmKey: number, stepIndex: number): GrooveCellModel {
    const hits = allHits().filter(
      (hit) => hit.gmKey === gmKey && hit.stepIndex === stepIndex,
    )
    const preview = props.controller.movePreview()
    if (preview === null) {
      return {
        hit: hits[0] ?? null,
        hitCount: hits.length,
        preview: false,
        previewValid: true,
      }
    }
    const previewHit = allHits().find((hit) => hit.id === preview.hitId)
    if (previewHit === undefined || previewHit.gmKey !== gmKey) {
      return {
        hit: hits[0] ?? null,
        hitCount: hits.length,
        preview: false,
        previewValid: true,
      }
    }
    const withoutDraggedHit = hits.filter((hit) => hit.id !== preview.hitId)
    if (stepIndex === preview.stepIndex) {
      return {
        hit: previewHit,
        hitCount: withoutDraggedHit.length + 1,
        preview: preview.stepIndex !== preview.fromStepIndex,
        previewValid: preview.valid,
      }
    }
    return {
      hit: withoutDraggedHit[0] ?? null,
      hitCount: withoutDraggedHit.length,
      preview: false,
      previewValid: true,
    }
  }

  function cellLabel(gmKey: number, stepIndex: number): string {
    const model = cellModel(gmKey, stepIndex)
    const articulation = generalMidiPercussionName(gmKey)
    const position = barAndBeatLabel(stepIndex)
    if (model.hit === null) return `Add ${articulation} at ${position}`
    const selected = props.controller.selectedHitId() === model.hit.id
    const sounding = activeHitIds().has(model.hit.id)
    return [
      articulation,
      `at ${position}`,
      `velocity ${model.hit.velocity}`,
      sounding ? 'sounding' : 'temporarily omitted by density',
      selected ? 'selected' : 'select',
    ].join(', ')
  }

  function activateCell(gmKey: number, stepIndex: number): void {
    if (props.disabled === true) return
    const cellKey = `${gmKey}:${stepIndex}`
    if (suppressClickCellKey === cellKey) {
      suppressClickCellKey = null
      return
    }
    const hit = cellModel(gmKey, stepIndex).hit
    if (hit === null) {
      props.controller.addHit(gmKey, stepIndex)
      return
    }
    props.controller.selectHit(hit.id)
  }

  function releasePointerCapture(): void {
    const pointerId = activePointerId
    const element = activePointerElement
    activePointerId = null
    activePointerElement = null
    activeCellRail = null
    dragOriginCellKey = null
    if (
      pointerId !== null &&
      element !== null &&
      typeof element.releasePointerCapture === 'function'
    ) {
      try {
        element.releasePointerCapture(pointerId)
      } catch {
        // The browser can release capture before our pointer-up handler.
      }
    }
  }

  function targetStepForPointer(clientX: number): number | null {
    const rail = activeCellRail
    const steps = visibleSteps()
    if (rail === null || steps.length === 0) return null
    const bounds = rail.getBoundingClientRect()
    if (bounds.width <= 0) return null
    const normalized = Math.min(
      0.999_999,
      Math.max(0, (clientX - bounds.left) / bounds.width),
    )
    return steps[Math.floor(normalized * steps.length)] ?? null
  }

  function handlePointerDown(
    event: PointerEvent & { currentTarget: HTMLButtonElement },
    hit: EditableDrumGrooveHit,
    gmKey: number,
    stepIndex: number,
  ): void {
    if (props.disabled === true || event.button !== 0) return
    const rail = event.currentTarget.closest<HTMLElement>('[data-cell-rail]')
    if (rail === null || !props.controller.beginMovePreview(hit.id)) return
    activePointerId = event.pointerId
    activePointerElement = event.currentTarget
    activeCellRail = rail
    dragOriginCellKey = `${gmKey}:${stepIndex}`
    event.currentTarget.focus()
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Pointer capture is unavailable in a few embedded browsers.
      }
    }
    event.preventDefault()
  }

  function handlePointerMove(event: PointerEvent): void {
    if (event.pointerId !== activePointerId) return
    const targetStep = targetStepForPointer(event.clientX)
    if (targetStep !== null) props.controller.updateMovePreview(targetStep)
  }

  function handlePointerUp(event: PointerEvent): void {
    if (event.pointerId !== activePointerId) return
    const targetStep = targetStepForPointer(event.clientX)
    if (targetStep !== null) props.controller.updateMovePreview(targetStep)
    const originCellKey = dragOriginCellKey
    const outcome = props.controller.commitMovePreview()
    if (originCellKey !== null && outcome?.changed === true) {
      suppressClickCellKey = originCellKey
    }
    releasePointerCapture()
  }

  function handlePointerCancel(event: PointerEvent): void {
    if (event.pointerId !== activePointerId) return
    props.controller.cancelMovePreview()
    releasePointerCapture()
  }

  function focusCell(gmKey: number, stepIndex: number): void {
    const key = `${gmKey}:${stepIndex}`
    setFocusedCellKey(key)
    cellRefs.get(key)?.focus()
  }

  function moveCellFocus(
    gmKey: number,
    stepIndex: number,
    rowDelta: number,
    stepDelta: number,
  ): void {
    const rows = rowKeys()
    const steps = visibleSteps()
    const rowIndex = rows.indexOf(gmKey)
    const stepPosition = steps.indexOf(stepIndex)
    if (rowIndex < 0 || stepPosition < 0) return
    const nextRow = Math.min(rows.length - 1, Math.max(0, rowIndex + rowDelta))
    const nextStep = Math.min(
      steps.length - 1,
      Math.max(0, stepPosition + stepDelta),
    )
    const nextGmKey = rows[nextRow]
    const nextStepIndex = steps[nextStep]
    if (nextGmKey !== undefined && nextStepIndex !== undefined) {
      focusCell(nextGmKey, nextStepIndex)
    }
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      if (props.disabled !== true) props.controller.undo()
      return
    }
    if (event.key === 'Escape' && props.controller.movePreview() !== null) {
      event.preventDefault()
      props.controller.cancelMovePreview()
      releasePointerCapture()
      return
    }
    const target = event.target
    if (!(target instanceof HTMLButtonElement)) return
    suppressClickCellKey = null
    const gmKey = Number(target.dataset.gmKey)
    const stepIndex = Number(target.dataset.stepIndex)
    if (!Number.isInteger(gmKey) || !Number.isInteger(stepIndex)) return

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      moveCellFocus(gmKey, stepIndex, 0, event.key === 'ArrowLeft' ? -1 : 1)
      return
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      moveCellFocus(gmKey, stepIndex, event.key === 'ArrowUp' ? -1 : 1, 0)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activateCell(gmKey, stepIndex)
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const hit = cellModel(gmKey, stepIndex).hit
      if (hit !== null && props.disabled !== true) {
        event.preventDefault()
        props.controller.selectHit(hit.id)
        props.controller.removeSelectedHit()
      }
    }
  }

  function canMoveSelectedHit(stepDelta: -1 | 1): boolean {
    const hit = props.controller.selectedHit()
    if (hit === null) return false
    const nextStep = hit.stepIndex + stepDelta
    if (nextStep < 0 || nextStep >= props.controller.state().stepCount) {
      return false
    }
    return !props.controller
      .state()
      .hits.some(
        (candidate) =>
          candidate.id !== hit.id &&
          candidate.trackId === hit.trackId &&
          candidate.gmKey === hit.gmKey &&
          candidate.stepIndex === nextStep,
      )
  }

  function moveSelectedHit(stepDelta: -1 | 1): void {
    const hit = props.controller.selectedHit()
    if (hit === null || !canMoveSelectedHit(stepDelta)) return
    const nextStep = hit.stepIndex + stepDelta
    const outcome = props.controller.dispatch({
      type: 'move-hit',
      hitId: hit.id,
      stepIndex: nextStep,
    })
    if (!outcome.changed) return
    props.controller.setPageIndex(
      Math.floor(nextStep / props.controller.pageSize()),
    )
    queueMicrotask(() => focusCell(hit.gmKey, nextStep))
  }

  return (
    <section
      ref={rootElement}
      class={styles.editor}
      aria-label={props.label ?? 'First Pocket groove editor'}
      data-testid="drum-groove-editor"
      data-visible-step-count={props.controller.pageSize()}
      data-dirty={props.controller.dirty() ? 'true' : 'false'}
      style={`--visible-steps: ${props.controller.pageSize()}`}
      onKeyDown={handleKeyDown}
    >
      <div class={styles.editorHeader}>
        <div class={styles.editorIdentity}>
          <span>Live edit · save when ready</span>
          <strong>Shape the pocket.</strong>
          <small>
            Each variation stays here. Save a project to keep it on this device.
          </small>
          <Show when={props.projectControls !== undefined}>
            <div class={styles.projectControls}>{props.projectControls}</div>
          </Show>
        </div>

        <div
          class={styles.variationSwitch}
          role="group"
          aria-label="Prepared groove variation"
        >
          <For each={FIRST_POCKET_VARIANTS}>
            {(variant) => (
              <button
                type="button"
                aria-pressed={props.controller.variantId() === variant.id}
                disabled={props.disabled === true}
                onClick={() => props.controller.selectVariant(variant.id)}
              >
                <strong>{variant.label}</strong>
                <span>
                  {variant.id === props.controller.variantId()
                    ? 'Editing'
                    : 'Open'}
                </span>
              </button>
            )}
          </For>
        </div>

        <div class={styles.historyActions}>
          <button
            type="button"
            disabled={
              props.disabled === true ||
              props.controller.state().undoDepth === 0
            }
            onClick={() => props.controller.undo()}
          >
            Undo
            <span>{props.controller.state().undoDepth}</span>
          </button>
          <button
            type="button"
            disabled={props.disabled === true || !props.controller.dirty()}
            onClick={() => props.controller.reset()}
          >
            Reset
          </button>
        </div>
      </div>

      <div class={styles.gridToolbar}>
        <div>
          <strong>{pageLabel()}</strong>
          <span>Click to add or select · drag sideways to move</span>
        </div>
        <div class={styles.pageControls} role="group" aria-label="Groove pages">
          <button
            type="button"
            aria-label="Previous groove page"
            disabled={
              props.disabled === true || props.controller.pageIndex() === 0
            }
            onClick={() => props.controller.previousPage()}
          >
            Previous
          </button>
          <output aria-live="polite">
            {props.controller.pageIndex() + 1} / {props.controller.pageCount()}
          </output>
          <button
            type="button"
            aria-label="Next groove page"
            disabled={
              props.disabled === true ||
              props.controller.pageIndex() >= props.controller.pageCount() - 1
            }
            onClick={() => props.controller.nextPage()}
          >
            Next
          </button>
        </div>
      </div>

      <div class={styles.gridFrame}>
        <div
          class={styles.grooveGrid}
          role="grid"
          aria-label={`${pageLabel()} exact drum articulations`}
          aria-rowcount={rowKeys().length}
          aria-colcount={visibleSteps().length + 1}
        >
          <div class={styles.stepHeader} aria-hidden="true">
            <span>Articulation</span>
            <div class={styles.stepHeaderRail}>
              <For each={visibleSteps()}>
                {(stepIndex) => (
                  <b classList={{ [styles.beatStart]: stepIndex % 4 === 0 }}>
                    {shortStepLabel(stepIndex)}
                  </b>
                )}
              </For>
            </div>
          </div>

          <For each={rowKeys()}>
            {(gmKey) => (
              <div
                class={styles.articulationRow}
                role="row"
                data-gm-row={gmKey}
              >
                <div class={styles.rowLabel} role="rowheader">
                  <strong>{generalMidiPercussionName(gmKey)}</strong>
                  <span>
                    {FAMILY_LABEL.get(familyForGmKey(gmKey)) ?? 'Auxiliary'} ·
                    GM {gmKey}
                  </span>
                </div>
                <div class={styles.cellRail} role="presentation" data-cell-rail>
                  <For each={visibleSteps()}>
                    {(stepIndex) => {
                      const key = `${gmKey}:${stepIndex}`
                      return (
                        <div class={styles.cellSlot} role="gridcell">
                          <button
                            ref={(element) => cellRefs.set(key, element)}
                            type="button"
                            classList={{
                              [styles.cell]: true,
                              [styles.hasHit]:
                                cellModel(gmKey, stepIndex).hit !== null,
                              [styles.selected]:
                                cellModel(gmKey, stepIndex).hit !== null &&
                                props.controller.selectedHitId() ===
                                  cellModel(gmKey, stepIndex).hit?.id,
                              [styles.densityOmitted]:
                                cellModel(gmKey, stepIndex).hit !== null &&
                                !activeHitIds().has(
                                  cellModel(gmKey, stepIndex).hit?.id ?? '',
                                ),
                              [styles.preview]: cellModel(gmKey, stepIndex)
                                .preview,
                              [styles.invalidPreview]:
                                cellModel(gmKey, stepIndex).preview &&
                                !cellModel(gmKey, stepIndex).previewValid,
                              [styles.beatStart]: stepIndex % 4 === 0,
                            }}
                            style={
                              cellModel(gmKey, stepIndex).hit === null
                                ? undefined
                                : `--velocity: ${Math.max(
                                    0.24,
                                    (cellModel(gmKey, stepIndex).hit
                                      ?.velocity ?? 1) / 127,
                                  )}`
                            }
                            aria-label={cellLabel(gmKey, stepIndex)}
                            aria-pressed={
                              cellModel(gmKey, stepIndex).hit !== null &&
                              props.controller.selectedHitId() ===
                                cellModel(gmKey, stepIndex).hit?.id
                            }
                            disabled={props.disabled === true}
                            tabIndex={focusedCellKey() === key ? 0 : -1}
                            data-groove-cell
                            data-gm-key={gmKey}
                            data-step-index={stepIndex}
                            data-hit-id={
                              cellModel(gmKey, stepIndex).hit?.id ?? undefined
                            }
                            onFocus={() => setFocusedCellKey(key)}
                            onClick={() => activateCell(gmKey, stepIndex)}
                            onPointerDown={(event) => {
                              if (activePointerId === null) {
                                suppressClickCellKey = null
                              }
                              const hit = cellModel(gmKey, stepIndex).hit
                              if (hit !== null) {
                                handlePointerDown(event, hit, gmKey, stepIndex)
                              }
                            }}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerCancel}
                            onLostPointerCapture={handlePointerCancel}
                          >
                            <Show
                              when={cellModel(gmKey, stepIndex).hit !== null}
                              fallback={<span class={styles.addMark}>+</span>}
                            >
                              <span class={styles.hitMark} aria-hidden="true" />
                              <Show
                                when={cellModel(gmKey, stepIndex).hitCount > 1}
                              >
                                <small>
                                  {cellModel(gmKey, stepIndex).hitCount}
                                </small>
                              </Show>
                              <Show
                                when={
                                  props.controller.selectedHitId() ===
                                  cellModel(gmKey, stepIndex).hit?.id
                                }
                              >
                                <span
                                  class={styles.selectionIndicator}
                                  aria-hidden="true"
                                >
                                  SEL
                                </span>
                              </Show>
                            </Show>
                          </button>
                        </div>
                      )
                    }}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>

      <div class={styles.editorFooter}>
        <section class={styles.selectionCard} aria-label="Selected drum hit">
          <span>Selected hit</span>
          <Show
            when={props.controller.selectedHit()}
            fallback={
              <p>
                Select a hit to inspect its exact articulation and velocity.
              </p>
            }
          >
            {(hit) => (
              <>
                <strong>{generalMidiPercussionName(hit().gmKey)}</strong>
                <p>
                  {selectedPosition()} · velocity {hit().velocity}
                </p>
              </>
            )}
          </Show>
          <div class={styles.selectionActions}>
            <button
              type="button"
              disabled={props.disabled === true || !canMoveSelectedHit(-1)}
              onClick={() => moveSelectedHit(-1)}
            >
              Earlier
            </button>
            <button
              type="button"
              disabled={props.disabled === true || !canMoveSelectedHit(1)}
              onClick={() => moveSelectedHit(1)}
            >
              Later
            </button>
            <button
              type="button"
              disabled={
                props.disabled === true ||
                props.controller.selectedHit() === null
              }
              onClick={() => props.controller.removeSelectedHit()}
            >
              Remove
            </button>
          </div>
        </section>

        <fieldset class={styles.transformCard}>
          <legend>Swing</legend>
          <p>Delays off-sixteenths without moving your authored hits.</p>
          <div role="group" aria-label="Swing amount">
            <For each={SWING_PRESETS}>
              {(preset) => (
                <button
                  type="button"
                  aria-pressed={
                    props.controller.state().swing === preset.amount
                  }
                  disabled={props.disabled === true}
                  onClick={() =>
                    props.controller.dispatch({
                      type: 'set-swing',
                      amount: preset.amount,
                    })
                  }
                >
                  {preset.label}
                </button>
              )}
            </For>
          </div>
        </fieldset>

        <fieldset class={styles.transformCard}>
          <legend>Density</legend>
          <p>
            Temporarily thins lower-priority hits; nothing is deleted.{' '}
            <output>
              {soundingHitCount()} of {props.controller.state().hits.length}{' '}
              sounding.
            </output>
          </p>
          <div role="group" aria-label="Groove density">
            <For each={DENSITY_PRESETS}>
              {(preset) => (
                <button
                  type="button"
                  aria-pressed={
                    props.controller.state().density === preset.amount
                  }
                  disabled={props.disabled === true}
                  onClick={() =>
                    props.controller.dispatch({
                      type: 'set-density',
                      amount: preset.amount,
                    })
                  }
                >
                  {preset.label}
                </button>
              )}
            </For>
          </div>
        </fieldset>
      </div>
    </section>
  )
}

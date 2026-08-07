// ============================================================
// useLyricsBlocksController — repeated sections of a lyric
// ============================================================
//
// A "block" is a named run of lines that recurs — a chorus, a refrain. The
// first instance is the template: map it once and every other instance is
// filled from it, which is most of why mapping a song is not linear work.
//
// Split out of useStemMixerLyricsController (Phase 0 of
// docs/plans/lrc-mapper-studio-plan.md). All seven block signals moved with
// the code, so the interface below is two callbacks rather than a dozen
// setters.

import type { Accessor, Setter } from 'solid-js'
import { createSignal } from 'solid-js'
import type { BlockInfo, BlockInstancesMap, LyricsBlock } from './types'

/** Distinct hues for block chips. Chosen for contrast on the dark list. */
const BLOCK_COLORS = [
  '#f0a060',
  '#60a0f0',
  '#60d080',
  '#d080e0',
  '#e0c050',
  '#f06080',
]

export interface LyricsBlocksDeps {
  /** Write blocks + instances through to the lyrics cache and the db. */
  persistBlocks: (blocks: LyricsBlock[], instances: BlockInstancesMap) => void
  /**
   * The line list the mapper is working against. Blocks and the mapping
   * session reference each other — blocks needs the line list, the session
   * needs to know which block a line belongs to — so both sides take the
   * other lazily and the parent wires them after both exist.
   */
  getGenLines: () => string[]
}

export interface LyricsBlocksController {
  blocks: Accessor<LyricsBlock[]>
  setBlocks: Setter<LyricsBlock[]>
  blockInstances: Accessor<BlockInstancesMap>
  setBlockInstances: Setter<BlockInstancesMap>
  blockMarkMode: Accessor<boolean>
  setBlockMarkMode: Setter<boolean>
  markStartLine: Accessor<number | null>
  setMarkStartLine: Setter<number | null>
  markEndLine: Accessor<number | null>
  setMarkEndLine: Setter<number | null>
  showBlockForm: Accessor<boolean>
  setShowBlockForm: Setter<boolean>
  blockEditTarget: Accessor<string | null>
  setBlockEditTarget: Setter<string | null>

  getBlockColor: (blockId: string) => string
  getBlockForLine: (lineIdx: number) => BlockInfo | null
  getBlockById: (blockId: string) => LyricsBlock | undefined
  handleMarkBlock: (label: string, repeat: number) => void
  handleUnlinkInstance: (blockId: string, instanceIdx: number) => void
  handleDeleteBlock: (blockId: string) => void
  handleAddInstance: (
    blockId: string,
    startLine: number,
    endLine: number,
  ) => void
  handleEditBlock: (blockId: string, label: string, repeat: number) => void
  detectBlockInstances: (
    textLines: string[],
    templateIndices: number[],
    existingInstances: BlockInstancesMap,
  ) => number[][]

  /** Drop every block. The lyrics underneath them changed. */
  reset: () => void
}

export function useLyricsBlocksController(
  deps: LyricsBlocksDeps,
): LyricsBlocksController {
  const [blocks, setBlocks] = createSignal<LyricsBlock[]>([])
  const [blockInstances, setBlockInstances] = createSignal<BlockInstancesMap>(
    {},
  )
  const [blockMarkMode, setBlockMarkMode] = createSignal(false)
  const [markStartLine, setMarkStartLine] = createSignal<number | null>(null)
  const [markEndLine, setMarkEndLine] = createSignal<number | null>(null)
  const [showBlockForm, setShowBlockForm] = createSignal(false)
  const [blockEditTarget, setBlockEditTarget] = createSignal<string | null>(
    null,
  )

  // ── Block helpers ─────────────────────────────────────────────────

  const getBlockColor = (blockId: string): string => {
    let hash = 0
    for (let i = 0; i < blockId.length; i++)
      hash = (hash << 5) - hash + blockId.charCodeAt(i)
    return BLOCK_COLORS[Math.abs(hash) % BLOCK_COLORS.length]
  }

  const getBlockForLine = (
    lineIdx: number,
  ): { blockId: string; instanceIdx: number; isTemplate: boolean } | null => {
    const bi = blockInstances()
    for (const [blockId, instances] of Object.entries(bi)) {
      for (let i = 0; i < instances.length; i++) {
        const [start, end] = instances[i]
        if (lineIdx >= start && lineIdx < end) {
          return { blockId, instanceIdx: i, isTemplate: i === 0 }
        }
      }
    }
    return null
  }

  const getBlockById = (blockId: string): LyricsBlock | undefined => {
    return blocks().find((b) => b.id === blockId)
  }

  const detectBlockInstances = (
    textLines: string[],
    templateIndices: number[],
    existingInstances: BlockInstancesMap,
  ): number[][] => {
    const templateText = templateIndices.map((i) => textLines[i].trim())
    if (templateText.every((t) => !t)) return [templateIndices]

    const instances: number[][] = [templateIndices]
    const taken = new Set<number>()
    for (const insts of Object.values(existingInstances)) {
      for (const inst of insts) {
        for (let i = inst[0]; i < inst[1]; i++) taken.add(i)
      }
    }

    for (let i = 0; i < textLines.length; i++) {
      if (taken.has(i)) continue
      if (
        i >= templateIndices[0] &&
        i <= templateIndices[templateIndices.length - 1]
      )
        continue

      let match = true
      for (let j = 0; j < templateText.length; j++) {
        const checkLine = textLines[i + j]?.trim()
        if (checkLine !== templateText[j]) {
          match = false
          break
        }
      }
      if (match) {
        const instStart = i
        const instEnd = i + templateText.length
        instances.push([instStart, instEnd])
        for (let k = instStart; k < instEnd; k++) taken.add(k)
        i += templateText.length - 1
      }
    }
    return instances
  }

  // ── Block mark / unlink / delete handlers ──────────────────────────

  const handleMarkBlock = (label: string, repeatCount: number) => {
    const start = markStartLine()
    const end = markEndLine()
    if (start === null || end === null || start >= end) return

    const lines = deps.getGenLines()
    const templateIndices: number[] = []
    for (let i = start; i < end; i++) templateIndices.push(i)

    const blockId = `${label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`

    const instances =
      templateIndices.length >= 2
        ? detectBlockInstances(lines, templateIndices, blockInstances())
        : [templateIndices]

    const block: LyricsBlock = {
      id: blockId,
      label,
      lineIndices: templateIndices,
      repeatCount: Math.max(1, repeatCount),
    }
    setBlocks((prev) => [...prev, block])
    setBlockInstances((prev) => ({ ...prev, [blockId]: instances }))

    setMarkStartLine(null)
    setMarkEndLine(null)
    setBlockMarkMode(false)
    setShowBlockForm(false)
    deps.persistBlocks(blocks(), blockInstances())
  }

  const handleUnlinkInstance = (blockId: string, instanceIdx: number) => {
    if (instanceIdx === 0) {
      handleDeleteBlock(blockId)
      return
    }
    setBlockInstances((prev) => {
      const next = { ...prev }
      next[blockId] = prev[blockId].filter((_, i) => i !== instanceIdx)
      if (next[blockId].length <= 1) {
        delete next[blockId]
        setBlocks((prev) => prev.filter((b) => b.id !== blockId))
      }
      return next
    })
    deps.persistBlocks(blocks(), blockInstances())
  }

  const handleDeleteBlock = (blockId: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId))
    setBlockInstances((prev) => {
      const next = { ...prev }
      delete next[blockId]
      return next
    })
    setBlockEditTarget(null)
    deps.persistBlocks(blocks(), blockInstances())
  }

  const handleAddInstance = (
    blockId: string,
    startIdx: number,
    endIdx: number,
  ) => {
    const block = getBlockById(blockId)
    if (!block) return
    setBlockInstances((prev) => {
      const next = { ...prev }
      next[blockId] = [...(prev[blockId] ?? []), [startIdx, endIdx]]
      return next
    })
    setMarkStartLine(null)
    setMarkEndLine(null)
    deps.persistBlocks(blocks(), blockInstances())
  }

  const handleEditBlock = (
    blockId: string,
    label: string,
    repeatCount: number,
  ) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId
          ? { ...b, label, repeatCount: Math.max(1, repeatCount) }
          : b,
      ),
    )
    setBlockEditTarget(null)
    deps.persistBlocks(blocks(), blockInstances())
  }

  const reset = () => {
    setBlocks([])
    setBlockInstances({})
    setBlockMarkMode(false)
    setMarkStartLine(null)
    setMarkEndLine(null)
    setShowBlockForm(false)
    setBlockEditTarget(null)
  }

  return {
    blocks,
    setBlocks,
    blockInstances,
    setBlockInstances,
    blockMarkMode,
    setBlockMarkMode,
    markStartLine,
    setMarkStartLine,
    markEndLine,
    setMarkEndLine,
    showBlockForm,
    setShowBlockForm,
    blockEditTarget,
    setBlockEditTarget,
    getBlockColor,
    getBlockForLine,
    getBlockById,
    handleMarkBlock,
    handleUnlinkInstance,
    handleDeleteBlock,
    handleAddInstance,
    handleEditBlock,
    detectBlockInstances,
    reset,
  }
}

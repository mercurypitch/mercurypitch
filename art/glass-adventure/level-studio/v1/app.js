// ============================================================
// Cloudway Level Studio — touch-capable top-view level editor
// ============================================================

import { ASSET_CATALOG, LIMITS, MARKER_TYPES, PLATFORM_TYPES, createDemoLevel, createEmptyLevel, inspectGeometry, makePiece, parseLevelJson, sanitizeLevel, serializeLevel, } from './level-model.js'

const SVG_NS = 'http://www.w3.org/2000/svg'
const CELL_PX = 40
const VIEWBOX = { width: 1280, height: 820 }
const DRAFT_KEY = 'mercurypitch.cloudway-level-studio.v1.draft'
const HISTORY_LIMIT = 100

const byId = (id) => document.getElementById(id)
const stageSvg = byId('stageSvg')
const cameraGroup = byId('cameraGroup')
const gridLayer = byId('gridLayer')
const piecesLayer = byId('piecesLayer')
const overlayLayer = byId('overlayLayer')
const stageViewport = byId('stageViewport')
const pieceForm = byId('pieceForm')
const levelForm = byId('levelForm')
const behaviorContent = byId('behaviorContent')
const importDialog = byId('importDialog')
const exportDialog = byId('exportDialog')
const shortcutsDialog = byId('shortcutsDialog')

let level = createDemoLevel()
let selectedId = null
let placement = null
let tool = 'select'
let gesture = null
let spaceHeld = false
let checksExpanded = true
let undoStack = []
let redoStack = []
let toastTimer = null
let camera = { zoom: 1, panX: 0, panY: 0 }

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name)
  Object.entries(attributes).forEach(([key, value]) =>
    element.setAttribute(key, String(value)),
  )
  return element
}

function clone(value) {
  return structuredClone(value)
}

function selectedPiece() {
  return level.pieces.find((piece) => piece.id === selectedId) || null
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function round(value, decimals = 3) {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function snap(value, increment = level.grid.cellSize) {
  return round(Math.round(value / increment) * increment)
}

function showToast(message) {
  const toast = byId('toast')
  window.clearTimeout(toastTimer)
  toast.textContent = message
  toast.hidden = false
  requestAnimationFrame(() => toast.classList.add('is-visible'))
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('is-visible')
    window.setTimeout(() => {
      toast.hidden = true
    }, 180)
  }, 2400)
}

function updateSaveStatus(message = 'Unsaved changes') {
  byId('saveStatus').textContent = message
}

function pushUndoSnapshot(snapshot) {
  undoStack.push(snapshot)
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift()
  redoStack = []
}

function commit(description, mutate) {
  const before = JSON.stringify(level)
  mutate()
  const after = JSON.stringify(level)
  if (before === after) {
    renderAll()
    return false
  }
  pushUndoSnapshot(before)
  updateSaveStatus('Unsaved changes')
  renderAll()
  if (description) announceGrid(description)
  return true
}

function commitGesture(snapshot, description) {
  const after = JSON.stringify(level)
  if (snapshot === after) {
    renderAll()
    return
  }
  pushUndoSnapshot(snapshot)
  updateSaveStatus('Unsaved changes')
  renderAll()
  announceGrid(description)
}

function replaceLevel(nextLevel, description) {
  const before = JSON.stringify(level)
  level = clone(nextLevel)
  selectedId = null
  placement = null
  pushUndoSnapshot(before)
  updateSaveStatus('Unsaved changes')
  fitView()
  renderAll()
  announceGrid(description)
}

function undo() {
  const previous = undoStack.pop()
  if (!previous) return
  redoStack.push(JSON.stringify(level))
  level = JSON.parse(previous)
  if (!level.pieces.some((piece) => piece.id === selectedId)) selectedId = null
  placement = null
  updateSaveStatus('Undo applied')
  renderAll()
}

function redo() {
  const next = redoStack.pop()
  if (!next) return
  undoStack.push(JSON.stringify(level))
  level = JSON.parse(next)
  if (!level.pieces.some((piece) => piece.id === selectedId)) selectedId = null
  placement = null
  updateSaveStatus('Redo applied')
  renderAll()
}

function announceGrid(message) {
  byId('placementHint').textContent = message
}

function pieceTypeName(piece) {
  if (piece.kind === 'platform')
    return PLATFORM_TYPES[piece.surface]?.shortLabel || 'Platform'
  if (piece.kind === 'marker')
    return MARKER_TYPES[piece.marker]?.label || 'Marker'
  return 'Voice target'
}

function setTool(nextTool) {
  tool = nextTool
  if (tool === 'pan') placement = null
  byId('selectToolButton').classList.toggle('is-active', tool === 'select')
  byId('selectToolButton').setAttribute(
    'aria-pressed',
    String(tool === 'select'),
  )
  byId('panToolButton').classList.toggle('is-active', tool === 'pan')
  byId('panToolButton').setAttribute('aria-pressed', String(tool === 'pan'))
  stageViewport.dataset.tool = tool
  renderPaletteState()
  renderPlacementHint()
}

function setPlacement(kind, subtype) {
  placement = { kind, subtype }
  tool = 'select'
  byId('selectToolButton').classList.add('is-active')
  byId('selectToolButton').setAttribute('aria-pressed', 'true')
  byId('panToolButton').classList.remove('is-active')
  byId('panToolButton').setAttribute('aria-pressed', 'false')
  stageViewport.dataset.tool = 'place'
  renderPaletteState()
  renderPlacementHint()
  stageSvg.focus()
}

function renderPaletteState() {
  document.querySelectorAll('[data-create-kind]').forEach((button) => {
    const active =
      placement?.kind === button.dataset.createKind &&
      placement?.subtype === button.dataset.createSubtype
    button.classList.toggle('is-active', active)
    button.setAttribute('aria-pressed', String(active))
  })
}

function renderPlacementHint() {
  const hint = byId('placementHint')
  if (!placement) {
    hint.hidden = true
    return
  }
  const label =
    placement.kind === 'platform'
      ? PLATFORM_TYPES[placement.subtype].label
      : placement.kind === 'marker'
        ? MARKER_TYPES[placement.subtype].label
        : 'Voice target'
  hint.textContent = `Place ${label}: tap the grid. Escape cancels.`
  hint.hidden = false
}

function renderGrid() {
  const width = level.grid.width * CELL_PX
  const depth = level.grid.depth * CELL_PX
  const minorSize = level.grid.cellSize * CELL_PX
  const majorSize = minorSize * 5
  const minorPattern = byId('minorGrid')
  const majorPattern = byId('majorGrid')
  minorPattern.setAttribute('width', minorSize)
  minorPattern.setAttribute('height', minorSize)
  minorPattern
    .querySelector('path')
    .setAttribute('d', `M${minorSize} 0H0V${minorSize}`)
  majorPattern.setAttribute('width', majorSize)
  majorPattern.setAttribute('height', majorSize)
  majorPattern.querySelector('rect').setAttribute('width', majorSize)
  majorPattern.querySelector('rect').setAttribute('height', majorSize)
  majorPattern
    .querySelector('path')
    .setAttribute('d', `M${majorSize} 0H0V${majorSize}`)

  const background = svgElement('rect', {
    class: 'grid-background',
    x: 0,
    y: 0,
    width,
    height: depth,
    rx: 4,
  })
  const xAxis = svgElement('line', {
    class: 'grid-axis',
    x1: 0,
    x2: width,
    y1: depth / 2,
    y2: depth / 2,
  })
  const zAxis = svgElement('line', {
    class: 'grid-axis',
    x1: width / 2,
    x2: width / 2,
    y1: 0,
    y2: depth,
  })
  const origin = svgElement('circle', {
    class: 'grid-origin',
    cx: width / 2,
    cy: depth / 2,
    r: 5,
  })
  const xLabel = svgElement('text', {
    class: 'axis-label',
    x: width - 16,
    y: depth / 2 - 10,
    'text-anchor': 'end',
  })
  xLabel.textContent = '+X'
  const zLabel = svgElement('text', {
    class: 'axis-label',
    x: width / 2 + 10,
    y: depth - 14,
  })
  zLabel.textContent = '+Z'
  gridLayer.replaceChildren(background, xAxis, zAxis, origin, xLabel, zLabel)
}

function piecePosition(piece) {
  return {
    x: (piece.x + level.grid.width / 2) * CELL_PX,
    y: (piece.z + level.grid.depth / 2) * CELL_PX,
  }
}

function platformGraphic(piece, group) {
  const width = piece.width * CELL_PX
  const depth = piece.depth * CELL_PX
  if (piece.surface === 'glide') {
    const track = svgElement('line', {
      class: 'motion-track',
      x1: piece.motion.axis === 'x' ? (-piece.motion.travel * CELL_PX) / 2 : 0,
      x2: piece.motion.axis === 'x' ? (piece.motion.travel * CELL_PX) / 2 : 0,
      y1: piece.motion.axis === 'z' ? (-piece.motion.travel * CELL_PX) / 2 : 0,
      y2: piece.motion.axis === 'z' ? (piece.motion.travel * CELL_PX) / 2 : 0,
    })
    group.append(track)
  }

  const body = svgElement('rect', {
    class: `piece-body platform-body surface-${piece.surface}`,
    x: -width / 2,
    y: -depth / 2,
    width,
    height: depth,
    rx: Math.min(10, width / 8, depth / 8),
    'data-testid': `piece-body-${piece.id}`,
  })
  group.append(body)

  if (piece.surface === 'crackle') {
    const fracture = svgElement('path', {
      class: 'crackle-lines',
      d: `M${-width * 0.32} ${-depth * 0.28} L${-width * 0.08} ${-depth * 0.02} L${-width * 0.22} ${depth * 0.25} M${-width * 0.08} ${-depth * 0.02} L${width * 0.18} ${-depth * 0.24} M${-width * 0.08} ${-depth * 0.02} L${width * 0.3} ${depth * 0.22}`,
    })
    group.append(fracture)
  }

  if (piece.surface === 'frost') {
    const frostLine = svgElement('path', {
      class: 'frost-lines',
      d: `M${-width / 2 + 8} ${depth * 0.22} C${-width * 0.15} ${-depth * 0.25}, ${width * 0.12} ${depth * 0.3}, ${width / 2 - 8} ${-depth * 0.18}`,
    })
    group.append(frostLine)
  }

  if (piece.surface === 'scroll') {
    const ratio = piece.motion.minLengthRatio
    const retractedWidth = piece.motion.axis === 'x' ? width * ratio : width
    const retractedDepth = piece.motion.axis === 'z' ? depth * ratio : depth
    const retracted = svgElement('rect', {
      class: 'scroll-retracted-outline',
      x: -retractedWidth / 2,
      y: -retractedDepth / 2,
      width: retractedWidth,
      height: retractedDepth,
      rx: 4,
    })
    group.append(retracted)
  }

  const label = svgElement('text', {
    class: 'piece-label',
    x: 0,
    y: 4,
    'text-anchor': 'middle',
    transform: `rotate(${-piece.rotation})`,
  })
  label.textContent =
    piece.surface === 'crackle'
      ? `${piece.crackleSeconds}s`
      : pieceTypeName(piece)
  group.append(label)
}

function markerGraphic(piece, group) {
  const marker = svgElement('path', {
    class: `piece-body marker-body marker-${piece.marker}`,
    d: 'M0 -18 L18 0 L0 18 L-18 0 Z',
    'data-testid': `piece-body-${piece.id}`,
  })
  const label = svgElement('text', {
    class: 'marker-label',
    x: 0,
    y: 5,
    'text-anchor': 'middle',
    transform: `rotate(${-piece.rotation})`,
  })
  label.textContent =
    piece.marker === 'checkpoint' ? 'C' : piece.marker === 'spawn' ? 'S' : 'E'
  group.append(marker, label)
}

function voiceGraphic(piece, group) {
  const ring = svgElement('circle', {
    class: 'piece-body voice-body',
    cx: 0,
    cy: 0,
    r: 18,
    'data-testid': `piece-body-${piece.id}`,
  })
  const wave = svgElement('path', {
    class: 'voice-wave',
    d: 'M-11 1 C-8 -10 -4 -10 -2 1 S4 12 6 1 S11 -8 13 1',
  })
  group.append(ring, wave)
}

function renderPieces() {
  const fragment = document.createDocumentFragment()
  level.pieces.forEach((piece) => {
    const position = piecePosition(piece)
    const group = svgElement('g', {
      class: `level-piece kind-${piece.kind}${piece.id === selectedId ? ' is-selected' : ''}`,
      transform: `translate(${position.x} ${position.y}) rotate(${piece.rotation})`,
      'data-piece-id': piece.id,
      'data-piece-kind': piece.kind,
      'aria-label': `${piece.name}, ${pieceTypeName(piece)}`,
    })
    const title = svgElement('title')
    title.textContent = `${piece.name} (${piece.id})`
    group.append(title)

    if (piece.kind === 'platform') platformGraphic(piece, group)
    else if (piece.kind === 'marker') markerGraphic(piece, group)
    else voiceGraphic(piece, group)

    if (piece.id === selectedId) {
      const selection = svgElement('rect', {
        class: 'selection-outline',
        x: (-piece.width * CELL_PX) / 2 - 6,
        y: (-piece.depth * CELL_PX) / 2 - 6,
        width: piece.width * CELL_PX + 12,
        height: piece.depth * CELL_PX + 12,
        rx: 8,
      })
      group.append(selection)
      if (piece.kind === 'platform') {
        const handle = svgElement('rect', {
          class: 'resize-handle',
          x: piece.width * CELL_PX * 0.5 - 8,
          y: piece.depth * CELL_PX * 0.5 - 8,
          width: 16,
          height: 16,
          rx: 3,
          'data-resize-handle': 'true',
          'data-testid': `resize-handle-${piece.id}`,
        })
        group.append(handle)
      }
    }
    fragment.append(group)
  })
  piecesLayer.replaceChildren(fragment)
  overlayLayer.replaceChildren()
}

function renderCamera() {
  cameraGroup.setAttribute(
    'transform',
    `translate(${round(camera.panX)} ${round(camera.panY)}) scale(${round(camera.zoom, 4)})`,
  )
  byId('zoomOutput').textContent = `${Math.round(camera.zoom * 100)}%`
}

function fitView() {
  const width = level.grid.width * CELL_PX
  const depth = level.grid.depth * CELL_PX
  camera.zoom = clamp(
    Math.min((VIEWBOX.width - 120) / width, (VIEWBOX.height - 120) / depth),
    0.25,
    2.5,
  )
  camera.panX = (VIEWBOX.width - width * camera.zoom) / 2
  camera.panY = (VIEWBOX.height - depth * camera.zoom) / 2
  renderCamera()
}

function clientToSvg(clientX, clientY) {
  const point = stageSvg.createSVGPoint()
  point.x = clientX
  point.y = clientY
  return point.matrixTransform(stageSvg.getScreenCTM().inverse())
}

function clientToLevel(clientX, clientY) {
  const svgPoint = clientToSvg(clientX, clientY)
  const worldX = (svgPoint.x - camera.panX) / camera.zoom
  const worldZ = (svgPoint.y - camera.panY) / camera.zoom
  return {
    x: worldX / CELL_PX - level.grid.width / 2,
    z: worldZ / CELL_PX - level.grid.depth / 2,
  }
}

function zoomAt(nextZoom, svgX = VIEWBOX.width / 2, svgY = VIEWBOX.height / 2) {
  const bounded = clamp(nextZoom, 0.25, 3)
  const worldX = (svgX - camera.panX) / camera.zoom
  const worldY = (svgY - camera.panY) / camera.zoom
  camera.panX = svgX - worldX * bounded
  camera.panY = svgY - worldY * bounded
  camera.zoom = bounded
  renderCamera()
}

function renderHistoryButtons() {
  byId('undoButton').disabled = undoStack.length === 0
  byId('redoButton').disabled = redoStack.length === 0
}

function renderSelectionActions() {
  const hasSelection = selectedPiece() !== null
  byId('selectionActions').hidden = !hasSelection
}

function renderLevelForm() {
  byId('levelTitleInput').value = level.title
  byId('levelIdInput').value = level.id
  byId('gridWidthInput').value = level.grid.width
  byId('gridDepthInput').value = level.grid.depth
  byId('gridCellInput').value = level.grid.cellSize
  byId('melodyTitleInput').value = level.melody.title
  byId('melodyIdInput').value = level.melody.id
  renderNotesEditor()
}

function renderNotesEditor() {
  const container = byId('notesEditor')
  const fragment = document.createDocumentFragment()
  level.melody.notes.forEach((note, index) => {
    const row = document.createElement('div')
    row.className = 'note-row'
    row.dataset.noteIndex = String(index)

    const number = document.createElement('span')
    number.className = 'note-number'
    number.textContent = String(index + 1)
    number.setAttribute('aria-hidden', 'true')

    const idLabel = document.createElement('label')
    idLabel.textContent = 'ID'
    const idInput = document.createElement('input')
    idInput.value = note.id
    idInput.maxLength = LIMITS.idCharacters
    idInput.pattern = '[a-z0-9][a-z0-9-]*'
    idInput.dataset.noteField = 'id'
    idInput.setAttribute('aria-label', `Note ${index + 1} ID`)
    idLabel.append(idInput)

    const labelLabel = document.createElement('label')
    labelLabel.textContent = 'Label'
    const labelInput = document.createElement('input')
    labelInput.value = note.label
    labelInput.maxLength = LIMITS.nameCharacters
    labelInput.dataset.noteField = 'label'
    labelInput.setAttribute('aria-label', `Note ${index + 1} label`)
    labelLabel.append(labelInput)

    const semitoneLabel = document.createElement('label')
    semitoneLabel.textContent = 'Steps'
    const semitoneInput = document.createElement('input')
    semitoneInput.type = 'number'
    semitoneInput.min = String(LIMITS.semitones[0])
    semitoneInput.max = String(LIMITS.semitones[1])
    semitoneInput.step = '1'
    semitoneInput.value = note.semitones
    semitoneInput.dataset.noteField = 'semitones'
    semitoneInput.setAttribute('aria-label', `Note ${index + 1} semitones`)
    semitoneLabel.append(semitoneInput)

    const remove = document.createElement('button')
    remove.className = 'note-remove'
    remove.type = 'button'
    remove.dataset.removeNote = String(index)
    remove.setAttribute('aria-label', `Remove note ${index + 1}`)
    remove.textContent = 'Remove'
    remove.disabled = level.melody.notes.length === 1

    row.append(number, idLabel, labelLabel, semitoneLabel, remove)
    fragment.append(row)
  })
  container.replaceChildren(fragment)
  byId('addNoteButton').disabled = level.melody.notes.length >= LIMITS.notes
}

function addLabeledControl(container, labelText, control) {
  const label = document.createElement('label')
  label.textContent = labelText
  label.append(control)
  container.append(label)
  return control
}

function selectControl(name, value, options) {
  const select = document.createElement('select')
  select.name = name
  options.forEach((option) => {
    const element = document.createElement('option')
    element.value = option.value
    element.textContent = option.label
    element.selected = String(value) === String(option.value)
    select.append(element)
  })
  return select
}

function numberControl(name, value, min, max, step) {
  const input = document.createElement('input')
  input.name = name
  input.type = 'number'
  input.value = value
  input.min = min
  input.max = max
  input.step = step
  return input
}

function renderAssetControl(piece, container) {
  const support =
    piece.kind === 'platform'
      ? `${piece.kind}:${piece.surface}`
      : `${piece.kind}:*`
  const supportedAssets = ASSET_CATALOG.filter((asset) =>
    asset.supports.includes(support),
  )
  if (supportedAssets.length === 0) return
  const options = [{ value: '', label: 'No asset preference' }]
  supportedAssets.forEach((asset) => {
    options.push({ value: asset.id, label: asset.label })
  })
  addLabeledControl(
    container,
    'Suggested asset',
    selectControl('assetId', piece.assetId || '', options),
  )
}

function renderBehaviorFields(piece) {
  behaviorContent.replaceChildren()
  const grid = document.createElement('div')
  grid.className = 'behavior-grid'

  if (piece.kind === 'platform') {
    addLabeledControl(
      grid,
      'Surface',
      selectControl(
        'surface',
        piece.surface,
        Object.entries(PLATFORM_TYPES).map(([value, item]) => ({
          value,
          label: item.label,
        })),
      ),
    )
    if (piece.surface === 'crackle') {
      addLabeledControl(
        grid,
        'Crackle timer',
        selectControl('crackleSeconds', piece.crackleSeconds, [
          { value: 2, label: '2 seconds' },
          { value: 4, label: '4 seconds' },
        ]),
      )
    }
    if (piece.surface === 'glide') {
      addLabeledControl(
        grid,
        'Travel axis',
        selectControl('motionAxis', piece.motion.axis, [
          { value: 'x', label: 'X axis' },
          { value: 'z', label: 'Z axis' },
        ]),
      )
      addLabeledControl(
        grid,
        'Travel distance',
        numberControl('motionTravel', piece.motion.travel, 0.5, 32, 0.25),
      )
      addLabeledControl(
        grid,
        'Round trip seconds',
        numberControl(
          'motionDuration',
          piece.motion.durationSeconds,
          0.25,
          60,
          0.25,
        ),
      )
    }
    if (piece.surface === 'scroll') {
      addLabeledControl(
        grid,
        'Extension axis',
        selectControl('motionAxis', piece.motion.axis, [
          { value: 'x', label: 'X axis' },
          { value: 'z', label: 'Z axis' },
        ]),
      )
      addLabeledControl(
        grid,
        'Retracted length ratio',
        numberControl(
          'minLengthRatio',
          piece.motion.minLengthRatio,
          0.1,
          0.95,
          0.05,
        ),
      )
      addLabeledControl(
        grid,
        'Extended rest',
        numberControl(
          'extendedSeconds',
          piece.motion.extendedSeconds,
          0.25,
          60,
          0.25,
        ),
      )
      addLabeledControl(
        grid,
        'Retracted rest',
        numberControl(
          'retractedSeconds',
          piece.motion.retractedSeconds,
          0.25,
          60,
          0.25,
        ),
      )
      addLabeledControl(
        grid,
        'Transition seconds',
        numberControl(
          'transitionSeconds',
          piece.motion.transitionSeconds,
          0.25,
          30,
          0.25,
        ),
      )
      addLabeledControl(
        grid,
        'Initial state',
        selectControl('initialState', piece.motion.initialState, [
          { value: 'retracted', label: 'Retracted' },
          { value: 'extended', label: 'Extended' },
        ]),
      )
    }
  } else if (piece.kind === 'marker') {
    addLabeledControl(
      grid,
      'Marker type',
      selectControl(
        'marker',
        piece.marker,
        Object.entries(MARKER_TYPES).map(([value, item]) => ({
          value,
          label: item.label,
        })),
      ),
    )
  } else {
    addLabeledControl(
      grid,
      'Melody note',
      selectControl(
        'melodyNoteId',
        piece.melodyNoteId,
        level.melody.notes.map((note) => ({
          value: note.id,
          label: `${note.label} (${note.semitones >= 0 ? '+' : ''}${note.semitones})`,
        })),
      ),
    )
    addLabeledControl(
      grid,
      'Hold seconds',
      numberControl('holdSeconds', piece.holdSeconds, 0.1, 12, 0.1),
    )
    const requirements = document.createElement('input')
    requirements.name = 'requiresCompletedIds'
    requirements.value = piece.requiresCompletedIds?.join(', ') || ''
    requirements.maxLength = LIMITS.idCharacters * LIMITS.requirements
    requirements.placeholder = 'piece-id, another-id'
    addLabeledControl(grid, 'Required completed IDs', requirements)
    const help = document.createElement('p')
    help.className = 'field-help'
    help.textContent =
      'Optional piece IDs, separated by commas. The editor validates every reference.'
    grid.append(help)
  }

  renderAssetControl(piece, grid)
  behaviorContent.append(grid)
}

function renderInspector() {
  const piece = selectedPiece()
  levelForm.hidden = piece !== null
  pieceForm.hidden = piece === null
  byId('selectionKind').hidden = piece === null
  if (!piece) {
    byId('inspectorSubhead').textContent = 'Level settings'
    renderLevelForm()
    return
  }

  byId('inspectorSubhead').textContent = piece.name
  byId('selectionKind').textContent = pieceTypeName(piece)
  byId('pieceNameInput').value = piece.name
  byId('pieceIdInput').value = piece.id
  byId('pieceXInput').value = piece.x
  byId('pieceYInput').value = piece.y
  byId('pieceZInput').value = piece.z
  byId('pieceWidthInput').value = piece.width
  byId('pieceDepthInput').value = piece.depth
  byId('pieceRotationInput').value = piece.rotation
  renderBehaviorFields(piece)
}

function renderChecks() {
  const notices = inspectGeometry(level)
  const warningCount = notices.filter(
    (notice) => notice.severity === 'warning',
  ).length
  byId('checksSummary').textContent =
    notices.length === 0
      ? 'No top-view issues found.'
      : `${warningCount} ${warningCount === 1 ? 'warning' : 'warnings'}, ${notices.length - warningCount} design notes.`
  const list = byId('checksList')
  const fragment = document.createDocumentFragment()
  if (notices.length === 0) {
    const item = document.createElement('li')
    item.className = 'check-item is-clear'
    item.textContent =
      'The bounded geometry checks are clear. Runtime playtesting is still required.'
    fragment.append(item)
  } else {
    notices.forEach((notice) => {
      const item = document.createElement('li')
      item.className = `check-item severity-${notice.severity}`
      const marker = document.createElement('span')
      marker.className = 'check-marker'
      marker.textContent = notice.severity === 'warning' ? '!' : 'i'
      if (notice.pieceId) {
        const button = document.createElement('button')
        button.type = 'button'
        button.dataset.selectCheckPiece = notice.pieceId
        button.textContent = notice.message
        item.append(marker, button)
      } else {
        const text = document.createElement('span')
        text.textContent = notice.message
        item.append(marker, text)
      }
      fragment.append(item)
    })
  }
  list.replaceChildren(fragment)
  list.hidden = !checksExpanded
  byId('toggleChecksButton').textContent = checksExpanded
    ? 'Hide notes'
    : 'Show notes'
  byId('toggleChecksButton').setAttribute(
    'aria-expanded',
    String(checksExpanded),
  )
}

function renderStatus() {
  byId('pieceCount').textContent =
    `${level.pieces.length} ${level.pieces.length === 1 ? 'piece' : 'pieces'}`
}

function renderAll() {
  renderGrid()
  renderPieces()
  renderCamera()
  renderHistoryButtons()
  renderSelectionActions()
  renderInspector()
  renderChecks()
  renderPaletteState()
  renderPlacementHint()
  renderStatus()
}

function pointerIsPrimaryAction(event) {
  return event.pointerType !== 'mouse' || event.button === 0
}

function startPan(event) {
  const point = clientToSvg(event.clientX, event.clientY)
  gesture = {
    type: 'pan',
    pointerId: event.pointerId,
    startPoint: point,
    startPanX: camera.panX,
    startPanY: camera.panY,
  }
  stageSvg.setPointerCapture(event.pointerId)
  stageViewport.classList.add('is-panning')
}

function startPieceDrag(event, piece) {
  selectedId = piece.id
  const point = clientToLevel(event.clientX, event.clientY)
  gesture = {
    type: 'drag',
    pointerId: event.pointerId,
    pieceId: piece.id,
    startPoint: point,
    startX: piece.x,
    startZ: piece.z,
    snapshot: JSON.stringify(level),
    moved: false,
  }
  stageSvg.setPointerCapture(event.pointerId)
  renderAll()
}

function startResize(event, piece) {
  selectedId = piece.id
  const point = clientToLevel(event.clientX, event.clientY)
  gesture = {
    type: 'resize',
    pointerId: event.pointerId,
    pieceId: piece.id,
    startPoint: point,
    startX: piece.x,
    startZ: piece.z,
    startWidth: piece.width,
    startDepth: piece.depth,
    rotation: piece.rotation,
    snapshot: JSON.stringify(level),
    moved: false,
  }
  stageSvg.setPointerCapture(event.pointerId)
}

function placeAt(event) {
  if (level.pieces.length >= LIMITS.pieces) {
    showToast(`A level may contain at most ${LIMITS.pieces} pieces.`)
    return
  }
  const point = clientToLevel(event.clientX, event.clientY)
  const usedIds = new Set(level.pieces.map((piece) => piece.id))
  const piece = makePiece(
    placement.kind,
    placement.subtype,
    snap(point.x),
    snap(point.z),
    usedIds,
  )
  if (piece.kind === 'voiceTarget')
    piece.melodyNoteId = level.melody.notes[0].id
  commit(`Placed ${piece.name}.`, () => {
    level.pieces.push(piece)
    selectedId = piece.id
  })
}

function onStagePointerDown(event) {
  if (gesture) return
  const pieceElement = event.target.closest?.('[data-piece-id]')
  const piece = pieceElement
    ? level.pieces.find(
        (candidate) => candidate.id === pieceElement.dataset.pieceId,
      )
    : null

  if (
    tool === 'pan' ||
    spaceHeld ||
    (event.pointerType === 'mouse' && event.button === 1)
  ) {
    event.preventDefault()
    startPan(event)
    return
  }
  if (!pointerIsPrimaryAction(event)) return
  event.preventDefault()
  if (placement) {
    placeAt(event)
    return
  }
  if (piece) {
    if (
      event.target.closest?.('[data-resize-handle]') &&
      piece.kind === 'platform'
    ) {
      startResize(event, piece)
    } else {
      startPieceDrag(event, piece)
    }
    return
  }
  selectedId = null
  renderAll()
  stageSvg.focus()
}

function onStagePointerMove(event) {
  const cursor = clientToLevel(event.clientX, event.clientY)
  byId('cursorPosition').textContent =
    `X ${snap(cursor.x)} · Z ${snap(cursor.z)}`
  if (!gesture || gesture.pointerId !== event.pointerId) return
  event.preventDefault()

  if (gesture.type === 'pan') {
    const point = clientToSvg(event.clientX, event.clientY)
    camera.panX = gesture.startPanX + point.x - gesture.startPoint.x
    camera.panY = gesture.startPanY + point.y - gesture.startPoint.y
    renderCamera()
    return
  }

  const piece = level.pieces.find(
    (candidate) => candidate.id === gesture.pieceId,
  )
  if (!piece) return
  const point = clientToLevel(event.clientX, event.clientY)
  const dx = point.x - gesture.startPoint.x
  const dz = point.z - gesture.startPoint.z

  if (gesture.type === 'drag') {
    const nextX = clamp(
      snap(gesture.startX + dx),
      LIMITS.coordinate[0],
      LIMITS.coordinate[1],
    )
    const nextZ = clamp(
      snap(gesture.startZ + dz),
      LIMITS.coordinate[0],
      LIMITS.coordinate[1],
    )
    gesture.moved ||= nextX !== gesture.startX || nextZ !== gesture.startZ
    piece.x = nextX
    piece.z = nextZ
    renderPieces()
    return
  }

  const radians = (gesture.rotation * Math.PI) / 180
  const localDx = dx * Math.cos(radians) + dz * Math.sin(radians)
  const localDz = -dx * Math.sin(radians) + dz * Math.cos(radians)
  const width = clamp(
    snap(gesture.startWidth + localDx),
    LIMITS.footprint[0],
    LIMITS.footprint[1],
  )
  const depth = clamp(
    snap(gesture.startDepth + localDz),
    LIMITS.footprint[0],
    LIMITS.footprint[1],
  )
  const widthDelta = width - gesture.startWidth
  const depthDelta = depth - gesture.startDepth
  const localShiftX = widthDelta / 2
  const localShiftZ = depthDelta / 2
  piece.width = width
  piece.depth = depth
  piece.x = snap(
    gesture.startX +
      localShiftX * Math.cos(radians) -
      localShiftZ * Math.sin(radians),
  )
  piece.z = snap(
    gesture.startZ +
      localShiftX * Math.sin(radians) +
      localShiftZ * Math.cos(radians),
  )
  gesture.moved ||= width !== gesture.startWidth || depth !== gesture.startDepth
  renderPieces()
}

function finishGesture(event, cancelled = false) {
  if (!gesture || gesture.pointerId !== event.pointerId) return
  const finished = gesture
  gesture = null
  stageViewport.classList.remove('is-panning')
  if (stageSvg.hasPointerCapture(event.pointerId))
    stageSvg.releasePointerCapture(event.pointerId)
  if (cancelled && finished.snapshot) {
    level = JSON.parse(finished.snapshot)
    renderAll()
    announceGrid('Gesture cancelled.')
    return
  }
  if (finished.type === 'drag' && finished.moved) {
    commitGesture(
      finished.snapshot,
      `Moved ${selectedPiece()?.name || 'piece'}.`,
    )
  } else if (finished.type === 'resize' && finished.moved) {
    commitGesture(
      finished.snapshot,
      `Resized ${selectedPiece()?.name || 'piece'}.`,
    )
  } else {
    renderAll()
  }
}

function rotateSelected() {
  const piece = selectedPiece()
  if (!piece) return
  commit(`Rotated ${piece.name}.`, () => {
    piece.rotation = (piece.rotation + 90) % 360
  })
}

function duplicateSelected() {
  const piece = selectedPiece()
  if (!piece || level.pieces.length >= LIMITS.pieces) return
  const copy = clone(piece)
  const usedIds = new Set(level.pieces.map((candidate) => candidate.id))
  const stem = piece.id
    .replace(/-copy(?:-\d+)?$/, '')
    .slice(0, LIMITS.idCharacters - 5)
  let suffix = 1
  let id = `${stem}-copy`
  while (usedIds.has(id)) {
    suffix += 1
    const ending = `-copy-${suffix}`
    id = `${stem.slice(0, LIMITS.idCharacters - ending.length)}${ending}`
  }
  copy.id = id
  copy.name = `${piece.name} copy`.slice(0, LIMITS.nameCharacters)
  copy.x = clamp(
    snap(piece.x + level.grid.cellSize),
    LIMITS.coordinate[0],
    LIMITS.coordinate[1],
  )
  copy.z = clamp(
    snap(piece.z + level.grid.cellSize),
    LIMITS.coordinate[0],
    LIMITS.coordinate[1],
  )
  commit(`Duplicated ${piece.name}.`, () => {
    level.pieces.push(copy)
    selectedId = copy.id
  })
}

function deleteSelected() {
  const piece = selectedPiece()
  if (!piece) return
  commit(`Deleted ${piece.name}.`, () => {
    level.pieces = level.pieces.filter((candidate) => candidate.id !== piece.id)
    level.pieces.forEach((candidate) => {
      if (candidate.kind !== 'voiceTarget' || !candidate.requiresCompletedIds)
        return
      candidate.requiresCompletedIds = candidate.requiresCompletedIds.filter(
        (id) => id !== piece.id,
      )
      if (candidate.requiresCompletedIds.length === 0)
        delete candidate.requiresCompletedIds
    })
    selectedId = null
  })
}

function onStageWheel(event) {
  event.preventDefault()
  const point = clientToSvg(event.clientX, event.clientY)
  const factor = event.deltaY < 0 ? 1.1 : 0.9
  zoomAt(camera.zoom * factor, point.x, point.y)
}

function inputIsEditingTarget(target) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

function onKeyDown(event) {
  if (inputIsEditingTarget(event.target)) return
  if (event.key === ' ') {
    spaceHeld = true
    stageViewport.classList.add('space-pan-ready')
    event.preventDefault()
    return
  }
  const command = event.ctrlKey || event.metaKey
  if (command && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    if (event.shiftKey) redo()
    else undo()
    return
  }
  if (command && event.key.toLowerCase() === 'd') {
    event.preventDefault()
    duplicateSelected()
    return
  }
  if (event.key === 'Escape') {
    placement = null
    selectedId = null
    setTool('select')
    renderAll()
    return
  }
  if (
    (event.key === 'Delete' || event.key === 'Backspace') &&
    selectedPiece()
  ) {
    event.preventDefault()
    deleteSelected()
    return
  }
  if (event.key.toLowerCase() === 'r' && selectedPiece()) {
    event.preventDefault()
    rotateSelected()
    return
  }
  if (
    selectedPiece() &&
    ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
  ) {
    event.preventDefault()
    const piece = selectedPiece()
    const distance = event.shiftKey
      ? level.grid.cellSize * 4
      : level.grid.cellSize
    commit(`Moved ${piece.name}.`, () => {
      if (event.key === 'ArrowLeft')
        piece.x = clamp(piece.x - distance, -96, 96)
      if (event.key === 'ArrowRight')
        piece.x = clamp(piece.x + distance, -96, 96)
      if (event.key === 'ArrowUp') piece.z = clamp(piece.z - distance, -96, 96)
      if (event.key === 'ArrowDown')
        piece.z = clamp(piece.z + distance, -96, 96)
    })
  }
}

function onKeyUp(event) {
  if (event.key === ' ') {
    spaceHeld = false
    stageViewport.classList.remove('space-pan-ready')
  }
}

function validId(value) {
  return /^[a-z0-9][a-z0-9-]{0,47}$/.test(value)
}

function boundedInputNumber(input, range) {
  const value = Number(input.value)
  if (!Number.isFinite(value)) return null
  return clamp(value, range[0], range[1])
}

function updateLevelField(input) {
  const field = input.name
  if (
    (field === 'levelId' || field === 'melodyId') &&
    !validId(input.value.trim())
  ) {
    input.reportValidity()
    showToast('IDs use lowercase letters, numbers, and hyphens.')
    renderLevelForm()
    return
  }
  if (
    (field === 'levelTitle' || field === 'melodyTitle') &&
    !input.value.trim()
  ) {
    showToast('Titles cannot be empty.')
    renderLevelForm()
    return
  }
  commit('Updated level settings.', () => {
    if (field === 'levelTitle') level.title = input.value.trim()
    if (field === 'levelId') level.id = input.value.trim()
    if (field === 'melodyTitle') level.melody.title = input.value.trim()
    if (field === 'melodyId') level.melody.id = input.value.trim()
    if (field === 'gridWidth') {
      const value = boundedInputNumber(input, LIMITS.gridWidth)
      if (value !== null) level.grid.width = value
    }
    if (field === 'gridDepth') {
      const value = boundedInputNumber(input, LIMITS.gridDepth)
      if (value !== null) level.grid.depth = value
    }
    if (field === 'gridCell') level.grid.cellSize = Number(input.value)
  })
}

function updatePieceField(input) {
  const piece = selectedPiece()
  if (!piece) return
  const field = input.name
  const text = input.value.trim()
  if (field === 'pieceId') {
    if (
      !validId(text) ||
      level.pieces.some(
        (candidate) => candidate.id === text && candidate !== piece,
      )
    ) {
      showToast('Piece IDs must be unique lowercase slugs.')
      renderInspector()
      return
    }
  }
  if (field === 'pieceName' && !text) {
    showToast('Piece names cannot be empty.')
    renderInspector()
    return
  }
  const oldId = piece.id
  commit(`Updated ${piece.name}.`, () => {
    if (field === 'pieceName') piece.name = text
    if (field === 'pieceId') {
      piece.id = text
      selectedId = text
      level.pieces.forEach((candidate) => {
        if (candidate.kind !== 'voiceTarget' || !candidate.requiresCompletedIds)
          return
        candidate.requiresCompletedIds = candidate.requiresCompletedIds.map(
          (id) => (id === oldId ? text : id),
        )
      })
    }
    const numberFields = {
      pieceX: ['x', LIMITS.coordinate],
      pieceY: ['y', LIMITS.elevation],
      pieceZ: ['z', LIMITS.coordinate],
      pieceWidth: ['width', LIMITS.footprint],
      pieceDepth: ['depth', LIMITS.footprint],
    }
    if (numberFields[field]) {
      const [property, range] = numberFields[field]
      const value = boundedInputNumber(input, range)
      if (value !== null) piece[property] = snap(value)
    }
    if (field === 'pieceRotation') piece.rotation = Number(input.value)
  })
}

function defaultMotionForSurface(surface) {
  if (surface === 'glide') return { axis: 'x', travel: 4, durationSeconds: 4 }
  if (surface === 'scroll') {
    return {
      axis: 'x',
      minLengthRatio: 0.25,
      extendedSeconds: 4,
      retractedSeconds: 3,
      transitionSeconds: 1.5,
      initialState: 'retracted',
    }
  }
  return undefined
}

function updateBehaviorField(input) {
  const piece = selectedPiece()
  if (!piece) return
  const field = input.name
  const value = input.value
  if (field === 'requiresCompletedIds') {
    const ids = value
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
    const unique = [...new Set(ids)]
    const invalid = unique.find(
      (id) =>
        !validId(id) ||
        id === piece.id ||
        !level.pieces.some((candidate) => candidate.id === id),
    )
    if (invalid || unique.length > LIMITS.requirements) {
      showToast(
        invalid
          ? `Unknown or invalid requirement: ${invalid}`
          : 'Too many required IDs.',
      )
      renderInspector()
      return
    }
    commit(`Updated ${piece.name}.`, () => {
      if (unique.length > 0) piece.requiresCompletedIds = unique
      else delete piece.requiresCompletedIds
    })
    return
  }

  commit(`Updated ${piece.name}.`, () => {
    if (field === 'assetId') {
      if (value) piece.assetId = value
      else delete piece.assetId
    }
    if (field === 'surface') {
      piece.surface = value
      delete piece.crackleSeconds
      delete piece.motion
      if (value === 'crackle') piece.crackleSeconds = 2
      const motion = defaultMotionForSurface(value)
      if (motion) piece.motion = motion
      piece.assetId = ASSET_CATALOG.find((asset) =>
        asset.supports.includes(`platform:${value}`),
      )?.id
    }
    if (field === 'crackleSeconds') {
      piece.crackleSeconds = Number(value)
      if (
        ['rose-quartz-crackle-fast', 'amethyst-crackle-slow'].includes(
          piece.assetId,
        )
      ) {
        piece.assetId =
          piece.crackleSeconds === 4
            ? 'amethyst-crackle-slow'
            : 'rose-quartz-crackle-fast'
      }
    }
    if (field === 'marker') piece.marker = value
    if (field === 'melodyNoteId') piece.melodyNoteId = value
    if (field === 'holdSeconds')
      piece.holdSeconds = clamp(Number(value), 0.1, 12)
    if (field === 'motionAxis') piece.motion.axis = value
    if (field === 'motionTravel')
      piece.motion.travel = clamp(Number(value), 0.5, 32)
    if (field === 'motionDuration')
      piece.motion.durationSeconds = clamp(Number(value), 0.25, 60)
    if (field === 'minLengthRatio')
      piece.motion.minLengthRatio = clamp(Number(value), 0.1, 0.95)
    if (field === 'extendedSeconds')
      piece.motion.extendedSeconds = clamp(Number(value), 0.25, 60)
    if (field === 'retractedSeconds')
      piece.motion.retractedSeconds = clamp(Number(value), 0.25, 60)
    if (field === 'transitionSeconds')
      piece.motion.transitionSeconds = clamp(Number(value), 0.25, 30)
    if (field === 'initialState') piece.motion.initialState = value
  })
}

function updateNoteField(input) {
  const row = input.closest('[data-note-index]')
  const index = Number(row.dataset.noteIndex)
  const note = level.melody.notes[index]
  if (!note) return
  const field = input.dataset.noteField
  const value = input.value.trim()
  if (field === 'id') {
    if (
      !validId(value) ||
      level.melody.notes.some(
        (candidate) => candidate.id === value && candidate !== note,
      )
    ) {
      showToast('Melody note IDs must be unique lowercase slugs.')
      renderNotesEditor()
      return
    }
  }
  if (field === 'label' && !value) {
    showToast('Note labels cannot be empty.')
    renderNotesEditor()
    return
  }
  const oldId = note.id
  commit('Updated melody note.', () => {
    if (field === 'id') {
      note.id = value
      level.pieces.forEach((piece) => {
        if (piece.kind === 'voiceTarget' && piece.melodyNoteId === oldId)
          piece.melodyNoteId = value
      })
    }
    if (field === 'label') note.label = value
    if (field === 'semitones') {
      note.semitones = clamp(
        Number(input.value),
        LIMITS.semitones[0],
        LIMITS.semitones[1],
      )
    }
  })
}

function addMelodyNote() {
  if (level.melody.notes.length >= LIMITS.notes) return
  const ids = new Set(level.melody.notes.map((note) => note.id))
  let index = level.melody.notes.length + 1
  while (ids.has(`note-${index}`)) index += 1
  commit('Added melody note.', () => {
    level.melody.notes.push({
      id: `note-${index}`,
      label: `Note ${index}`,
      semitones: 0,
    })
  })
}

function removeMelodyNote(index) {
  if (level.melody.notes.length <= 1) return
  const removed = level.melody.notes[index]
  const fallback = level.melody.notes.find(
    (_, candidateIndex) => candidateIndex !== index,
  )
  commit(`Removed ${removed.label}.`, () => {
    level.melody.notes.splice(index, 1)
    level.pieces.forEach((piece) => {
      if (piece.kind === 'voiceTarget' && piece.melodyNoteId === removed.id) {
        piece.melodyNoteId = fallback.id
      }
    })
  })
}

function saveDraft() {
  try {
    const text = serializeLevel(level)
    localStorage.setItem(DRAFT_KEY, text)
    const time = new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date())
    updateSaveStatus(`Draft saved at ${time}`)
    showToast('Draft saved in this browser.')
  } catch (error) {
    showToast(error.message)
  }
}

function loadDraft() {
  const text = localStorage.getItem(DRAFT_KEY)
  if (!text) {
    showToast('No local draft is saved in this browser.')
    return
  }
  const parsed = parseLevelJson(text)
  if (parsed.errors.length > 0) {
    showToast(`Saved draft is invalid: ${parsed.errors[0]}`)
    return
  }
  replaceLevel(parsed.level, 'Loaded local draft.')
  updateSaveStatus('Local draft loaded')
}

function renderImportErrors(errors) {
  const container = byId('importErrors')
  if (errors.length === 0) {
    container.hidden = true
    container.replaceChildren()
    return
  }
  const heading = document.createElement('strong')
  heading.textContent = 'Import stopped'
  const list = document.createElement('ul')
  errors.slice(0, 20).forEach((error) => {
    const item = document.createElement('li')
    item.textContent = error
    list.append(item)
  })
  if (errors.length > 20) {
    const item = document.createElement('li')
    item.textContent = `${errors.length - 20} more errors were omitted.`
    list.append(item)
  }
  container.replaceChildren(heading, list)
  container.hidden = false
}

function importLevel() {
  const parsed = parseLevelJson(byId('importText').value)
  renderImportErrors(parsed.errors)
  if (parsed.errors.length > 0) return
  replaceLevel(parsed.level, 'Imported level JSON.')
  importDialog.close()
  showToast('Level imported and validated.')
}

function openExport() {
  try {
    byId('exportText').value = serializeLevel(level)
    exportDialog.showModal()
  } catch (error) {
    showToast(error.message)
  }
}

async function copyExport() {
  const text = byId('exportText').value
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    byId('exportText').select()
    document.execCommand('copy')
  }
  showToast('JSON copied.')
}

function downloadExport() {
  const text = byId('exportText').value
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${level.id}.json`
  link.click()
  URL.revokeObjectURL(url)
  showToast('JSON download started.')
}

function bindEvents() {
  document.querySelectorAll('[data-create-kind]').forEach((button) => {
    button.addEventListener('click', () => {
      setPlacement(button.dataset.createKind, button.dataset.createSubtype)
    })
  })
  byId('selectToolButton').addEventListener('click', () => setTool('select'))
  byId('panToolButton').addEventListener('click', () => setTool('pan'))
  byId('undoButton').addEventListener('click', undo)
  byId('redoButton').addEventListener('click', redo)
  byId('rotateButton').addEventListener('click', rotateSelected)
  byId('duplicateButton').addEventListener('click', duplicateSelected)
  byId('deleteButton').addEventListener('click', deleteSelected)
  byId('zoomOutButton').addEventListener('click', () =>
    zoomAt(camera.zoom * 0.85),
  )
  byId('zoomInButton').addEventListener('click', () =>
    zoomAt(camera.zoom * 1.15),
  )
  byId('fitButton').addEventListener('click', fitView)
  byId('newLevelButton').addEventListener('click', () =>
    replaceLevel(createEmptyLevel(), 'Started a blank level.'),
  )
  byId('demoLevelButton').addEventListener('click', () =>
    replaceLevel(createDemoLevel(), 'Restored exploratory demo.'),
  )
  byId('saveDraftButton').addEventListener('click', saveDraft)
  byId('loadDraftButton').addEventListener('click', loadDraft)
  byId('shortcutsButton').addEventListener('click', () =>
    shortcutsDialog.showModal(),
  )
  byId('toggleChecksButton').addEventListener('click', () => {
    checksExpanded = !checksExpanded
    renderChecks()
  })
  byId('checksList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-select-check-piece]')
    if (!button) return
    selectedId = button.dataset.selectCheckPiece
    setTool('select')
    renderAll()
  })

  stageSvg.addEventListener('pointerdown', onStagePointerDown)
  stageSvg.addEventListener('pointermove', onStagePointerMove)
  stageSvg.addEventListener('pointerup', (event) => finishGesture(event, false))
  stageSvg.addEventListener('pointercancel', (event) =>
    finishGesture(event, true),
  )
  stageSvg.addEventListener('wheel', onStageWheel, { passive: false })
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', () => {
    spaceHeld = false
    stageViewport.classList.remove('space-pan-ready')
  })

  levelForm.addEventListener('change', (event) => {
    if (event.target.matches('input, select')) updateLevelField(event.target)
  })
  pieceForm.addEventListener('change', (event) => {
    const input = event.target
    if (!input.matches('input, select')) return
    if (input.closest('#behaviorContent')) updateBehaviorField(input)
    else updatePieceField(input)
  })
  byId('notesEditor').addEventListener('change', (event) => {
    if (event.target.matches('[data-note-field]')) updateNoteField(event.target)
  })
  byId('notesEditor').addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-note]')
    if (button) removeMelodyNote(Number(button.dataset.removeNote))
  })
  byId('addNoteButton').addEventListener('click', addMelodyNote)

  byId('importButton').addEventListener('click', () => {
    byId('importText').value = ''
    byId('importFileInput').value = ''
    renderImportErrors([])
    importDialog.showModal()
  })
  byId('importFileInput').addEventListener('change', async (event) => {
    const file = event.target.files[0]
    if (!file) return
    if (file.size > LIMITS.jsonCharacters) {
      renderImportErrors([
        `File is larger than ${LIMITS.jsonCharacters.toLocaleString()} bytes.`,
      ])
      return
    }
    byId('importText').value = await file.text()
    renderImportErrors([])
  })
  byId('confirmImportButton').addEventListener('click', importLevel)
  byId('exportButton').addEventListener('click', openExport)
  byId('copyExportButton').addEventListener('click', copyExport)
  byId('downloadExportButton').addEventListener('click', downloadExport)
}

bindEvents()
fitView()
renderAll()

// Browser tests use this read-only snapshot instead of reaching into mutable editor state.
window.__CLOUDWAY_LEVEL_STUDIO__ = Object.freeze({
  snapshot: () => clone(level),
  validate: () => sanitizeLevel(level),
})

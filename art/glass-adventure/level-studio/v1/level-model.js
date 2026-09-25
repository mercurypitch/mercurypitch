// ============================================================
// Cloudway level model — bounded v1 design-spec schema and geometry checks
// ============================================================

export const SCHEMA_ID = 'mercurypitch.cloudway-level'
export const SCHEMA_VERSION = 1

export const LIMITS = Object.freeze({
  jsonCharacters: 300_000,
  pieces: 256,
  notes: 32,
  idCharacters: 48,
  titleCharacters: 80,
  nameCharacters: 64,
  gridWidth: [8, 96],
  gridDepth: [8, 72],
  cellSize: [0.25, 4],
  coordinate: [-96, 96],
  elevation: [-12, 48],
  footprint: [0.5, 24],
  travel: [0.5, 32],
  duration: [0.25, 60],
  transition: [0.25, 30],
  lengthRatio: [0.1, 0.95],
  hold: [0.1, 12],
  semitones: [-24, 24],
  requirements: 16,
})

export const ASSET_CATALOG = Object.freeze([
  {
    id: 'pearl-marble-long',
    label: 'Pearl marble long deck',
    supports: ['platform:stable'],
  },
  {
    id: 'emerald-square-turn',
    label: 'Emerald square turn',
    supports: ['platform:stable'],
  },
  {
    id: 'moonstone-cross-landing',
    label: 'Moonstone cross landing',
    supports: ['platform:stable'],
  },
  {
    id: 'ivory-stair-terrace',
    label: 'Ivory stair terrace',
    supports: ['platform:stable'],
  },
  {
    id: 'opal-glass-long-bridge',
    label: 'Opal glass long bridge',
    supports: ['platform:stable'],
  },
  {
    id: 'rose-quartz-crackle-fast',
    label: 'Rose quartz crackle, 2s',
    supports: ['platform:crackle'],
  },
  {
    id: 'amethyst-crackle-slow',
    label: 'Amethyst crackle, 4s',
    supports: ['platform:crackle'],
  },
  {
    id: 'frost-lily-step',
    label: 'Frost lily step',
    supports: ['platform:frost'],
  },
  {
    id: 'aurora-glide-raft',
    label: 'Aurora glide raft',
    supports: ['platform:glide'],
  },
  {
    id: 'gilt-scroll-bridge',
    label: 'Gilt scroll bridge',
    supports: ['platform:scroll'],
  },
])

const ASSETS_BY_ID = new Map(ASSET_CATALOG.map((asset) => [asset.id, asset]))

export const PLATFORM_TYPES = Object.freeze({
  stable: {
    label: 'Stable pad',
    shortLabel: 'Stable',
    description: 'A plain, dependable landing surface.',
    defaultSize: [4, 3],
  },
  crackle: {
    label: 'Crackle step',
    shortLabel: 'Crackle',
    description: 'A timed rose-glass step with a 2s or 4s break cue.',
    defaultSize: [2, 2],
  },
  frost: {
    label: 'Frost sheet',
    shortLabel: 'Frost',
    description: 'A slippery or frosted route surface.',
    defaultSize: [4, 2],
  },
  glide: {
    label: 'Glide platform',
    shortLabel: 'Glide',
    description: 'A platform that travels back and forth along one axis.',
    defaultSize: [3, 2],
  },
  scroll: {
    label: 'Scroll bridge',
    shortLabel: 'Scroll',
    description: 'A bridge that extends and retracts along one axis.',
    defaultSize: [5, 2],
  },
})

export const MARKER_TYPES = Object.freeze({
  spawn: {
    label: 'Spawn',
    description: 'The player start position.',
  },
  checkpoint: {
    label: 'Checkpoint',
    description: 'A safe recovery position.',
  },
  exit: {
    label: 'Exit',
    description: 'The intended level finish.',
  },
})

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/
const ROTATIONS = new Set([0, 90, 180, 270])
const AXES = new Set(['x', 'z'])
const INITIAL_STATES = new Set(['extended', 'retracted'])

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function inRange(value, range) {
  return finiteNumber(value) && value >= range[0] && value <= range[1]
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function safeString(value, label, max, errors, { id = false } = {}) {
  const result = cleanString(value)
  if (!result) errors.push(`${label} is required.`)
  if (result.length > max)
    errors.push(`${label} must be ${max} characters or fewer.`)
  if (id && result && !ID_PATTERN.test(result)) {
    errors.push(`${label} must use lowercase letters, numbers, and hyphens.`)
  }
  return result.slice(0, max)
}

function safeNumber(value, label, range, errors, fallback) {
  if (!inRange(value, range)) {
    errors.push(
      `${label} must be a finite number from ${range[0]} to ${range[1]}.`,
    )
    return fallback
  }
  return value
}

function defaultAssetId(kind, subtype) {
  if (kind !== 'platform') return undefined
  return {
    stable: 'emerald-square-turn',
    crackle: 'rose-quartz-crackle-fast',
    frost: 'frost-lily-step',
    glide: 'aurora-glide-raft',
    scroll: 'gilt-scroll-bridge',
  }[subtype]
}

function platform(id, name, surface, x, z, width, depth, extras = {}) {
  return {
    id,
    kind: 'platform',
    name,
    x,
    y: 0,
    z,
    width,
    depth,
    rotation: 0,
    surface,
    assetId: defaultAssetId('platform', surface),
    ...extras,
  }
}

function marker(id, name, markerType, x, z) {
  return {
    id,
    kind: 'marker',
    name,
    x,
    y: 0,
    z,
    width: 1,
    depth: 1,
    rotation: 0,
    marker: markerType,
    assetId: defaultAssetId('marker', markerType),
  }
}

function voiceTarget(id, name, x, z, melodyNoteId, holdSeconds = 1.2) {
  return {
    id,
    kind: 'voiceTarget',
    name,
    x,
    y: 0,
    z,
    width: 1,
    depth: 1,
    rotation: 0,
    melodyNoteId,
    holdSeconds,
    assetId: defaultAssetId('voiceTarget', 'voiceTarget'),
  }
}

export function createDemoLevel() {
  return {
    schema: SCHEMA_ID,
    schemaVersion: SCHEMA_VERSION,
    id: 'rose-step-exploration',
    title: 'Rose Step Exploration',
    grid: { width: 32, depth: 22, cellSize: 1 },
    melody: {
      id: 'open-sky-three',
      title: 'Open Sky Three',
      notes: [
        { id: 'home', label: 'Home', semitones: 0 },
        { id: 'third', label: 'Third', semitones: 4 },
        { id: 'fifth', label: 'Fifth', semitones: 7 },
      ],
    },
    pieces: [
      platform('arrival-pad', 'Arrival pad', 'stable', -12, 3, 5, 5),
      platform('approach-deck', 'Approach deck', 'stable', -7.5, 3, 4, 3),
      platform(
        'rose-crackle-two',
        'Rose crackle, quick',
        'crackle',
        -4.5,
        3,
        2,
        2,
        {
          crackleSeconds: 2,
        },
      ),
      platform('middle-rest', 'Middle rest', 'stable', -1.5, 0, 4, 4),
      platform(
        'rose-crackle-four',
        'Rose crackle, patient',
        'crackle',
        1.5,
        -2,
        2,
        2,
        {
          crackleSeconds: 4,
          assetId: 'amethyst-crackle-slow',
        },
      ),
      platform('final-pad', 'Final pad', 'stable', 5, -2, 5, 5),
      platform('frost-spur', 'Frost spur', 'frost', -3, -6, 6, 2),
      platform('glide-spur', 'Glide return', 'glide', 3, -6, 3, 2, {
        motion: { axis: 'z', travel: 4, durationSeconds: 3.5 },
      }),
      platform(
        'scroll-bridge',
        'Scroll bridge study',
        'scroll',
        9,
        -5.5,
        6,
        2,
        {
          motion: {
            axis: 'x',
            minLengthRatio: 0.25,
            extendedSeconds: 4,
            retractedSeconds: 3,
            transitionSeconds: 1.5,
            initialState: 'retracted',
          },
        },
      ),
      marker('spawn-main', 'Spawn', 'spawn', -13, 3),
      marker('checkpoint-middle', 'Middle checkpoint', 'checkpoint', -1.5, 0),
      marker('exit-main', 'Exit', 'exit', 6, -2),
      voiceTarget('voice-home', 'Home note', -11, 3, 'home'),
      voiceTarget('voice-third', 'Third note', -1.5, 0, 'third'),
      voiceTarget('voice-fifth', 'Fifth note', 5, -2, 'fifth'),
    ],
  }
}

export function createEmptyLevel() {
  const empty = createDemoLevel()
  empty.id = 'untitled-cloudway'
  empty.title = 'Untitled Cloudway'
  empty.melody = {
    id: 'untitled-melody',
    title: 'Untitled melody',
    notes: [{ id: 'home', label: 'Home', semitones: 0 }],
  }
  empty.pieces = []
  return empty
}

function sanitizeMotion(raw, prefix, errors, mode) {
  if (!isRecord(raw)) {
    errors.push(`${prefix}.motion is required.`)
    if (mode === 'scroll') {
      return {
        axis: 'x',
        minLengthRatio: 0.25,
        extendedSeconds: 4,
        retractedSeconds: 3,
        transitionSeconds: 1.5,
        initialState: 'retracted',
      }
    }
    return {
      axis: 'x',
      travel: 4,
      durationSeconds: 4,
    }
  }

  const axis = AXES.has(raw.axis) ? raw.axis : 'x'
  if (!AXES.has(raw.axis)) errors.push(`${prefix}.motion.axis must be x or z.`)
  const motion = { axis }
  if (mode === 'scroll') {
    motion.minLengthRatio = safeNumber(
      raw.minLengthRatio,
      `${prefix}.motion.minLengthRatio`,
      LIMITS.lengthRatio,
      errors,
      0.25,
    )
    motion.extendedSeconds = safeNumber(
      raw.extendedSeconds,
      `${prefix}.motion.extendedSeconds`,
      LIMITS.duration,
      errors,
      4,
    )
    motion.retractedSeconds = safeNumber(
      raw.retractedSeconds,
      `${prefix}.motion.retractedSeconds`,
      LIMITS.duration,
      errors,
      3,
    )
    motion.transitionSeconds = safeNumber(
      raw.transitionSeconds,
      `${prefix}.motion.transitionSeconds`,
      LIMITS.transition,
      errors,
      1.5,
    )
    motion.initialState = INITIAL_STATES.has(raw.initialState)
      ? raw.initialState
      : 'retracted'
    if (!INITIAL_STATES.has(raw.initialState)) {
      errors.push(
        `${prefix}.motion.initialState must be extended or retracted.`,
      )
    }
  } else {
    motion.travel = safeNumber(
      raw.travel,
      `${prefix}.motion.travel`,
      LIMITS.travel,
      errors,
      4,
    )
    motion.durationSeconds = safeNumber(
      raw.durationSeconds,
      `${prefix}.motion.durationSeconds`,
      LIMITS.duration,
      errors,
      4,
    )
  }
  return motion
}

function sanitizePiece(raw, index, errors, seenIds, noteIds, declaredPieceIds) {
  const prefix = `pieces[${index}]`
  if (!isRecord(raw)) {
    errors.push(`${prefix} must be an object.`)
    return null
  }

  const id = safeString(raw.id, `${prefix}.id`, LIMITS.idCharacters, errors, {
    id: true,
  })
  if (id && seenIds.has(id)) errors.push(`${prefix}.id duplicates "${id}".`)
  seenIds.add(id)

  const kind = ['platform', 'marker', 'voiceTarget'].includes(raw.kind)
    ? raw.kind
    : 'platform'
  if (!['platform', 'marker', 'voiceTarget'].includes(raw.kind)) {
    errors.push(`${prefix}.kind must be platform, marker, or voiceTarget.`)
  }

  const piece = {
    id,
    kind,
    name: safeString(raw.name, `${prefix}.name`, LIMITS.nameCharacters, errors),
    x: safeNumber(raw.x, `${prefix}.x`, LIMITS.coordinate, errors, 0),
    y: safeNumber(raw.y, `${prefix}.y`, LIMITS.elevation, errors, 0),
    z: safeNumber(raw.z, `${prefix}.z`, LIMITS.coordinate, errors, 0),
    width: safeNumber(
      raw.width,
      `${prefix}.width`,
      LIMITS.footprint,
      errors,
      2,
    ),
    depth: safeNumber(
      raw.depth,
      `${prefix}.depth`,
      LIMITS.footprint,
      errors,
      2,
    ),
    rotation: ROTATIONS.has(raw.rotation) ? raw.rotation : 0,
  }
  if (!ROTATIONS.has(raw.rotation)) {
    errors.push(`${prefix}.rotation must be 0, 90, 180, or 270.`)
  }

  if (kind === 'platform') {
    const surface = Object.hasOwn(PLATFORM_TYPES, raw.surface)
      ? raw.surface
      : 'stable'
    if (!Object.hasOwn(PLATFORM_TYPES, raw.surface)) {
      errors.push(`${prefix}.surface is not a supported platform type.`)
    }
    piece.surface = surface
    if (surface === 'crackle') {
      piece.crackleSeconds = raw.crackleSeconds === 4 ? 4 : 2
      if (raw.crackleSeconds !== 2 && raw.crackleSeconds !== 4) {
        errors.push(`${prefix}.crackleSeconds must be 2 or 4.`)
      }
    }
    if (surface === 'glide')
      piece.motion = sanitizeMotion(raw.motion, prefix, errors, 'glide')
    if (surface === 'scroll')
      piece.motion = sanitizeMotion(raw.motion, prefix, errors, 'scroll')
  }

  if (kind === 'marker') {
    const markerType = Object.hasOwn(MARKER_TYPES, raw.marker)
      ? raw.marker
      : 'checkpoint'
    if (!Object.hasOwn(MARKER_TYPES, raw.marker)) {
      errors.push(`${prefix}.marker must be spawn, checkpoint, or exit.`)
    }
    piece.marker = markerType
  }

  if (kind === 'voiceTarget') {
    piece.melodyNoteId = safeString(
      raw.melodyNoteId,
      `${prefix}.melodyNoteId`,
      LIMITS.idCharacters,
      errors,
      { id: true },
    )
    if (piece.melodyNoteId && !noteIds.has(piece.melodyNoteId)) {
      errors.push(`${prefix}.melodyNoteId references an unknown melody note.`)
    }
    piece.holdSeconds = safeNumber(
      raw.holdSeconds,
      `${prefix}.holdSeconds`,
      LIMITS.hold,
      errors,
      1.2,
    )
    if (raw.requiresCompletedIds !== undefined) {
      if (!Array.isArray(raw.requiresCompletedIds)) {
        errors.push(
          `${prefix}.requiresCompletedIds must be an array when provided.`,
        )
      } else {
        if (raw.requiresCompletedIds.length > LIMITS.requirements) {
          errors.push(
            `${prefix}.requiresCompletedIds may contain at most ${LIMITS.requirements} IDs.`,
          )
        }
        const requirements = []
        const seenRequirements = new Set()
        raw.requiresCompletedIds
          .slice(0, LIMITS.requirements)
          .forEach((rawId, requirementIndex) => {
            const requirementId = safeString(
              rawId,
              `${prefix}.requiresCompletedIds[${requirementIndex}]`,
              LIMITS.idCharacters,
              errors,
              { id: true },
            )
            if (requirementId === id) {
              errors.push(
                `${prefix}.requiresCompletedIds cannot reference the voice target itself.`,
              )
            } else if (requirementId && !declaredPieceIds.has(requirementId)) {
              errors.push(
                `${prefix}.requiresCompletedIds references unknown piece "${requirementId}".`,
              )
            } else if (seenRequirements.has(requirementId)) {
              errors.push(
                `${prefix}.requiresCompletedIds repeats "${requirementId}".`,
              )
            } else if (requirementId) {
              requirements.push(requirementId)
              seenRequirements.add(requirementId)
            }
          })
        if (requirements.length > 0) piece.requiresCompletedIds = requirements
      }
    }
  }

  if (raw.assetId !== undefined && raw.assetId !== '') {
    const assetId = safeString(
      raw.assetId,
      `${prefix}.assetId`,
      LIMITS.idCharacters,
      errors,
      { id: true },
    )
    const asset = ASSETS_BY_ID.get(assetId)
    if (!asset) {
      errors.push(`${prefix}.assetId is not in the v1 curated asset catalog.`)
    } else {
      const subtype = kind === 'platform' ? piece.surface : '*'
      if (
        !asset.supports.includes(`${kind}:${subtype}`) &&
        !asset.supports.includes(`${kind}:*`)
      ) {
        errors.push(`${prefix}.assetId does not support this piece type.`)
      } else {
        piece.assetId = assetId
      }
    }
  }

  return piece
}

export function sanitizeLevel(raw) {
  const errors = []
  if (!isRecord(raw))
    return { level: null, errors: ['The JSON root must be an object.'] }

  if (raw.schema !== SCHEMA_ID) errors.push(`schema must be "${SCHEMA_ID}".`)
  if (raw.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${SCHEMA_VERSION}.`)
  }

  const gridRaw = isRecord(raw.grid) ? raw.grid : {}
  if (!isRecord(raw.grid)) errors.push('grid must be an object.')
  const melodyRaw = isRecord(raw.melody) ? raw.melody : {}
  if (!isRecord(raw.melody)) errors.push('melody must be an object.')
  const notesRaw = Array.isArray(melodyRaw.notes) ? melodyRaw.notes : []
  if (!Array.isArray(melodyRaw.notes))
    errors.push('melody.notes must be an array.')
  if (notesRaw.length < 1 || notesRaw.length > LIMITS.notes) {
    errors.push(`melody.notes must contain 1 to ${LIMITS.notes} notes.`)
  }

  const noteIds = new Set()
  const notes = notesRaw.slice(0, LIMITS.notes).map((rawNote, index) => {
    const prefix = `melody.notes[${index}]`
    if (!isRecord(rawNote)) {
      errors.push(`${prefix} must be an object.`)
      return {
        id: `note-${index + 1}`,
        label: `Note ${index + 1}`,
        semitones: 0,
      }
    }
    const id = safeString(
      rawNote.id,
      `${prefix}.id`,
      LIMITS.idCharacters,
      errors,
      { id: true },
    )
    if (id && noteIds.has(id)) errors.push(`${prefix}.id duplicates "${id}".`)
    noteIds.add(id)
    return {
      id,
      label: safeString(
        rawNote.label,
        `${prefix}.label`,
        LIMITS.nameCharacters,
        errors,
      ),
      semitones: safeNumber(
        rawNote.semitones,
        `${prefix}.semitones`,
        LIMITS.semitones,
        errors,
        0,
      ),
    }
  })

  const piecesRaw = Array.isArray(raw.pieces) ? raw.pieces : []
  if (!Array.isArray(raw.pieces)) errors.push('pieces must be an array.')
  if (piecesRaw.length > LIMITS.pieces) {
    errors.push(`pieces may contain at most ${LIMITS.pieces} entries.`)
  }
  const seenIds = new Set()
  const declaredPieceIds = new Set(
    piecesRaw
      .slice(0, LIMITS.pieces)
      .filter(isRecord)
      .map((piece) => cleanString(piece.id))
      .filter((id) => ID_PATTERN.test(id) && id.length <= LIMITS.idCharacters),
  )
  const pieces = piecesRaw
    .slice(0, LIMITS.pieces)
    .map((piece, index) =>
      sanitizePiece(piece, index, errors, seenIds, noteIds, declaredPieceIds),
    )
    .filter(Boolean)

  const level = {
    schema: SCHEMA_ID,
    schemaVersion: SCHEMA_VERSION,
    id: safeString(raw.id, 'id', LIMITS.idCharacters, errors, { id: true }),
    title: safeString(raw.title, 'title', LIMITS.titleCharacters, errors),
    grid: {
      width: safeNumber(
        gridRaw.width,
        'grid.width',
        LIMITS.gridWidth,
        errors,
        32,
      ),
      depth: safeNumber(
        gridRaw.depth,
        'grid.depth',
        LIMITS.gridDepth,
        errors,
        22,
      ),
      cellSize: safeNumber(
        gridRaw.cellSize,
        'grid.cellSize',
        LIMITS.cellSize,
        errors,
        1,
      ),
    },
    melody: {
      id: safeString(melodyRaw.id, 'melody.id', LIMITS.idCharacters, errors, {
        id: true,
      }),
      title: safeString(
        melodyRaw.title,
        'melody.title',
        LIMITS.titleCharacters,
        errors,
      ),
      notes,
    },
    pieces,
  }

  return { level, errors }
}

export function parseLevelJson(text) {
  if (typeof text !== 'string')
    return { level: null, errors: ['Import must be JSON text.'] }
  if (text.length > LIMITS.jsonCharacters) {
    return {
      level: null,
      errors: [
        `Import is larger than ${LIMITS.jsonCharacters.toLocaleString()} characters.`,
      ],
    }
  }
  let raw
  try {
    raw = JSON.parse(text)
  } catch (error) {
    return {
      level: null,
      errors: [`JSON could not be parsed: ${error.message}`],
    }
  }
  return sanitizeLevel(raw)
}

export function serializeLevel(level) {
  const checked = sanitizeLevel(level)
  if (checked.errors.length > 0) {
    throw new Error(`Level cannot be exported: ${checked.errors[0]}`)
  }
  return `${JSON.stringify(checked.level, null, 2)}\n`
}

export function footprint(piece) {
  const swapped = piece.rotation === 90 || piece.rotation === 270
  return {
    width: swapped ? piece.depth : piece.width,
    depth: swapped ? piece.width : piece.depth,
  }
}

function bounds(piece) {
  const size = footprint(piece)
  return {
    left: piece.x - size.width / 2,
    right: piece.x + size.width / 2,
    top: piece.z - size.depth / 2,
    bottom: piece.z + size.depth / 2,
  }
}

function overlaps(a, b, tolerance = 0.05) {
  return (
    a.left < b.right - tolerance &&
    a.right > b.left + tolerance &&
    a.top < b.bottom - tolerance &&
    a.bottom > b.top + tolerance
  )
}

function pointInsidePiece(point, piece, margin = 0.05) {
  const box = bounds(piece)
  return (
    point.x >= box.left - margin &&
    point.x <= box.right + margin &&
    point.z >= box.top - margin &&
    point.z <= box.bottom + margin
  )
}

function containsBounds(container, contained, tolerance = 0.05) {
  return (
    contained.left >= container.left - tolerance &&
    contained.right <= container.right + tolerance &&
    contained.top >= container.top - tolerance &&
    contained.bottom <= container.bottom + tolerance
  )
}

function gapBetween(a, b) {
  const aBox = bounds(a)
  const bBox = bounds(b)
  const dx = Math.max(0, aBox.left - bBox.right, bBox.left - aBox.right)
  const dz = Math.max(0, aBox.top - bBox.bottom, bBox.top - aBox.bottom)
  return Math.hypot(dx, dz)
}

function platformIslands(platforms, connectionGap) {
  if (platforms.length === 0) return 0
  const visited = new Set()
  let islands = 0
  platforms.forEach((platform) => {
    if (visited.has(platform.id)) return
    islands += 1
    const queue = [platform]
    visited.add(platform.id)
    while (queue.length > 0) {
      const current = queue.shift()
      platforms.forEach((candidate) => {
        if (visited.has(candidate.id)) return
        if (Math.abs(candidate.y - current.y) > 1.5) return
        if (gapBetween(current, candidate) <= connectionGap) {
          visited.add(candidate.id)
          queue.push(candidate)
        }
      })
    }
  })
  return islands
}

export function inspectGeometry(level) {
  const notices = []
  const platforms = level.pieces.filter((piece) => piece.kind === 'platform')
  const markers = level.pieces.filter((piece) => piece.kind === 'marker')
  const targets = level.pieces.filter((piece) => piece.kind === 'voiceTarget')
  const unsafeAnchorSurfaces = new Set(['crackle', 'glide', 'scroll'])
  const gridBox = {
    left: -level.grid.width / 2,
    right: level.grid.width / 2,
    top: -level.grid.depth / 2,
    bottom: level.grid.depth / 2,
  }

  ;['spawn', 'exit'].forEach((type) => {
    const count = markers.filter((piece) => piece.marker === type).length
    if (count !== 1) {
      notices.push({
        severity: 'warning',
        code: `${type}-count`,
        message: `Expected one ${type} marker; found ${count}.`,
      })
    }
  })
  if (!markers.some((piece) => piece.marker === 'checkpoint')) {
    notices.push({
      severity: 'info',
      code: 'checkpoint-missing',
      message: 'No checkpoint is placed yet.',
    })
  }
  if (platforms.length === 0) {
    notices.push({
      severity: 'warning',
      code: 'platforms-missing',
      message: 'The route has no platforms.',
    })
  }

  level.pieces.forEach((piece) => {
    const box = bounds(piece)
    if (
      box.left < gridBox.left ||
      box.right > gridBox.right ||
      box.top < gridBox.top ||
      box.bottom > gridBox.bottom
    ) {
      notices.push({
        severity: 'warning',
        code: 'outside-grid',
        pieceId: piece.id,
        message: `${piece.name} extends outside the grid.`,
      })
    }
  })

  for (let i = 0; i < platforms.length; i += 1) {
    for (let j = i + 1; j < platforms.length; j += 1) {
      const a = platforms[i]
      const b = platforms[j]
      if (Math.abs(a.y - b.y) <= 0.5 && overlaps(bounds(a), bounds(b))) {
        notices.push({
          severity: 'warning',
          code: 'platform-overlap',
          pieceId: a.id,
          relatedPieceId: b.id,
          message: `${a.name} overlaps ${b.name} at nearly the same elevation.`,
        })
      }
    }
  }

  ;[...markers, ...targets].forEach((piece) => {
    const supportingPlatforms = platforms.filter(
      (platformPiece) =>
        Math.abs(platformPiece.y - piece.y) <= 0.75 &&
        pointInsidePiece(piece, platformPiece),
    )
    if (supportingPlatforms.length === 0) {
      notices.push({
        severity: 'warning',
        code: 'unsupported-marker',
        pieceId: piece.id,
        message: `${piece.name} is not positioned on a platform at its elevation.`,
      })
      return
    }

    const pieceBounds = bounds(piece)
    const fullySupportingPlatforms = supportingPlatforms.filter(
      (platformPiece) => containsBounds(bounds(platformPiece), pieceBounds),
    )
    if (fullySupportingPlatforms.length === 0) {
      notices.push({
        severity: 'warning',
        code: 'support-overhang',
        pieceId: piece.id,
        message: `${piece.name} extends beyond the footprint of its supporting platform.`,
      })
    }

    const effectiveSupports =
      fullySupportingPlatforms.length > 0
        ? fullySupportingPlatforms
        : supportingPlatforms
    if (
      effectiveSupports.every((platformPiece) =>
        unsafeAnchorSurfaces.has(platformPiece.surface),
      )
    ) {
      notices.push({
        severity: 'warning',
        code: 'unsafe-anchor-support',
        pieceId: piece.id,
        message: `${piece.name} is supported only by a crackle, moving, or retracting platform.`,
      })
    }
  })

  const islands = platformIslands(platforms, level.grid.cellSize * 1.75)
  if (islands > 1) {
    notices.push({
      severity: 'info',
      code: 'route-islands',
      message: `The top view contains ${islands} separated platform groups. Gaps may be intentional jumps.`,
    })
  }
  if (targets.length === 0) {
    notices.push({
      severity: 'info',
      code: 'voice-targets-missing',
      message: 'No voice targets are associated with the melody.',
    })
  }

  return notices
}

export function makePiece(kind, subtype, x, z, usedIds = new Set()) {
  const idStem = subtype === 'voiceTarget' ? 'voice-target' : subtype
  let suffix = 1
  while (usedIds.has(`${idStem}-${suffix}`)) suffix += 1
  const id = `${idStem}-${suffix}`

  if (kind === 'platform') {
    const definition = PLATFORM_TYPES[subtype] || PLATFORM_TYPES.stable
    const extras = {}
    if (subtype === 'crackle') extras.crackleSeconds = 2
    if (subtype === 'glide') {
      extras.motion = { axis: 'x', travel: 4, durationSeconds: 4 }
    }
    if (subtype === 'scroll') {
      extras.motion = {
        axis: 'x',
        minLengthRatio: 0.25,
        extendedSeconds: 4,
        retractedSeconds: 3,
        transitionSeconds: 1.5,
        initialState: 'retracted',
      }
    }
    return platform(
      id,
      definition.label,
      subtype,
      x,
      z,
      definition.defaultSize[0],
      definition.defaultSize[1],
      extras,
    )
  }

  if (kind === 'marker')
    return marker(id, MARKER_TYPES[subtype].label, subtype, x, z)

  return voiceTarget(id, 'Voice target', x, z, 'home')
}

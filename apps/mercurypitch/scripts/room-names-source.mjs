// ============================================================
// The room names, read out of their module's source
// ============================================================
//
// probe-bundle.mjs runs under bare node and cannot import a .ts module, so it
// reads `src/features/rooms/room-names.ts` as text to measure the names that
// ship. It used to fail OPEN: a name in double quotes (what prettier writes
// for a name with an apostrophe) or with a trailing comment was skipped, six
// of seven still passed a "at least six" guard, and the step reported every
// name fitting while the one that changed was never measured. Every key in
// the object must now be read, or this throws.

/**
 * @param {string} source the text of room-names.ts
 * @returns {Record<string, string>} every room id to its name
 */
export function parseRoomNames(source) {
  const block = /ROOM_NAMES[^=]*=\s*\{([^}]*)\}/u.exec(source)
  if (block === null) throw new Error('room names: no ROOM_NAMES object')
  // Comments go first: a name never contains `//`.
  const body = block[1]
    .replace(/\/\/.*$/gmu, '')
    .replace(/\/\*[\s\S]*?\*\//gu, '')
  const keys = [...body.matchAll(/^\s*['"]?([\w-]+)['"]?\s*:/gmu)].map(
    (match) => match[1],
  )
  /** @type {Record<string, string>} */
  const names = {}
  for (const [, id, , name] of body.matchAll(
    /^\s*['"]?([\w-]+)['"]?\s*:\s*(['"])((?:(?!\2).)+)\2\s*,?\s*$/gmu,
  )) {
    names[id] = name
  }
  const unread = keys.filter((key) => names[key] === undefined)
  if (keys.length === 0 || unread.length > 0) {
    throw new Error(
      `room names: ${keys.length} keys, could not read ${unread.join(', ') || 'any'}`,
    )
  }
  return names
}

/**
 * The labels of one surface's covers, read out of the background catalogue
 * (`src/lib/backgrounds/background-catalog.ts`) the same way. The Sing room
 * is named for the cover it draws, so every Sing cover's label is a name the
 * session pill can hold. Fails closed as above: every catalogue entry of the
 * surface must have its label read, or this throws.
 *
 * @param {string} source the text of background-catalog.ts
 * @param {string} surface the surface whose covers to read, e.g. 'sing'
 * @returns {Record<string, string>} every cover id of that surface to its label
 */
export function parseCoverLabels(source, surface) {
  const entries = [...source.matchAll(/\bsurface:\s*'([\w-]+)'/gu)].filter(
    (match) => match[1] === surface,
  ).length
  /** @type {Record<string, string>} */
  const labels = {}
  for (const [, id, entrySurface, , label] of source.matchAll(
    /\bid:\s*'([\w-]+)',\s*surface:\s*'([\w-]+)',\s*label:\s*(['"])((?:(?!\3).)+)\3\s*,/gu,
  )) {
    if (entrySurface === surface) labels[id] = label
  }
  const read = Object.keys(labels).length
  if (entries === 0 || read !== entries) {
    throw new Error(
      `${surface} covers: ${entries} entries, could read the label of ${read}`,
    )
  }
  return labels
}

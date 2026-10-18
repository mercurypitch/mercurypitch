// Game model dependencies — inspect glTF and GLB external resources for offline inventory checks.

import { posix } from 'node:path'

interface ModelDocument {
  buffers?: { uri?: string }[]
  images?: { uri?: string }[]
}

/** Resolve only local model resources; embedded data and buffer views need no extra file. */
export function gameModelDependencies(model: string, bytes: Buffer): string[] {
  let json = bytes
  if (model.endsWith('.glb')) {
    if (
      bytes.length < 20 ||
      bytes.readUInt32LE(0) !== 0x46546c67 ||
      bytes.readUInt32LE(4) !== 2 ||
      bytes.readUInt32LE(8) !== bytes.length
    ) {
      throw new Error(`${model}: invalid GLB header`)
    }
    const length = bytes.readUInt32LE(12)
    if (
      bytes.readUInt32LE(16) !== 0x4e4f534a ||
      length % 4 !== 0 ||
      length === 0 ||
      20 + length > bytes.length
    ) {
      throw new Error(`${model}: invalid GLB JSON chunk`)
    }
    json = bytes.subarray(20, 20 + length)
    for (let offset = 20 + length; offset < bytes.length; ) {
      if (offset + 8 > bytes.length)
        throw new Error(`${model}: truncated GLB chunk`)
      const chunkLength = bytes.readUInt32LE(offset)
      if (
        chunkLength % 4 !== 0 ||
        offset + 8 + chunkLength > bytes.length ||
        bytes.readUInt32LE(offset + 4) === 0x4e4f534a
      ) {
        throw new Error(`${model}: invalid GLB trailing chunk`)
      }
      offset += 8 + chunkLength
    }
  }
  const document = JSON.parse(json.toString('utf8')) as ModelDocument
  const dependencies = new Set<string>()
  for (const { uri } of [
    ...(document.buffers ?? []),
    ...(document.images ?? []),
  ]) {
    if (uri === undefined || uri.startsWith('data:')) continue
    const decoded = decodeURIComponent(uri)
    if (decoded === '' || /[:\\?#]/u.test(decoded) || decoded.startsWith('/')) {
      throw new Error(`${model}: nonlocal dependency ${uri}`)
    }
    const dependency = posix.join(posix.dirname(model), decoded)
    if (!dependency.startsWith('games/')) {
      throw new Error(`${model}: dependency leaves game inventory: ${uri}`)
    }
    dependencies.add(dependency)
  }
  return [...dependencies]
}

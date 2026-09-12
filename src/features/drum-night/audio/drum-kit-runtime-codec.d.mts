// Types for the build/runtime row codec; expanded data still requires manifest validation.
export function packDrumKitRuntimeResource(
  resource: Record<string, unknown>,
  kitId: string,
  version: string,
): unknown[]
export function unpackDrumKitRuntimeResource(
  value: unknown,
  kitId: string,
  version: string,
): Record<string, unknown>

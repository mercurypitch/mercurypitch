// WCAG contrast between two computed colours, for e2e checks of legibility.

/** Relative luminance of an opaque `rgb(r, g, b)` colour. */
export function colorLuminance(value: string): number {
  const channels = /^rgb\(/.test(value)
    ? value
        .match(/[\d.]+/g)
        ?.slice(0, 3)
        .map(Number)
    : undefined
  if (channels === undefined || channels.length !== 3) {
    throw new Error(`Expected an opaque rgb() colour, received ${value}`)
  }
  const [red, green, blue] = channels.map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.04045
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4)
  }) as [number, number, number]
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/** The contrast ratio, 1 to 21. */
export function contrast(foreground: string, background: string): number {
  const a = colorLuminance(foreground)
  const b = colorLuminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

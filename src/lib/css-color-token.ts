// ============================================================
// CSS colour tokens set from JS — with the legacy `-rgb` companion
// ============================================================
//
// The build step (tools/css-legacy-fallbacks.ts) rewrites every
// `color-mix(in srgb, var(--x) P%, transparent)` in authored CSS into a
// legacy `rgba(var(--x-rgb), a)` fallback for TV browsers (Chrome 79–83),
// and generates the `--x-rgb` companion beside every `--x` declared in CSS.
//
// It cannot see tokens assigned from JavaScript (`style={{ '--lane-color':
// peerColor }}`), so those fallbacks stay inert — undefined `--x-rgb` makes
// the fallback invalid at computed-value time, which old browsers treat as
// unset: exactly today's missing-tint behaviour, but fixable. Setting the
// companion here completes the chain.
//
// Use this wherever a style object writes a colour custom property:
//
//   style={colorTokenVars('--lane-color', props.color)}
//   style={{ ...colorTokenVars('--singer-color', c), 'z-index': 2 }}
//
// Tests: src/lib/css-color-token.test.ts
// ============================================================

/** `"r, g, b"` for a literal hex/rgb(a) colour, or null for anything else
 *  (keywords, var(), gradients — the companion is simply omitted then). */
export function cssColorToRgbList(value: string): string | null {
  const input = value.trim()

  const hex = /^#([0-9a-f]{3,8})$/i.exec(input)
  if (hex) {
    const digits = hex[1]
    if (digits.length === 3 || digits.length === 4) {
      return [digits[0], digits[1], digits[2]]
        .map((d) => parseInt(d + d, 16))
        .join(', ')
    }
    if (digits.length === 6 || digits.length === 8) {
      return [0, 2, 4]
        .map((i) => parseInt(digits.slice(i, i + 2), 16))
        .join(', ')
    }
    return null
  }

  // Greedy to the final paren: `rgba(13, 17, 23, var(--alpha))` still names
  // literal channels; the alpha is ignored either way.
  const rgb = /^rgba?\((.*)\)$/i.exec(input)
  if (rgb) {
    const parts = rgb[1]
      .split(/[\s,/]+/)
      .map((part) => part.trim())
      .filter((part) => part !== '')
    if (parts.length < 3) return null
    const channels = parts
      .slice(0, 3)
      .map((part) =>
        part.endsWith('%') ? (parseFloat(part) / 100) * 255 : parseFloat(part),
      )
    if (channels.some((channel) => !Number.isFinite(channel))) return null
    return channels
      .map((channel) => Math.max(0, Math.min(255, Math.round(channel))))
      .join(', ')
  }

  return null
}

/**
 * A style-object fragment holding the token and, when the value is a literal
 * colour, its `-rgb` companion. Undefined values yield an empty object so the
 * call site can stay unconditional.
 */
export function colorTokenVars(
  token: `--${string}`,
  value: string | undefined,
): Record<string, string> {
  if (value === undefined || value === '') return {}
  const vars: Record<string, string> = { [token]: value }
  const rgbList = cssColorToRgbList(value)
  if (rgbList !== null) vars[`${token}-rgb`] = rgbList
  return vars
}

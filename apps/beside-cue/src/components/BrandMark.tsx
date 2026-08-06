interface BrandMarkProps {
  compact?: boolean
}

export function BrandMark(props: BrandMarkProps) {
  return (
    <div
      class="brand-mark"
      classList={{ 'brand-mark--compact': props.compact === true }}
      aria-label="Beside Cue"
    >
      <span>Be</span>
      <span class="brand-mark__side">side</span>
      <span class="brand-mark__cue">Cue</span>
    </div>
  )
}

import type { Component, JSX } from 'solid-js'
import { splitProps } from 'solid-js'
import styles from './Button.module.css'

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'control' | 'action'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  design?: 'default' | 'glass'
  active?: boolean
}

export const Button: Component<ButtonProps> = (props) => {
  const [local, buttonProps] = splitProps(props, [
    'variant',
    'size',
    'design',
    'active',
    'class',
    'classList',
    'type',
  ])
  const variantClass = () => styles[local.variant ?? 'secondary']
  const sizeClass = () => styles[local.size ?? 'md']
  const designClass = () => (local.design === 'glass' ? styles.glass : '')
  const activeClass = () => (local.active === true ? styles.active : '')

  return (
    <button
      class={[
        styles.btn,
        variantClass(),
        sizeClass(),
        designClass(),
        activeClass(),
        local.class,
      ]
        .filter(Boolean)
        .join(' ')}
      classList={local.classList}
      type={local.type ?? 'button'}
      {...buttonProps}
    />
  )
}

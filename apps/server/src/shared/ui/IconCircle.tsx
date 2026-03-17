import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './IconCircle.module.css'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  theme?: 'day' | 'night'
  children: ReactNode
}

export function IconCircle({ className = '', theme = 'day', children, ...props }: Props) {
  return (
    <button
      className={[
        styles.iconCircle,
        theme === 'night' ? styles.night : '',
        className
      ].join(' ').trim()}
      {...props}
    >
      {children}
    </button>
  )
}

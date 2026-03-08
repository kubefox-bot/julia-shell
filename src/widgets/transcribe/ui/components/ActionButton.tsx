import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from '../TranscribeWidget.module.scss'

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  theme: 'day' | 'night'
  tone?: 'primary' | 'secondary'
  icon?: ReactNode
}

export function ActionButton({
  className = '',
  theme,
  tone = 'primary',
  icon,
  children,
  ...props
}: ActionButtonProps) {
  return (
    <button
      className={[
        styles.actionButton,
        tone === 'secondary' ? styles.actionButtonSecondary : styles.actionButtonPrimary,
        theme === 'night' ? styles.actionButtonNight : '',
        className
      ].join(' ').trim()}
      {...props}
    >
      {icon ? <span className={styles.actionButtonIcon}>{icon}</span> : null}
      <span>{children}</span>
    </button>
  )
}

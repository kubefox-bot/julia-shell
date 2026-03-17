import { createPortal } from 'react-dom'
import { useEffect, useState, type ReactNode } from 'react'
import styles from './ModalSurface.module.css'

type ModalSurfaceProps = {
  open: boolean
  onClose: () => void
  ariaLabel: string
  children: ReactNode
  theme?: 'day' | 'night'
  panelClassName?: string
  overlayClassName?: string
  scrimClassName?: string
}

function joinClasses(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function ModalSurface(props: ModalSurfaceProps) {
  const [mounted, setMounted] = useState(false)
  const resolvedTheme = props.theme === 'night' ? 'night' : 'day'

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!props.open) {
    return null
  }

  const content = (
    <div className={joinClasses(styles.overlay, props.overlayClassName)} role="dialog" aria-modal="true" aria-label={props.ariaLabel}>
      <button type="button" className={joinClasses(styles.scrim, props.scrimClassName)} onClick={props.onClose} aria-label={props.ariaLabel} />
      <div
        data-modal-theme={resolvedTheme}
        className={joinClasses(
          styles.panel,
          resolvedTheme === 'night' ? styles.panelNight : styles.panelDay,
          props.panelClassName
        )}
      >
        {props.children}
      </div>
    </div>
  )

  if (!mounted) {
    return content
  }

  return createPortal(content, document.body)
}

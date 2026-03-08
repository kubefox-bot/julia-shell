import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { ResolvedShellTheme } from '../../entities/widget/model/types'
import { OptionMenu } from './OptionMenu'
import styles from './OptionSelect.module.scss'

export type OptionSelectItem = {
  value: string
  label: string
  icon?: ReactNode
}

type OptionSelectProps = {
  theme?: ResolvedShellTheme
  value: string
  options: OptionSelectItem[]
  disabled?: boolean
  assistiveLabel?: string
  emptyLabel?: string
  onChange: (value: string) => void
}

export function OptionSelect({
  theme = 'day',
  value,
  options,
  disabled = false,
  assistiveLabel,
  emptyLabel = '',
  onChange
}: OptionSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const selected = options.find((option) => option.value === value) ?? null

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  return (
    <div ref={rootRef} className={[styles.root, theme === 'night' ? styles.night : ''].join(' ').trim()}>
      <button
        type="button"
        className={[styles.trigger, open ? styles.triggerActive : ''].join(' ').trim()}
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
      >
        <span className={styles.value}>
          {selected?.icon ? <span className={styles.icon}>{selected.icon}</span> : null}
          <span>{selected?.label ?? emptyLabel}</span>
        </span>
        <span className={[styles.indicator, open ? styles.indicatorOpen : ''].join(' ').trim()} aria-hidden="true" />
      </button>

      {open ? (
        <OptionMenu
          theme={theme}
          items={options}
          selectedValue={value}
          onSelect={(nextValue) => {
            onChange(nextValue)
            setOpen(false)
          }}
        />
      ) : null}

      {assistiveLabel ? <span className={styles.assistive}>{assistiveLabel}</span> : null}
    </div>
  )
}

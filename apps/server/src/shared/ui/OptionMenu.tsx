import type { ReactNode } from 'react'
import type { ResolvedShellTheme } from '../../entities/widget/model/types'
import styles from './OptionMenu.module.scss'

export type OptionMenuItemData = {
  value: string
  label: string
  icon?: ReactNode
}

type OptionMenuProps = {
  theme?: ResolvedShellTheme
  items: OptionMenuItemData[]
  selectedValue?: string | null
  onSelect: (value: string) => void
}

export function OptionMenu({ theme = 'day', items, selectedValue = null, onSelect }: OptionMenuProps) {
  return (
    <div className={[styles.menu, theme === 'night' ? styles.night : ''].join(' ').trim()}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className={[styles.option, item.value === selectedValue ? styles.selected : ''].join(' ').trim()}
          aria-pressed={item.value === selectedValue}
          onClick={() => onSelect(item.value)}
        >
          {item.icon ? <span className={styles.icon}>{item.icon}</span> : null}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )
}

import { useRef } from 'react'
import { OptionMenu } from '../../../../shared/ui/OptionMenu'
import { getTranscribeText } from '../../i18n'
import styles from '../TranscribeWidget.module.scss'
import type { DisplayLocale } from '../../../../entities/widget/model/types'
import { FolderGlyph } from './TranscribeIcons'

const CLOSE_DELAY_MS = 120
const SUBMIT_DELAY_MS = 0

type PathComboboxProps = {
  locale: DisplayLocale
  theme: 'day' | 'night'
  value: string
  options: string[]
  loading: boolean
  open: boolean
  onChange: (value: string) => void
  onSubmit: (value?: string) => void
  onOpenChange: (open: boolean) => void
}

export function PathCombobox(props: PathComboboxProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const menuItems = props.options.map((option) => ({
    value: option,
    label: option,
    icon: <FolderGlyph />
  }))

  return (
    <div className={styles.pathCombobox}>
      <div className={`${styles.pathComboboxField} ${props.open ? styles.pathComboboxFieldActive : ''}`.trim()}>
        <input
          ref={inputRef}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          onFocus={() => props.onOpenChange(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              props.onOpenChange(false)
              props.onSubmit(props.value)
            }
          }}
          onBlur={() => {
            window.setTimeout(() => props.onOpenChange(false), CLOSE_DELAY_MS)
          }}
          placeholder={getTranscribeText(props.locale, 'statusEnterPath')}
          disabled={props.loading}
        />
        <button
          type="button"
          className={styles.pathComboboxTrigger}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (props.open) {
              props.onOpenChange(false)
              return
            }
            props.onOpenChange(true)
            inputRef.current?.focus()
          }}
          disabled={props.loading}
          title={props.open ? getTranscribeText(props.locale, 'buttonOpenPath') : getTranscribeText(props.locale, 'buttonOpenHistory')}
        >
          <span className={`${styles.pathComboboxTriangle} ${props.open ? styles.pathComboboxTriangleActive : ''}`.trim()} />
        </button>
      </div>

      {props.open && menuItems.length > 0 ? (
        <OptionMenu
          theme={props.theme}
          items={menuItems}
          selectedValue={props.value}
          onSelect={(option) => {
            props.onChange(option)
            props.onOpenChange(false)
            window.setTimeout(() => props.onSubmit(option), SUBMIT_DELAY_MS)
          }}
        />
      ) : null}
    </div>
  )
}

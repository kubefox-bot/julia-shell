import { useRef } from 'react'
import { getTranscribeText } from '../../i18n'
import styles from '../TranscribeWidget.module.scss'
import type { DisplayLocale } from '../../../../entities/widget/model/types'

type PathComboboxProps = {
  locale: DisplayLocale
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
            window.setTimeout(() => props.onOpenChange(false), 120)
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

      {props.open && props.options.length > 0 ? (
        <div className={styles.pathComboboxMenu}>
          {props.options.map((option) => (
            <button
              key={option}
              type="button"
              className={styles.pathComboboxOption}
              onMouseDown={(event) => {
                event.preventDefault()
                props.onChange(option)
                props.onOpenChange(false)
                window.setTimeout(() => props.onSubmit(option), 0)
              }}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

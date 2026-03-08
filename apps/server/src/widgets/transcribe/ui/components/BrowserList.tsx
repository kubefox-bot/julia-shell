import { isSupportedAudioEntry } from '../helpers'
import type { BrowserEntry } from '../model/types'
import styles from '../TranscribeWidget.module.scss'
import type { DisplayLocale } from '../../../../entities/widget/model/types'
import { getTranscribeText } from '../../i18n'
import { AudioGlyph, FolderGlyph, TextGlyph } from './TranscribeIcons'

type BrowserListProps = {
  locale: DisplayLocale
  entries: BrowserEntry[]
  selectedAudioFiles: string[]
  loading: boolean
  onEntryClick: (entry: BrowserEntry) => void
}

export function BrowserList(props: BrowserListProps) {
  return (
    <ul className={styles.browserList}>
      {props.entries.length === 0 ? <li className={styles.empty}>{getTranscribeText(props.locale, 'helperBrowserEmpty')}</li> : null}
      {props.entries.map((entry) => {
        const isAudio = isSupportedAudioEntry(entry)
        const selectionOrder = isAudio
          ? props.selectedAudioFiles.findIndex((value) => value.toLowerCase() === entry.path.toLowerCase())
          : -1
        const hasTranscript = entry.type === 'file' && entry.name.toLowerCase().endsWith('.txt')

        return (
          <li key={entry.path}>
            <button
              type="button"
              className={`${styles.browserEntry} ${selectionOrder >= 0 ? styles.selected : ''}`.trim()}
              onClick={() => props.onEntryClick(entry)}
              disabled={props.loading}
            >
              <span className={styles.browserEntryIcon}>
                {entry.type === 'dir' ? <FolderGlyph /> : hasTranscript ? <TextGlyph /> : <AudioGlyph />}
              </span>
              {selectionOrder >= 0 ? `[${selectionOrder + 1}] ` : ''}
              {entry.name}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

import { Button } from '../../../../shared/ui/Button'
import { IconButton } from '../../../../shared/ui/IconButton'
import { getTranscribeText, isTranscribeTextKey } from '../../i18n'
import { formatSelectedAudioFiles, isSupportedAudioEntry } from '../helpers'
import { useTranscribeStore } from '../model/store'
import type { BrowserEntry } from '../model/types'
import styles from '../TranscribeWidget.module.scss'
import type { DisplayLocale } from '../../../../entities/widget/model/types'

type SetupViewProps = {
  locale: DisplayLocale
  onLoadPathEntries: (inputPath: string, options?: { allowEmpty?: boolean }) => void | Promise<void>
  onEntryClick: (entry: BrowserEntry) => void
  onUp: () => void
  onOpenSettings: () => void
  onTranscribe: () => void
  onOpenTxt: () => void
}

export function SetupView({
  locale,
  onLoadPathEntries,
  onEntryClick,
  onUp,
  onOpenSettings,
  onTranscribe,
  onOpenTxt
}: SetupViewProps) {
  const browsePath = useTranscribeStore((state) => state.browsePath)
  const recentFolders = useTranscribeStore((state) => state.recentFolders)
  const entries = useTranscribeStore((state) => state.entries)
  const selectedFolderPath = useTranscribeStore((state) => state.selectedFolderPath)
  const selectedAudioFiles = useTranscribeStore((state) => state.selectedAudioFiles)
  const selectedTranscriptPath = useTranscribeStore((state) => state.selectedTranscriptPath)
  const loading = useTranscribeStore((state) => state.loading)
  const progress = useTranscribeStore((state) => state.progress)
  const progressStage = useTranscribeStore((state) => state.progressStage)
  const setBrowsePath = useTranscribeStore((state) => state.setBrowsePath)
  const clearBrowser = useTranscribeStore((state) => state.clearBrowser)
  const setStatus = useTranscribeStore((state) => state.setStatus)

  const selectedAudioText = formatSelectedAudioFiles(locale, selectedAudioFiles)
  const canTranscribe = !loading && Boolean(selectedFolderPath) && selectedAudioFiles.length > 0
  const canOpenTxt = !loading && Boolean(selectedAudioFiles[0]) && Boolean(selectedTranscriptPath)
  const progressText = progressStage && isTranscribeTextKey(progressStage)
    ? getTranscribeText(locale, 'labelProgress', {
        percent: progress,
        stage: getTranscribeText(locale, progressStage)
      })
    : getTranscribeText(locale, 'labelProgressNoStage', {
        percent: progress
      })

  return (
    <div className={styles.setup}>
      <div className={styles.pathRow}>
        <select
          value=""
          onChange={(event) => {
            const value = event.target.value
            if (!value) return
            setBrowsePath(value)
            void onLoadPathEntries(value)
          }}
          disabled={loading || recentFolders.length === 0}
        >
          <option value="">{getTranscribeText(locale, 'helperTopFoldersPlaceholder')}</option>
          {recentFolders.map((pathValue) => (
            <option key={pathValue} value={pathValue}>{pathValue}</option>
          ))}
        </select>
        <input
          value={browsePath}
          onChange={(event) => setBrowsePath(event.target.value)}
          placeholder={getTranscribeText(locale, 'statusEnterPath')}
          disabled={loading}
        />
        <IconButton
          type="button"
          title={getTranscribeText(locale, 'buttonRefresh')}
          onClick={() => void onLoadPathEntries(browsePath, { allowEmpty: true })}
          disabled={loading}
        >
          ⟳
        </IconButton>
        <Button type="button" variant="secondary" onClick={onUp} disabled={loading}>
          {getTranscribeText(locale, 'buttonUp')}
        </Button>
        <IconButton type="button" title={getTranscribeText(locale, 'buttonSettings')} onClick={onOpenSettings} disabled={loading}>
          ⚙
        </IconButton>
        <IconButton
          type="button"
          title={getTranscribeText(locale, 'buttonClear')}
          onClick={() => {
            clearBrowser()
            setStatus({ key: 'statusPathCleared' })
          }}
          disabled={loading}
        >
          ✕
        </IconButton>
      </div>

      <p className={styles.mutedInfo}>{getTranscribeText(locale, 'helperBrowse')}</p>
      {recentFolders.length === 0 ? <p className={styles.meta}>{getTranscribeText(locale, 'helperRecentFoldersEmpty')}</p> : null}

      <ul className={styles.browserList}>
        {entries.length === 0 ? <li className={styles.empty}>{getTranscribeText(locale, 'helperBrowserEmpty')}</li> : null}
        {entries.map((entry) => {
          const isAudio = isSupportedAudioEntry(entry)
          const selectionOrder = isAudio
            ? selectedAudioFiles.findIndex((value) => value.toLowerCase() === entry.path.toLowerCase())
            : -1

          return (
            <li key={entry.path}>
              <button
                type="button"
                className={`${styles.browserEntry} ${selectionOrder >= 0 ? styles.selected : ''}`.trim()}
                onClick={() => onEntryClick(entry)}
                disabled={loading}
              >
                {selectionOrder >= 0 ? `[${selectionOrder + 1}] ` : ''}
                {entry.type === 'dir' ? '📁' : '📄'} {entry.name}
              </button>
            </li>
          )
        })}
      </ul>

      <p className={styles.meta}>{getTranscribeText(locale, 'helperSelectedFiles')}: <span>{selectedAudioText}</span></p>

      <div className={styles.progressWrap}>
        <div className={styles.progressBar}>
          <div style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
        <p>{progressText}</p>
      </div>

      <div className={styles.mainActions}>
        {canTranscribe ? (
          <Button type="button" onClick={onTranscribe} disabled={!canTranscribe}>
            {getTranscribeText(locale, 'buttonTranscribe')}
          </Button>
        ) : null}
        {canOpenTxt ? (
          <Button type="button" variant="secondary" onClick={onOpenTxt} disabled={!canOpenTxt}>
            {getTranscribeText(locale, 'buttonOpenTxt')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

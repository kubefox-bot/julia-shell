import { Button } from '../../../../shared/ui/Button'
import { IconButton } from '../../../../shared/ui/IconButton'
import { getPlatformLabel, getSecretSourceLabel, getTranscribeText } from '../../i18n'
import { useTranscribeStore } from '../model/store'
import styles from '../TranscribeWidget.module.scss'
import type { WidgetRenderProps } from '../../../../entities/widget/model/types'

type SettingsModalProps = Pick<WidgetRenderProps, 'locale' | 'platform'> & {
  onSave: () => void
}

export function SettingsModal({ locale, platform, onSave }: SettingsModalProps) {
  const settingsSaving = useTranscribeStore((state) => state.settingsSaving)
  const geminiModel = useTranscribeStore((state) => state.geminiModel)
  const availableModels = useTranscribeStore((state) => state.availableModels)
  const apiKeyValue = useTranscribeStore((state) => state.apiKeyValue)
  const apiKeyEditable = useTranscribeStore((state) => state.apiKeyEditable)
  const apiKeySource = useTranscribeStore((state) => state.apiKeySource)
  const secretPath = useTranscribeStore((state) => state.secretPath)
  const setSettingsOpen = useTranscribeStore((state) => state.setSettingsOpen)
  const setGeminiModel = useTranscribeStore((state) => state.setGeminiModel)
  const setApiKeyValue = useTranscribeStore((state) => state.setApiKeyValue)

  return (
    <div className={styles.settingsModal}>
      <div className={styles.settingsPanel}>
        <div className={styles.settingsHeader}>
          <h4>{getTranscribeText(locale, 'helperSettingsTitle')}</h4>
          <IconButton
            type="button"
            title={getTranscribeText(locale, 'buttonCloseSettings')}
            onClick={() => setSettingsOpen(false)}
            disabled={settingsSaving}
          >
            ✕
          </IconButton>
        </div>

        <label className={styles.field}>
          <span>{getTranscribeText(locale, 'helperGeminiModel')}</span>
          <select value={geminiModel} onChange={(event) => setGeminiModel(event.target.value)} disabled={settingsSaving}>
            {availableModels.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>{getTranscribeText(locale, 'helperApiKey')}</span>
          <input
            type={apiKeyEditable ? 'password' : 'text'}
            value={apiKeyValue}
            onChange={(event) => setApiKeyValue(event.target.value)}
            readOnly={!apiKeyEditable}
            disabled={settingsSaving}
          />
        </label>

        <p className={styles.meta}>
          {getTranscribeText(locale, 'helperApiKeySource')}: <span>{getSecretSourceLabel(locale, apiKeySource)}</span>
        </p>
        <p className={styles.meta}>
          {getTranscribeText(locale, 'helperPlatform')}: <span>{getPlatformLabel(locale, platform)}</span>
        </p>
        {secretPath ? (
          <p className={styles.meta}>
            {getTranscribeText(locale, 'helperSecretPath')}: <span>{secretPath}</span>
          </p>
        ) : null}
        <p className={styles.mutedInfo}>
          {getTranscribeText(locale, apiKeyEditable ? 'helperSettingsHintEditable' : 'helperSettingsHintInfisical')}
        </p>

        <div className={styles.mainActions}>
          <Button type="button" onClick={onSave} disabled={settingsSaving}>
            {getTranscribeText(locale, 'buttonSaveSettings')}
          </Button>
        </div>
      </div>
    </div>
  )
}

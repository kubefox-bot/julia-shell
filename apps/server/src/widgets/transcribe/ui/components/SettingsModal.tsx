import { IconCircle } from '@shared/ui/IconCircle'
import { ModalSurface } from '@shared/ui/ModalSurface'
import { OptionSelect } from '@shared/ui/OptionSelect'
import { getPlatformLabel, getSecretSourceLabel, getTranscribeText } from '../../i18n'
import { useTranscribeStore } from '../model/store'
import styles from '../TranscribeWidget.module.css'
import type { WidgetRenderProps } from '../../../../entities/widget/model/types'
import { CloseGlyph, SaveGlyph, WaveGlyph } from './TranscribeIcons'
import { ActionButton } from './ActionButton'

type SettingsModalProps = Pick<WidgetRenderProps, 'locale' | 'platform'> & {
  theme: 'day' | 'night'
  onSave: () => void
}

export function SettingsModal({ locale, platform, theme, onSave }: SettingsModalProps) {
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
  const modelOptions = availableModels.map((model) => ({
    value: model,
    label: model,
    icon: <WaveGlyph />
  }))

  return (
    <ModalSurface
      open
      onClose={() => {
        if (!settingsSaving) {
          setSettingsOpen(false)
        }
      }}
      ariaLabel={getTranscribeText(locale, 'helperSettingsTitle')}
      theme={theme}
      panelClassName={styles.settingsPanel}
    >
        <div className={styles.settingsHeader}>
          <h4>{getTranscribeText(locale, 'helperSettingsTitle')}</h4>
          <IconCircle
            type="button"
            theme={theme}
            title={getTranscribeText(locale, 'buttonCloseSettings')}
            onClick={() => setSettingsOpen(false)}
            disabled={settingsSaving}
          >
            <CloseGlyph />
          </IconCircle>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>{getTranscribeText(locale, 'helperGeminiModel')}</span>
          <OptionSelect
            theme={theme}
            value={geminiModel}
            options={modelOptions}
            disabled={settingsSaving}
            assistiveLabel={getTranscribeText(locale, 'helperGeminiModel')}
            emptyLabel={getTranscribeText(locale, 'helperGeminiModel')}
            onChange={setGeminiModel}
          />
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{getTranscribeText(locale, 'helperApiKey')}</span>
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
       

        <div className={styles.mainActions}>
          <ActionButton type="button" theme={theme} icon={<SaveGlyph />} onClick={onSave} disabled={settingsSaving}>
            {getTranscribeText(locale, 'buttonSaveSettings')}
          </ActionButton>
        </div>
    </ModalSurface>
  )
}

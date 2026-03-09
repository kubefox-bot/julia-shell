import { getLocalizedHeader } from '../../../../shared/lib/locale';
import { Button } from '../../../../shared/ui/Button';
import { IconButton } from '../../../../shared/ui/IconButton';
import { useShellI18n, useShellSettingsViewModel } from '../../model/selectors';
import { useShellStore } from '../../model/store';
import styles from '../ShellApp.module.scss';

export function ShellSettingsOverlay() {
  const { t } = useShellI18n();
  const { isSettingsOpen, isSaving, modules, settingsDraft, activeLocale } = useShellSettingsViewModel();
  const closeSettings = useShellStore((state) => state.closeSettings);
  const updateSettingsDraftColumns = useShellStore((state) => state.updateSettingsDraftColumns);
  const updateSettingsDraftLocale = useShellStore((state) => state.updateSettingsDraftLocale);
  const updateSettingsDraftTheme = useShellStore((state) => state.updateSettingsDraftTheme);
  const saveSettings = useShellStore((state) => state.saveSettings);
  const toggleModule = useShellStore((state) => state.toggleModule);

  if (!isSettingsOpen) {
    return null;
  }

  return (
    <div className={styles.settingsOverlay} role="dialog" aria-modal="true" aria-label={t('settingsOverlayLabel')}>
      <button type="button" className={styles.settingsScrim} onClick={closeSettings} aria-label={t('closeSettings')} />
      <section className={styles.settingsPanel}>
        <div className={styles.settingsHero}>
          <div>
            <p className={styles.settingsEyebrow}>{t('settings')}</p>
            <h2>{t('settingsTitle')}</h2>
            <p>{t('settingsSubtitle')}</p>
          </div>
          <IconButton type="button" onClick={closeSettings} title={t('closeSettings')}>
            ✕
          </IconButton>
        </div>

        <div className={styles.settingsBlock}>
          <h3>{t('layoutBlockTitle')}</h3>
          <div className={styles.gridControls}>
            <label>
              {t('desktopColumns')}
              <input
                type="number"
                min={1}
                max={12}
                value={settingsDraft.desktopColumns}
                onChange={(event) => updateSettingsDraftColumns({ desktopColumns: Number(event.target.value) || 1 })}
              />
            </label>
            <label>
              {t('mobileColumns')}
              <input
                type="number"
                min={1}
                max={12}
                value={settingsDraft.mobileColumns}
                onChange={(event) => updateSettingsDraftColumns({ mobileColumns: Number(event.target.value) || 1 })}
              />
            </label>
            <label>
              {t('locale')}
              <select value={settingsDraft.locale} onChange={(event) => updateSettingsDraftLocale(event.target.value as typeof settingsDraft.locale)}>
                <option value="ru">{t('localeRu')}</option>
                <option value="en">{t('localeEn')}</option>
              </select>
            </label>
            <label>
              {t('theme')}
              <select value={settingsDraft.theme} onChange={(event) => updateSettingsDraftTheme(event.target.value as typeof settingsDraft.theme)}>
                <option value="auto">{t('themeAuto')}</option>
                <option value="day">{t('themeDay')}</option>
                <option value="night">{t('themeNight')}</option>
              </select>
            </label>
          </div>
        </div>

        <div className={styles.settingsBlock}>
          <h3>{t('modulesBlockTitle')}</h3>
          <div className={styles.moduleTable}>
            <div className={styles.moduleHead}>
              <span>{t('modulesId')}</span>
              <span>{t('modulesName')}</span>
              <span>{t('modulesVersion')}</span>
              <span>{t('modulesState')}</span>
              <span>{t('modulesToggle')}</span>
            </div>
            {modules.map((module) => (
              <div className={styles.moduleRow} key={module.id}>
                <span className={styles.mono}>{module.id}</span>
                <span title={module.description}>{getLocalizedHeader(module.headerName, activeLocale)}</span>
                <span className={styles.mono}>{module.version}</span>
                <span className={module.ready ? styles.ready : styles.notReady}>
                  {module.ready ? t('ready') : t('notReady')}
                </span>
                <span>
                  <Button
                    type="button"
                    variant={module.enabled ? 'secondary' : 'primary'}
                    disabled={!module.ready || isSaving}
                    onClick={() => void toggleModule(module.id, !module.enabled)}
                  >
                    {module.enabled ? t('disable') : t('enable')}
                  </Button>
                </span>
                {!module.ready && module.notReadyReasons.length > 0 ? (
                  <p className={styles.moduleReason}>{module.notReadyReasons.join(' | ')}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.settingsFooter}>
          <Button type="button" variant="ghost" onClick={closeSettings} disabled={isSaving}>
            {t('close')}
          </Button>
          <Button type="button" onClick={() => void saveSettings()} disabled={isSaving}>
            {isSaving ? t('saving') : t('save')}
          </Button>
        </div>
      </section>
    </div>
  );
}

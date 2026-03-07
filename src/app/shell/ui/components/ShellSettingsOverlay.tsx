import { getLocalizedHeader } from '../../../../shared/lib/locale';
import { Button } from '../../../../shared/ui/Button';
import { IconButton } from '../../../../shared/ui/IconButton';
import { useShellSettingsViewModel } from '../../model/selectors';
import { useShellStore } from '../../model/store';
import styles from '../ShellApp.module.scss';

export function ShellSettingsOverlay() {
  const { isSettingsOpen, isSaving, modules, settingsDraft, activeLocale } = useShellSettingsViewModel();
  const closeSettings = useShellStore((state) => state.closeSettings);
  const updateSettingsDraftColumns = useShellStore((state) => state.updateSettingsDraftColumns);
  const updateSettingsDraftLocale = useShellStore((state) => state.updateSettingsDraftLocale);
  const saveSettings = useShellStore((state) => state.saveSettings);
  const toggleModule = useShellStore((state) => state.toggleModule);

  if (!isSettingsOpen) {
    return null;
  }

  return (
    <div className={styles.settingsOverlay} role="dialog" aria-modal="true" aria-label="Shell Settings">
      <div className={styles.settingsScrim} onClick={closeSettings} />
      <section className={styles.settingsPanel}>
        <div className={styles.settingsHero}>
          <div>
            <p className={styles.settingsEyebrow}>Shell Overlay</p>
            <h2>Shell Settings</h2>
            <p>Grid, locale и registry модулей поверх dashboard.</p>
          </div>
          <IconButton type="button" onClick={closeSettings} title="Close settings">
            ✕
          </IconButton>
        </div>

        <div className={styles.settingsBlock}>
          <h3>Layout Grid</h3>
          <div className={styles.gridControls}>
            <label>
              Desktop Columns
              <input
                type="number"
                min={1}
                max={12}
                value={settingsDraft.desktopColumns}
                onChange={(event) => updateSettingsDraftColumns({ desktopColumns: Number(event.target.value) || 1 })}
              />
            </label>
            <label>
              Mobile Columns
              <input
                type="number"
                min={1}
                max={12}
                value={settingsDraft.mobileColumns}
                onChange={(event) => updateSettingsDraftColumns({ mobileColumns: Number(event.target.value) || 1 })}
              />
            </label>
            <label>
              Locale
              <select value={settingsDraft.locale} onChange={(event) => updateSettingsDraftLocale(event.target.value as typeof settingsDraft.locale)}>
                <option value="system">System</option>
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>
        </div>

        <div className={styles.settingsBlock}>
          <h3>Modules</h3>
          <div className={styles.moduleTable}>
            <div className={styles.moduleHead}>
              <span>ID</span>
              <span>Name</span>
              <span>Version</span>
              <span>State</span>
              <span>Toggle</span>
            </div>
            {modules.map((module) => (
              <div className={styles.moduleRow} key={module.id}>
                <span className={styles.mono}>{module.id}</span>
                <span title={module.description}>{getLocalizedHeader(module.headerName, activeLocale)}</span>
                <span className={styles.mono}>{module.version}</span>
                <span className={module.ready ? styles.ready : styles.notReady}>
                  {module.ready ? 'ready' : 'not-ready'}
                </span>
                <span>
                  <Button
                    type="button"
                    variant={module.enabled ? 'secondary' : 'primary'}
                    disabled={!module.ready || isSaving}
                    onClick={() => void toggleModule(module.id, !module.enabled)}
                  >
                    {module.enabled ? 'Disable' : 'Enable'}
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
            Close
          </Button>
          <Button type="button" onClick={() => void saveSettings()} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Сохранить'}
          </Button>
        </div>
      </section>
    </div>
  );
}

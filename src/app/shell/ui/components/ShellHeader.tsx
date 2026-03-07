import { Button } from '../../../../shared/ui/Button';
import { IconButton } from '../../../../shared/ui/IconButton';
import { useShellLayoutViewModel } from '../../model/selectors';
import { useShellStore } from '../../model/store';
import styles from '../ShellApp.module.scss';

export function ShellHeader() {
  const { hasUnsavedChanges } = useShellLayoutViewModel();
  const isEditMode = useShellStore((state) => state.isEditMode);
  const isSaving = useShellStore((state) => state.isSaving);
  const openSettings = useShellStore((state) => state.openSettings);
  const startEdit = useShellStore((state) => state.startEdit);
  const cancelEdit = useShellStore((state) => state.cancelEdit);
  const saveLayout = useShellStore((state) => state.saveLayout);

  return (
    <header className={styles.header}>
      <div>
        <h1>Yulia Shell</h1>
        <p>Core + widgets registry</p>
      </div>
      <div className={styles.headerActions}>
        <IconButton type="button" onClick={openSettings} title="Settings">
          ⚙️
        </IconButton>
        {!isEditMode ? (
          <IconButton type="button" onClick={startEdit} title="Edit layout">
            ✎
          </IconButton>
        ) : (
          <>
            <Button type="button" variant="secondary" onClick={cancelEdit} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveLayout()} disabled={isSaving || !hasUnsavedChanges}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </>
        )}
      </div>
    </header>
  );
}

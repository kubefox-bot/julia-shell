import { DragOverlay } from '@dnd-kit/core';
import { getLocalizedHeader } from '../../../../shared/lib/locale';
import { useShellRegistry } from '../../lib/registry';
import { useShellDndViewModel, useShellLocale, useShellModuleInfo } from '../../model/selectors';
import styles from '../ShellApp.module.scss';

export function ShellDragPreview() {
  const { activeId } = useShellDndViewModel();
  const activeLocale = useShellLocale();
  const { clientModuleMap } = useShellRegistry();
  const moduleInfo = useShellModuleInfo(activeId ?? '');

  return (
    <DragOverlay>
      {activeId && moduleInfo ? (() => {
        const clientModule = clientModuleMap.get(activeId);
        if (!clientModule) {
          return null;
        }

        return (
          <div className={styles.dragOverlay}>
            <span>
              <clientModule.Icon />
            </span>
            <strong>{getLocalizedHeader(moduleInfo.headerName, activeLocale)}</strong>
          </div>
        );
      })() : null}
    </DragOverlay>
  );
}

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { getLocalizedHeader } from '../../../../shared/lib/locale';
import { useShellRegistry } from '../../lib/registry';
import { useResolvedShellTheme, useShellDndViewModel, useShellEditMode, useShellLayoutViewModel, useShellLocale } from '../../model/selectors';
import { useShellStore } from '../../model/store';
import styles from '../ShellApp.module.scss';
import { ShellDragPreview } from './ShellDragPreview';
import { ShellWidgetCard } from './ShellWidgetCard';

const SIZE_SPAN = {
  small: 3,
  medium: 6,
  large: 12
} as const;

export function WidgetGrid() {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const activeLocale = useShellLocale();
  const activeTheme = useResolvedShellTheme();
  const hostPlatform = useShellStore((state) => state.platform);
  const isEditMode = useShellEditMode();
  const { activeId, overId } = useShellDndViewModel();
  const { moduleMap, visibleLayout, previewLayout, columnsStyle } = useShellLayoutViewModel();
  const { clientModuleMap } = useShellRegistry();
  const changeWidgetSize = useShellStore((state) => state.changeWidgetSize);
  const startDrag = useShellStore((state) => state.startDrag);
  const overDrag = useShellStore((state) => state.overDrag);
  const endDrag = useShellStore((state) => state.endDrag);

  const onDragStart = (event: DragStartEvent) => {
    startDrag(String(event.active.id));
  };

  const onDragOver = (event: DragOverEvent) => {
    overDrag(event.over ? String(event.over.id) : null);
  };

  const onDragEnd = (_event: DragEndEvent) => {
    endDrag();
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={visibleLayout.map((item) => item.widgetId)} strategy={rectSortingStrategy}>
        <section className={styles.grid} style={columnsStyle}>
          {previewLayout.map((entry) => {
            if (entry.kind === 'placeholder') {
              const moduleInfo = moduleMap.get(entry.item.widgetId);
              const clientModule = clientModuleMap.get(entry.item.widgetId);
              if (!moduleInfo || !clientModule) return null;

              return (
                <div
                  key={`placeholder-${entry.item.widgetId}`}
                  className={styles.dropShadowSlot}
                  style={{ gridColumn: `span ${SIZE_SPAN[entry.item.size]}` }}
                >
                  <div className={styles.dropShadowInner}>
                    <span>
                      <clientModule.Icon />
                    </span>
                    <strong>{getLocalizedHeader(moduleInfo.headerName, activeLocale)}</strong>
                    <small>{entry.item.size.toUpperCase()} slot</small>
                  </div>
                </div>
              );
            }

            const moduleInfo = moduleMap.get(entry.item.widgetId);
            const clientModule = clientModuleMap.get(entry.item.widgetId);
            if (!moduleInfo || !clientModule) return null;

            return (
              <ShellWidgetCard
                key={entry.item.widgetId}
                id={entry.item.widgetId}
                size={entry.item.size}
                title={getLocalizedHeader(moduleInfo.headerName, activeLocale)}
                Icon={clientModule.Icon}
                editMode={isEditMode}
                overId={overId}
                activeId={activeId}
                supportedSizes={moduleInfo.supportedSizes}
                onSizeChange={changeWidgetSize}
              >
                <clientModule.Render locale={activeLocale} theme={activeTheme} platform={hostPlatform} />
              </ShellWidgetCard>
            );
          })}
        </section>
      </SortableContext>
      <ShellDragPreview />
    </DndContext>
  );
}

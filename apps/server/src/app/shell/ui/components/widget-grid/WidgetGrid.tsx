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
import { getLocalizedHeader } from '@shared/lib/locale';
import { useShellRegistry } from '@app/shell/lib/registry';
import { useResolvedShellTheme, useShellDndViewModel, useShellEditMode, useShellLayoutViewModel, useShellLocale } from '@app/shell/model/selectors';
import { useShellStore } from '@app/shell/model/store';
import styles from '@app/shell/ui/shell-app/ShellApp.module.scss';
import { ShellDragPreview } from '@app/shell/ui/components/shell-drag-preview';
import { ShellWidgetCard } from '@app/shell/ui/components/shell-widget-card';
import skeletonStyles from '@app/shell/ui/components/skeleton/Skeleton.module.scss';

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
          {/*
            {previewLayout.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateBadge}>♡</div>
                <h2>{t('dashboardEmptyTitle')}</h2>
                <p>{t('dashboardEmptyBody')}</p>
                <Button type="button" onClick={openSettings}>
                  {t('dashboardEmptyAction')}
                </Button>
              </div>
            ) : null}
          */}
          {previewLayout.map((entry) => {
            if (entry.kind === 'placeholder') {
              return (
                <div
                  key={`placeholder-${entry.item.widgetId}`}
                  className={styles.dropShadowSlot}
                  style={{ gridColumn: `span ${SIZE_SPAN[entry.item.size]}` }}
                >
                  <article className={[styles.widgetCard, skeletonStyles.widgetSilhouetteCard, skeletonStyles.widgetSilhouetteCardAnimated].join(' ')}>
                  </article>
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

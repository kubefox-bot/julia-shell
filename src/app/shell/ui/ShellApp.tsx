import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LayoutItem, WidgetModuleInfo, WidgetSize } from '../../../entities/widget/model/types';
import { Button } from '../../../shared/ui/Button';
import { IconButton } from '../../../shared/ui/IconButton';
import { fetchShellSettings, saveShellLayout, toggleModule } from '../lib/api';
import { WeatherWidget } from '../../../widgets/weather/ui/WeatherWidget';
import { TranscribeWidget } from '../../../widgets/transcribe/ui/TranscribeWidget';
import styles from './ShellApp.module.scss';

const SIZE_LABELS: Record<WidgetSize, string> = {
  small: 'S',
  medium: 'M',
  large: 'L'
};

const SIZE_SPAN: Record<WidgetSize, number> = {
  small: 3,
  medium: 6,
  large: 12
};

function normalizeLayout(layout: LayoutItem[], modules: WidgetModuleInfo[]) {
  const moduleMap = new Map(modules.map((module) => [module.widgetId, module]));
  const seen = new Set<string>();

  const base = layout
    .filter((item) => {
      if (!moduleMap.has(item.widgetId)) return false;
      if (seen.has(item.widgetId)) return false;
      seen.add(item.widgetId);
      return true;
    })
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index }));

  for (const module of modules) {
    if (!seen.has(module.widgetId)) {
      base.push({
        widgetId: module.widgetId,
        order: base.length,
        size: module.defaultSize
      });
    }
  }

  return base;
}

function getWidgetMeta(widgetId: string) {
  if (widgetId === 'com.yulia.weather') {
    return { icon: '🌤️', title: 'Погода' };
  }

  if (widgetId === 'com.yulia.transcribe') {
    return { icon: '🎙️', title: 'Транскрибация' };
  }

  return { icon: '🧩', title: widgetId };
}

function renderWidget(widgetId: string) {
  if (widgetId === 'com.yulia.weather') {
    return <WeatherWidget />;
  }

  if (widgetId === 'com.yulia.transcribe') {
    return <TranscribeWidget />;
  }

  return <div>Widget {widgetId} is not wired.</div>;
}

function buildPreviewLayout(
  items: LayoutItem[],
  activeId: string | null,
  overId: string | null
) {
  if (!activeId) {
    return items.map((item) => ({ kind: 'widget' as const, item }));
  }

  const activeItem = items.find((item) => item.widgetId === activeId);
  if (!activeItem) {
    return items.map((item) => ({ kind: 'widget' as const, item }));
  }

  const withoutActive = items.filter((item) => item.widgetId !== activeId);
  const targetIndex = overId
    ? withoutActive.findIndex((item) => item.widgetId === overId)
    : withoutActive.length;

  const insertionIndex = targetIndex >= 0 ? targetIndex : withoutActive.length;

  return [
    ...withoutActive.slice(0, insertionIndex).map((item) => ({ kind: 'widget' as const, item })),
    { kind: 'placeholder' as const, item: activeItem },
    ...withoutActive.slice(insertionIndex).map((item) => ({ kind: 'widget' as const, item }))
  ];
}

type SortableWidgetCardProps = {
  id: string;
  size: WidgetSize;
  title: string;
  icon: string;
  editMode: boolean;
  overId: string | null;
  activeId: string | null;
  supportedSizes: WidgetSize[];
  onSizeChange: (widgetId: string, size: WidgetSize) => void;
  children: ReactNode;
};

function SortableWidgetCard({
  id,
  size,
  title,
  icon,
  editMode,
  overId,
  activeId,
  supportedSizes,
  onSizeChange,
  children
}: SortableWidgetCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id, disabled: !editMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridColumn: `span ${SIZE_SPAN[size]}`
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={[
        styles.widgetCard,
        editMode ? styles.widgetCardEditMode : '',
        isDragging ? styles.dragging : '',
        overId === id && activeId !== id ? styles.dropTarget : ''
      ].filter(Boolean).join(' ')}
    >
      <div className={styles.widgetHead}>
        <div className={styles.widgetTitleWrap}>
          <span className={styles.widgetIcon}>{icon}</span>
          <h3>{title}</h3>
        </div>
        {editMode ? (
          <div className={styles.widgetEditTools}>
            <div className={styles.sizeGroup}>
              {supportedSizes.map((candidateSize) => (
                <button
                  key={candidateSize}
                  type="button"
                  className={candidateSize === size ? styles.sizeActive : ''}
                  onClick={() => onSizeChange(id, candidateSize)}
                >
                  {SIZE_LABELS[candidateSize]}
                </button>
              ))}
            </div>
            <button type="button" className={styles.dragHandle} {...attributes} {...listeners} title="Переместить">
              ⋮⋮
            </button>
          </div>
        ) : null}
      </div>
      <div className={styles.widgetBody}>
        {children}
        {editMode ? (
          <div className={styles.widgetBodyLock} aria-hidden="true">
            <div className={styles.widgetBodyLockBadge}>Edit Mode</div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function ShellApp() {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [draftLayout, setDraftLayout] = useState<LayoutItem[]>([]);
  const [modules, setModules] = useState<WidgetModuleInfo[]>([]);
  const [desktopColumns, setDesktopColumns] = useState(12);
  const [mobileColumns, setMobileColumns] = useState(1);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [settingsDraftColumns, setSettingsDraftColumns] = useState({
    desktop: 12,
    mobile: 1
  });

  const loadSettings = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchShellSettings();
      const normalized = normalizeLayout(data.layout, data.modules);
      setLayout(normalized);
      setDraftLayout(normalized);
      setModules(data.modules);
      setDesktopColumns(data.layoutSettings.desktopColumns);
      setMobileColumns(data.layoutSettings.mobileColumns);
      setSettingsDraftColumns({
        desktop: data.layoutSettings.desktopColumns,
        mobile: data.layoutSettings.mobileColumns
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Ошибка загрузки shell.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const moduleMap = useMemo(() => {
    return new Map(modules.map((module) => [module.widgetId, module]));
  }, [modules]);

  const visibleWidgetIds = useMemo(() => {
    return modules
      .filter((module) => module.ready && module.enabled)
      .map((module) => module.widgetId);
  }, [modules]);

  const visibleLayout = useMemo(() => {
    const source = isEditMode ? draftLayout : layout;
    const allowed = new Set(visibleWidgetIds);
    return source
      .filter((item) => allowed.has(item.widgetId))
      .sort((a, b) => a.order - b.order);
  }, [isEditMode, draftLayout, layout, visibleWidgetIds]);

  const hasUnsavedChanges = useMemo(() => {
    const left = JSON.stringify(layout);
    const right = JSON.stringify(draftLayout);
    return left !== right;
  }, [layout, draftLayout]);

  const updateLayoutOrder = (nextVisible: LayoutItem[]) => {
    const nextVisibleMap = new Map(nextVisible.map((item, index) => [item.widgetId, { ...item, order: index }]));
    const hidden = draftLayout
      .filter((item) => !nextVisibleMap.has(item.widgetId))
      .sort((a, b) => a.order - b.order)
      .map((item, index) => ({ ...item, order: nextVisible.length + index }));

    const merged = [...nextVisible.map((item, index) => ({ ...item, order: index })), ...hidden];
    setDraftLayout(merged);
  };

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const onDragOver = (event: DragOverEvent) => {
    setOverId(event.over ? String(event.over.id) : null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const currentActiveId = String(event.active.id);
    const currentOverId = event.over ? String(event.over.id) : null;

    setActiveId(null);
    setOverId(null);

    if (!currentOverId || currentActiveId === currentOverId) {
      return;
    }

    const ids = visibleLayout.map((item) => item.widgetId);
    const oldIndex = ids.indexOf(currentActiveId);
    const newIndex = ids.indexOf(currentOverId);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const reordered = arrayMove(visibleLayout, oldIndex, newIndex).map((item, index) => ({ ...item, order: index }));
    updateLayoutOrder(reordered);
  };

  const onCancelEdit = () => {
    setDraftLayout(layout);
    setIsEditMode(false);
    setActiveId(null);
    setOverId(null);
  };

  const onSaveLayout = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const result = await saveShellLayout({
        desktopColumns,
        mobileColumns,
        layout: draftLayout
      });
      const normalized = normalizeLayout(result.layout, result.modules);
      setLayout(normalized);
      setDraftLayout(normalized);
      setModules(result.modules);
      setDesktopColumns(result.layoutSettings.desktopColumns);
      setMobileColumns(result.layoutSettings.mobileColumns);
      setIsEditMode(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить layout.');
    } finally {
      setIsSaving(false);
    }
  };

  const onModuleToggle = async (widgetId: string, enabled: boolean) => {
    setError(null);

    try {
      await toggleModule(widgetId, enabled);
      await loadSettings();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Не удалось изменить состояние модуля.');
    }
  };

  const onSizeChange = (widgetId: string, nextSize: WidgetSize) => {
    setDraftLayout((prev) => prev.map((item) => {
      if (item.widgetId !== widgetId) return item;
      return { ...item, size: nextSize };
    }));
  };

  const currentColumnsStyle = {
    '--desktop-columns': String(desktopColumns),
    '--mobile-columns': String(mobileColumns)
  } as React.CSSProperties;

  const previewLayout = useMemo(() => {
    if (!isEditMode) {
      return visibleLayout.map((item) => ({ kind: 'widget' as const, item }));
    }

    return buildPreviewLayout(visibleLayout, activeId, overId);
  }, [activeId, isEditMode, overId, visibleLayout]);

  const onOpenSettings = () => {
    setSettingsDraftColumns({
      desktop: desktopColumns,
      mobile: mobileColumns
    });
    setIsSettingsOpen(true);
  };

  const onCloseSettings = () => {
    setSettingsDraftColumns({
      desktop: desktopColumns,
      mobile: mobileColumns
    });
    setIsSettingsOpen(false);
  };

  const onSaveSettingsOverlay = async () => {
    setDesktopColumns(settingsDraftColumns.desktop);
    setMobileColumns(settingsDraftColumns.mobile);

    setIsSaving(true);
    setError(null);

    try {
      const result = await saveShellLayout({
        desktopColumns: settingsDraftColumns.desktop,
        mobileColumns: settingsDraftColumns.mobile,
        layout: draftLayout
      });
      const normalized = normalizeLayout(result.layout, result.modules);
      setLayout(normalized);
      setDraftLayout(normalized);
      setModules(result.modules);
      setDesktopColumns(result.layoutSettings.desktopColumns);
      setMobileColumns(result.layoutSettings.mobileColumns);
      setSettingsDraftColumns({
        desktop: result.layoutSettings.desktopColumns,
        mobile: result.layoutSettings.mobileColumns
      });
      setIsSettingsOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Загрузка shell...</div>;
  }

  return (
    <div className={styles.shellRoot}>
      <header className={styles.header}>
        <div>
          <h1>Yulia Shell</h1>
          <p>Core + widgets: `com.yulia.weather`, `com.yulia.transcribe`</p>
        </div>
        <div className={styles.headerActions}>
          <IconButton type="button" onClick={onOpenSettings} title="Settings">⚙️</IconButton>
          {!isEditMode ? (
            <IconButton type="button" onClick={() => setIsEditMode(true)} title="Edit layout">✎</IconButton>
          ) : (
            <>
              <Button type="button" variant="secondary" onClick={onCancelEdit} disabled={isSaving}>Cancel</Button>
              <Button type="button" onClick={() => void onSaveLayout()} disabled={isSaving || !hasUnsavedChanges}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}
        </div>
      </header>

      {error ? <p className={styles.error}>Ошибка: {error}</p> : null}

      {isSettingsOpen ? (
        <div className={styles.settingsOverlay} role="dialog" aria-modal="true" aria-label="Shell Settings">
          <div className={styles.settingsScrim} onClick={onCloseSettings} />
          <section className={styles.settingsPanel}>
            <div className={styles.settingsHero}>
              <div>
                <p className={styles.settingsEyebrow}>Shell Overlay</p>
                <h2>Shell Settings</h2>
                <p>Grid и registry модулей поверх dashboard.</p>
              </div>
              <IconButton type="button" onClick={onCloseSettings} title="Close settings">✕</IconButton>
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
                    value={settingsDraftColumns.desktop}
                    onChange={(event) => setSettingsDraftColumns((prev) => ({
                      ...prev,
                      desktop: Math.max(1, Math.min(12, Number(event.target.value) || 1))
                    }))}
                  />
                </label>
                <label>
                  Mobile Columns
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={settingsDraftColumns.mobile}
                    onChange={(event) => setSettingsDraftColumns((prev) => ({
                      ...prev,
                      mobile: Math.max(1, Math.min(12, Number(event.target.value) || 1))
                    }))}
                  />
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
                  <div className={styles.moduleRow} key={module.widgetId}>
                    <span className={styles.mono}>{module.widgetId}</span>
                    <span title={module.description}>{module.name}</span>
                    <span className={styles.mono}>{module.version}</span>
                    <span className={module.ready ? styles.ready : styles.notReady}>
                      {module.ready ? 'ready' : 'not-ready'}
                    </span>
                    <span>
                      <Button
                        type="button"
                        variant={module.enabled ? 'secondary' : 'primary'}
                        disabled={!module.ready || isSaving}
                        onClick={() => void onModuleToggle(module.widgetId, !module.enabled)}
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
              <Button type="button" variant="ghost" onClick={onCloseSettings} disabled={isSaving}>Close</Button>
              <Button type="button" onClick={() => void onSaveSettingsOverlay()} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Сохранить'}
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={visibleLayout.map((item) => item.widgetId)}
          strategy={rectSortingStrategy}
        >
          <section className={styles.grid} style={currentColumnsStyle}>
            {previewLayout.map((entry) => {
              if (entry.kind === 'placeholder') {
                const meta = getWidgetMeta(entry.item.widgetId);
                return (
                  <div
                    key={`placeholder-${entry.item.widgetId}`}
                    className={styles.dropShadowSlot}
                    style={{ gridColumn: `span ${SIZE_SPAN[entry.item.size]}` }}
                  >
                    <div className={styles.dropShadowInner}>
                      <span>{meta.icon}</span>
                      <strong>{meta.title}</strong>
                      <small>{entry.item.size.toUpperCase()} slot</small>
                    </div>
                  </div>
                );
              }

              const item = entry.item;
              const moduleInfo = moduleMap.get(item.widgetId);
              if (!moduleInfo) return null;

              const meta = getWidgetMeta(item.widgetId);

              return (
                <SortableWidgetCard
                  key={item.widgetId}
                  id={item.widgetId}
                  size={item.size}
                  title={meta.title}
                  icon={meta.icon}
                  editMode={isEditMode}
                  overId={overId}
                  activeId={activeId}
                  supportedSizes={moduleInfo.supportedSizes}
                  onSizeChange={onSizeChange}
                >
                  {renderWidget(item.widgetId)}
                </SortableWidgetCard>
              );
            })}
          </section>
        </SortableContext>
        <DragOverlay>
          {activeId ? (
            <div className={styles.dragOverlay}>
              <span>{getWidgetMeta(activeId).icon}</span>
              <strong>{getWidgetMeta(activeId).title}</strong>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

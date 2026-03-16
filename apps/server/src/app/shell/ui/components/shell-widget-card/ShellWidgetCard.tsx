import type { ComponentType, ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { WidgetSize } from '@/entities/widget/model/types';
import styles from '@app/shell/ui/shell-app/ShellApp.module.scss';

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

type ShellWidgetCardProps = {
  id: string;
  size: WidgetSize;
  title: string;
  Icon: ComponentType;
  editMode: boolean;
  overId: string | null;
  activeId: string | null;
  supportedSizes: WidgetSize[];
  onSizeChange: (widgetId: string, size: WidgetSize) => void;
  children: ReactNode;
};

export function ShellWidgetCard({
  id,
  size,
  title,
  Icon,
  editMode,
  overId,
  activeId,
  supportedSizes,
  onSizeChange,
  children
}: ShellWidgetCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editMode
  });

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
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={styles.widgetFrame}>
        <div className={styles.widgetHead}>
          <div className={styles.widgetTitleWrap}>
            <span className={styles.widgetIcon}>
              <Icon />
            </span>
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

        <div className={[styles.widgetBody, editMode ? styles.widgetBodyEditMode : ''].filter(Boolean).join(' ')}>
          {children}
          {editMode ? (
            <div className={styles.widgetBodyLock} aria-hidden="true">
              <div className={styles.widgetBodyLockBadge}>Edit Mode</div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

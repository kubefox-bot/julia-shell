import type { CSSProperties } from 'react';
import type { LayoutItem, LayoutSettings, WidgetSize } from '../../../../entities/widget/model/types';
import styles from '../ShellApp.module.scss';

const SIZE_SPAN: Record<WidgetSize, number> = {
  small: 3,
  medium: 6,
  large: 12
};

type ShellSilhouetteGridProps = {
  items: LayoutItem[];
  layoutSettings: LayoutSettings;
  animate: boolean;
};

export function ShellSilhouetteGrid({ items, layoutSettings, animate }: ShellSilhouetteGridProps) {
  const columnsStyle = {
    '--desktop-columns': String(layoutSettings.desktopColumns),
    '--mobile-columns': String(layoutSettings.mobileColumns)
  } as CSSProperties;

  return (
    <section className={styles.grid} style={columnsStyle} aria-hidden="true">
      {items.map((item) => (
        <article
          key={`skeleton-${item.widgetId}`}
          className={[styles.widgetCard, styles.widgetSilhouetteCard, animate ? styles.widgetSilhouetteCardAnimated : ''].filter(Boolean).join(' ')}
          style={{ gridColumn: `span ${SIZE_SPAN[item.size]}` }}
        />
      ))}
    </section>
  );
}

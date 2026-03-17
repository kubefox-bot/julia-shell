import type { CSSProperties } from 'react';
import type { LayoutItem, LayoutSettings, WidgetSize } from '@/entities/widget/model/types';
import cardStyles from '@app/shell/ui/components/shell-widget-card/ShellWidgetCard.module.css';
import gridStyles from '@app/shell/ui/components/widget-grid/WidgetGrid.module.css';
import skeletonStyles from '../Skeleton.module.css';

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
    <section className={gridStyles.grid} style={columnsStyle} aria-hidden="true">
      {items.map((item) => (
        <article
          key={`skeleton-${item.widgetId}`}
          className={[
            cardStyles.widgetCard,
            skeletonStyles.widgetSilhouetteCard,
            animate ? skeletonStyles.widgetSilhouetteCardAnimated : ''
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ gridColumn: `span ${SIZE_SPAN[item.size]}` }}
        />
      ))}
    </section>
  );
}

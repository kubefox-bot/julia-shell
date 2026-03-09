import type { CSSProperties } from 'react';
import type { LayoutItem, LayoutSettings, WidgetSize } from '../../../../../entities/widget/model/types';
import shellStyles from '../../ShellApp.module.scss';
import skeletonStyles from './Skeleton.module.scss';

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
    <section className={shellStyles.grid} style={columnsStyle} aria-hidden="true">
      {items.map((item) => (
        <article
          key={`skeleton-${item.widgetId}`}
          className={[
            shellStyles.widgetCard,
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

import type { WidgetClientModule } from '../../entities/widget/model/types';
import { defineWidgetClientModule } from '../../entities/widget/model/define-widget';
import { weatherManifest } from './manifest';
import { WeatherWidget } from './ui/WeatherWidget';

export function registerClientWidget(): WidgetClientModule {
  return defineWidgetClientModule({
    manifest: weatherManifest,
    Render: WeatherWidget
  });
}

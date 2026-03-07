import type { WidgetClientModule } from '../../entities/widget/model/types';
import { defineWidgetClientModule } from '../../entities/widget/model/define-widget';
import { transcribeManifest } from './manifest';
import { TranscribeWidget } from './ui/TranscribeWidget';

export function registerClientWidget(): WidgetClientModule {
  return defineWidgetClientModule({
    manifest: transcribeManifest,
    Render: TranscribeWidget
  });
}

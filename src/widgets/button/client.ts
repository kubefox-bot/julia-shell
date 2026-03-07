import type { WidgetClientModule } from '../../entities/widget/model/types';
import { defineWidgetClientModule } from '../../entities/widget/model/define-widget';
import { buttonManifest } from './manifest';
import { ButtonWidget } from './ui/ButtonWidget';

export function registerClientWidget(): WidgetClientModule {
  return defineWidgetClientModule({
    manifest: buttonManifest,
    Render: ButtonWidget
  });
}

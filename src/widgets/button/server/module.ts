import type { WidgetServerModule } from '../../../entities/widget/model/types';
import { jsonResponse } from '../../../shared/lib/http';

export const buttonServerModule: WidgetServerModule = {
  handlers: {
    'GET status': async () => {
      return jsonResponse({ ok: true, widget: 'com.yulia.button' });
    }
  }
};

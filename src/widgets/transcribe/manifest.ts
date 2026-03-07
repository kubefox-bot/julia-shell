import type { WidgetManifest } from '../../entities/widget/model/types';

export const transcribeManifest: WidgetManifest = {
  id: 'com.yulia.transcribe',
  name: 'Transcribe',
  version: '1.0.0',
  description: 'Gemini-based m4a transcription widget with SSE and outbox.',
  headerName: {
    ru: 'Транскрибация',
    en: 'Transcribe'
  },
  icon: '🎙️',
  ready: true,
  defaultSize: 'large',
  supportedSizes: ['medium', 'large'],
  capabilities: ['sse', 'transcribe', 'filesystem', 'outbox'],
  channels: ['bus', 'webhook', 'ws']
};

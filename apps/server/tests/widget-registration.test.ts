import { describe, expect, it } from 'vitest';
import { registerWidget as registerTranscribeWidget } from '../src/widgets/transcribe/register';
import { registerWidget as registerWeatherWidget } from '../src/widgets/weather/register';

describe('widget registration', () => {
  it('returns manifest-driven DI module for weather', async () => {
    const module = registerWeatherWidget();
    const serverModule = await module.loadServerModule();

    expect(module.manifest.id).toBe('com.yulia.weather');
    expect(module.manifest.headerName.ru).toBe('Погода');
    expect(module.normalizedIcon).toEqual({ kind: 'text', value: '🌤️' });
    expect(typeof module.Render).toBe('function');
    expect(serverModule.handlers['GET forecast']).toBeTypeOf('function');
  });

  it('returns manifest-driven DI module for transcribe', async () => {
    const module = registerTranscribeWidget();
    const serverModule = await module.loadServerModule();

    expect(module.manifest.id).toBe('com.yulia.transcribe');
    expect(module.manifest.envName).toBe('transcribe');
    expect(module.manifest.headerName.en).toBe('Transcribe');
    expect(module.normalizedIcon).toEqual({ kind: 'text', value: '🎙️' });
    expect(typeof module.Render).toBe('function');
    expect(serverModule.handlers['POST transcribe-stream']).toBeTypeOf('function');
  });
});

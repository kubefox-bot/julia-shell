import { describe, expect, it } from 'vitest';
import { moduleBus } from '../src/shared/lib/module-bus';

describe('moduleBus', () => {
  it('publishes to exact topic subscribers', () => {
    const received: string[] = [];
    const unsubscribe = moduleBus.subscribe('topic:test', (event) => {
      received.push(event.topic);
    });

    moduleBus.publish('topic:test', 'unit-test', { ok: true });
    unsubscribe();

    expect(received).toEqual(['topic:test']);
  });

  it('publishes to wildcard subscribers', () => {
    const received: string[] = [];
    const unsubscribe = moduleBus.subscribe('*', (event) => {
      received.push(event.topic);
    });

    moduleBus.publish('topic:one', 'unit-test', {});
    moduleBus.publish('topic:two', 'unit-test', {});
    unsubscribe();

    expect(received).toEqual(['topic:one', 'topic:two']);
  });
});

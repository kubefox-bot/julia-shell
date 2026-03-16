import { describe, expect, it } from 'vitest';
import { resolvePassportStatusSnapshot } from '../src/domains/passport/server/runtime/status';

describe('agent status snapshot', () => {
  it('returns connected in production mode when online', () => {
    const snapshot = resolvePassportStatusSnapshot({
      hasOnlineSession: true,
      unauthorizedState: null
    });

    expect(snapshot.status).toBe('connected');
    expect(snapshot.reason).toBeNull();
  });

  it('returns unauthorized when no online session and auth reject exists', () => {
    const snapshot = resolvePassportStatusSnapshot({
      hasOnlineSession: false,
      unauthorizedState: {
        reason: 'Invalid access token.',
        updatedAt: '2026-03-08T12:00:00.000Z'
      }
    });

    expect(snapshot.status).toBe('unauthorized');
    expect(snapshot.reason).toBe('Invalid access token.');
  });

  it('returns disconnected when no online session and no auth reject', () => {
    const snapshot = resolvePassportStatusSnapshot({
      hasOnlineSession: false,
      unauthorizedState: null
    });

    expect(snapshot.status).toBe('disconnected');
    expect(snapshot.reason).toBeNull();
  });
});

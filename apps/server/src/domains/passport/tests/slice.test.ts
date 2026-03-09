import { create } from 'zustand';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchPassportStatusMock = vi.hoisted(() => vi.fn());
const retryPassportStatusMock = vi.hoisted(() => vi.fn());

vi.mock('../client/api', () => ({
  fetchPassportStatus: fetchPassportStatusMock,
  retryPassportStatus: retryPassportStatusMock
}));

vi.mock('../client/bus', () => ({
  dispatchPassportStatusChanged: vi.fn()
}));

import { createPassportSlice, type PassportSlice } from '../client/slice';

type TestStore = PassportSlice & {
  loadShell: () => Promise<void>;
};

function createTestStore(loadShell: () => Promise<void>) {
  return create<TestStore>()((...args) => ({
    loadShell,
    ...createPassportSlice(...(args as Parameters<typeof createPassportSlice>))
  }));
}

describe('passport zustand slice', () => {
  beforeEach(() => {
    fetchPassportStatusMock.mockReset();
    retryPassportStatusMock.mockReset();
  });

  it('syncFromStatus fills passport state and triggers shell reload on status transition', async () => {
    const loadShell = vi.fn(async () => undefined);
    fetchPassportStatusMock.mockResolvedValue({
      status: 'connected',
      label: 'Connected',
      updatedAt: '2026-03-09T10:00:00.000Z',
      reason: null,
      hostname: 'mac-local',
      agentId: 'agent-a'
    });

    const store = createTestStore(loadShell);
    await store.getState().syncFromStatus();

    expect(store.getState().authStatus).toBe('connected');
    expect(store.getState().agentId).toBe('agent-a');
    expect(store.getState().hasAccessToken).toBe(true);
    expect(loadShell).toHaveBeenCalledTimes(1);

    await store.getState().syncFromStatus();
    expect(loadShell).toHaveBeenCalledTimes(1);
  });

  it('retryStatus updates state and clears busy/loading flags', async () => {
    const loadShell = vi.fn(async () => undefined);
    retryPassportStatusMock.mockResolvedValue({
      status: 'connected_dev',
      label: 'Connected (dev)',
      updatedAt: '2026-03-09T10:00:00.000Z',
      reason: null,
      hostname: 'dev-host',
      agentId: 'agent-dev'
    });

    const store = createTestStore(loadShell);
    await store.getState().retryStatus();

    expect(store.getState().authStatus).toBe('connected_dev');
    expect(store.getState().passportBusy).toBe(false);
    expect(store.getState().passportLoading).toBe(false);
    expect(store.getState().error).toBeNull();
  });

  it('clearSessionState resets auth/session data', () => {
    const loadShell = vi.fn(async () => undefined);
    const store = createTestStore(loadShell);

    store.setState({
      agentId: 'agent-a',
      authStatus: 'connected',
      hasAccessToken: true,
      error: 'x',
      lastSyncAt: '2026-03-09T10:00:00.000Z'
    });

    store.getState().clearSessionState();
    expect(store.getState().agentId).toBeNull();
    expect(store.getState().authStatus).toBe('disconnected');
    expect(store.getState().hasAccessToken).toBe(false);
    expect(store.getState().error).toBeNull();
  });

  it('ensureCookie delegates to status sync', async () => {
    const loadShell = vi.fn(async () => undefined);
    fetchPassportStatusMock.mockResolvedValue({
      status: 'disconnected',
      label: 'Disconnected',
      updatedAt: '2026-03-09T10:00:00.000Z',
      reason: null,
      hostname: null,
      agentId: null
    });

    const store = createTestStore(loadShell);
    await store.getState().ensureCookie();
    expect(fetchPassportStatusMock).toHaveBeenCalledTimes(1);
  });
});

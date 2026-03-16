import { create } from 'zustand';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolvePassportTrafficLightState } from '../ui/status-badge/resolve-traffic-light-state';

const fetchPassportStatusMock = vi.hoisted(() => vi.fn());
const fetchPassportOnlineAgentsMock = vi.hoisted(() => vi.fn());
const connectPassportAgentMock = vi.hoisted(() => vi.fn());
const retryPassportStatusMock = vi.hoisted(() => vi.fn());

vi.mock('../client/api', () => ({
  connectPassportAgent: connectPassportAgentMock,
  fetchPassportOnlineAgents: fetchPassportOnlineAgentsMock,
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
    connectPassportAgentMock.mockReset();
    fetchPassportOnlineAgentsMock.mockReset();
    fetchPassportStatusMock.mockReset();
    retryPassportStatusMock.mockReset();
    fetchPassportOnlineAgentsMock.mockResolvedValue({ agents: [] });
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
    fetchPassportOnlineAgentsMock.mockResolvedValue({
      agents: [
        {
          agentId: 'agent-a',
          displayName: 'Max',
          hostname: 'mac-local',
          connectedAt: '2026-03-09T10:00:00.000Z',
          lastHeartbeatAt: '2026-03-09T10:01:00.000Z',
          isCurrent: true
        }
      ]
    });

    const store = createTestStore(loadShell);
    await store.getState().syncFromStatus();

    expect(store.getState().authStatus).toBe('connected');
    expect(store.getState().agentId).toBe('agent-a');
    expect(store.getState().passportAgents).toHaveLength(1);
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
    fetchPassportOnlineAgentsMock.mockResolvedValue({
      agents: [
        {
          agentId: 'agent-dev',
          displayName: 'Dev',
          hostname: 'dev-host',
          connectedAt: '2026-03-09T10:00:00.000Z',
          lastHeartbeatAt: '2026-03-09T10:01:00.000Z',
          isCurrent: true
        }
      ]
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
      passportAgents: [
        {
          agentId: 'agent-a',
          connectedAt: '2026-03-09T10:00:00.000Z',
          lastHeartbeatAt: '2026-03-09T10:01:00.000Z',
          isCurrent: true
        }
      ],
      error: 'x',
      lastSyncAt: '2026-03-09T10:00:00.000Z'
    });

    store.getState().clearSessionState();
    expect(store.getState().agentId).toBeNull();
    expect(store.getState().passportAgents).toEqual([]);
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

  it('connectAgent binds browser and reloads shell', async () => {
    const loadShell = vi.fn(async () => undefined);
    connectPassportAgentMock.mockResolvedValue({
      status: 'connected',
      label: 'Connected',
      updatedAt: '2026-03-09T10:00:00.000Z',
      reason: null,
      hostname: 'yulia-win',
      agentId: 'agent-b'
    });
    fetchPassportOnlineAgentsMock.mockResolvedValue({
      agents: [
        {
          agentId: 'agent-b',
          displayName: 'Yulia',
          hostname: 'yulia-win',
          connectedAt: '2026-03-09T10:00:00.000Z',
          lastHeartbeatAt: '2026-03-09T10:01:00.000Z',
          isCurrent: true
        }
      ]
    });

    const store = createTestStore(loadShell);
    await store.getState().connectAgent('agent-b');

    expect(store.getState().agentId).toBe('agent-b');
    expect(store.getState().passportAgents[0]?.isCurrent).toBe(true);
    expect(
      resolvePassportTrafficLightState({
        status: store.getState().authStatus,
        onlineAgentsCount: store.getState().passportAgents.length
      })
    ).toBe('green');
    expect(loadShell).toHaveBeenCalledTimes(1);
  });

  it('does not switch to loading on background sync when status already exists', async () => {
    const loadShell = vi.fn(async () => undefined);
    const store = createTestStore(loadShell);

    store.setState({
      passportStatus: {
        status: 'connected',
        label: 'Connected',
        updatedAt: '2026-03-09T10:00:00.000Z',
        reason: null,
        hostname: 'dev-host',
        agentId: 'agent-a',
      },
      passportLoading: false,
    });

    let releaseStatus: () => void = () => undefined;
    fetchPassportStatusMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseStatus = () =>
            resolve({
              status: 'connected',
              label: 'Connected',
              updatedAt: '2026-03-09T10:00:01.000Z',
              reason: null,
              hostname: 'dev-host',
              agentId: 'agent-a',
            });
        })
    );
    fetchPassportOnlineAgentsMock.mockResolvedValue({ agents: [] });

    const syncPromise = store.getState().syncFromStatus();
    expect(store.getState().passportLoading).toBe(false);

    releaseStatus();
    await syncPromise;
    expect(store.getState().passportLoading).toBe(false);
  });
});

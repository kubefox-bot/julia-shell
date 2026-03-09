import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as shellApi from '../src/app/shell/lib/api'
import {
  SHELL_STATUS_POLL_INTERVAL_DEFAULT_MS,
  SHELL_STATUS_POLL_INTERVAL_MAX_MS,
  SHELL_STATUS_POLL_INTERVAL_MIN_MS,
} from '../src/app/shell/model/constants'
import { createShellStore } from '../src/app/shell/model/store'
import type { ShellSettingsResponse } from '../src/app/shell/model/types'

const CUSTOM_POLL_INTERVAL_MS = 2345
const BELOW_MIN_POLL_INTERVAL_MS = SHELL_STATUS_POLL_INTERVAL_MIN_MS - 10
const ABOVE_MAX_POLL_INTERVAL_MS = SHELL_STATUS_POLL_INTERVAL_MAX_MS + 10

vi.mock('../src/app/shell/lib/api', () => ({
  fetchShellSettings: vi.fn(),
  saveShellLayout: vi.fn(),
  toggleModule: vi.fn(),
}))

function createResponse(overrides?: Partial<ShellSettingsResponse>): ShellSettingsResponse {
  return {
    platform: 'windows',
    layoutSettings: {
      desktopColumns: 12,
      mobileColumns: 1,
      locale: 'system',
      theme: 'auto',
    },
    layout: [],
    modules: [],
    statusPollIntervalMs: SHELL_STATUS_POLL_INTERVAL_DEFAULT_MS,
    ...overrides,
  }
}

describe('shell poll interval', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('loads polling interval from server payload', async () => {
    vi.mocked(shellApi.fetchShellSettings).mockResolvedValue(
      createResponse({ statusPollIntervalMs: CUSTOM_POLL_INTERVAL_MS })
    )
    const store = createShellStore()

    await store.getState().loadShell()

    expect(store.getState().statusPollIntervalMs).toBe(CUSTOM_POLL_INTERVAL_MS)
  })

  it('sanitizes polling interval to min and max bounds', () => {
    const store = createShellStore()

    store
      .getState()
      .hydrateShell(createResponse({ statusPollIntervalMs: BELOW_MIN_POLL_INTERVAL_MS }))
    expect(store.getState().statusPollIntervalMs).toBe(SHELL_STATUS_POLL_INTERVAL_MIN_MS)

    store
      .getState()
      .hydrateShell(createResponse({ statusPollIntervalMs: ABOVE_MAX_POLL_INTERVAL_MS }))
    expect(store.getState().statusPollIntervalMs).toBe(SHELL_STATUS_POLL_INTERVAL_MAX_MS)
  })
})

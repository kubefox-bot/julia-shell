import { describe, expect, it } from 'vitest'
import type { PassportAuthStatus } from '../client/types'
import { getLampClassKey } from '../ui/status-badge/get-lamp-class'
import { getStatusCopyKey } from '../ui/status-badge/get-status-copy-key'
import { resolvePassportTrafficLightState } from '../ui/status-badge/resolve-traffic-light-state'

describe('passport status-badge helpers', () => {
  it('resolves traffic light state from status and online agents', () => {
    const cases: Array<{
      status: PassportAuthStatus
      onlineAgentsCount: number
      expected: 'red' | 'yellow' | 'green'
    }> = [
      { status: 'connected', onlineAgentsCount: 0, expected: 'green' },
      { status: 'connected_dev', onlineAgentsCount: 0, expected: 'green' },
      { status: 'unauthorized', onlineAgentsCount: 0, expected: 'yellow' },
      { status: 'disconnected', onlineAgentsCount: 2, expected: 'yellow' },
      { status: 'disconnected', onlineAgentsCount: 0, expected: 'red' },
    ]

    for (const sample of cases) {
      expect(
        resolvePassportTrafficLightState({
          status: sample.status,
          onlineAgentsCount: sample.onlineAgentsCount,
        })
      ).toBe(sample.expected)
    }
  })

  it('resolves lamp class key for every traffic light state', () => {
    expect(getLampClassKey('green')).toBe('agentLampGreen')
    expect(getLampClassKey('yellow')).toBe('agentLampYellow')
    expect(getLampClassKey('red')).toBe('agentLampRed')
  })

  it('returns status copy key from traffic light and status', () => {
    expect(
      getStatusCopyKey({
        status: 'connected',
        trafficLightState: 'green',
      })
    ).toBe('agentStatusConnected')
    expect(
      getStatusCopyKey({
        status: 'connected_dev',
        trafficLightState: 'green',
      })
    ).toBe('agentStatusConnectedDev')
    expect(
      getStatusCopyKey({
        status: 'unauthorized',
        trafficLightState: 'yellow',
      })
    ).toBe('agentStatusNeedsSelection')
    expect(
      getStatusCopyKey({
        status: 'disconnected',
        trafficLightState: 'yellow',
      })
    ).toBe('agentStatusNeedsSelection')
    expect(
      getStatusCopyKey({
        status: 'disconnected',
        trafficLightState: 'red',
      })
    ).toBe('agentStatusNoAgents')
  })
})

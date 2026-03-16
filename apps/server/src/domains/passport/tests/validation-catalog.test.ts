import { describe, expect, it } from 'vitest'
import { PASSPORT_VALIDATION_CATALOG, parseRequestBody } from '../server/validation'

describe('passport validation catalog', () => {
  it('maps enroll schema to required fields error', () => {
    const parsedResult = parseRequestBody(PASSPORT_VALIDATION_CATALOG.enroll.schema, {
      enrollment_token: 'token-only',
    })

    expect(parsedResult.isErr()).toBe(true)
    expect(PASSPORT_VALIDATION_CATALOG.enroll.errorKey).toBe('missingEnrollFields')
  })

  it('parses refresh payload and trims values', () => {
    const parsedResult = parseRequestBody(PASSPORT_VALIDATION_CATALOG.refresh.schema, {
      agent_id: '  agent-a  ',
      refresh_token: '  refresh-token  ',
    })

    expect(parsedResult.isOk()).toBe(true)
    if (parsedResult.isErr()) {
      return
    }

    expect(parsedResult.unwrap()).toEqual({
      agent_id: 'agent-a',
      refresh_token: 'refresh-token',
    })
  })
})

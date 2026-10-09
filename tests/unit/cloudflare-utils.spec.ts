import type { H3Event } from 'h3'
import type { Compilable } from 'kysely'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCreateLog, writeAccessLog } from '../../server/utils/access-log'
import { useWAE } from '../../server/utils/cloudflare'

vi.mock('#shared/utils/flag', () => ({ getFlag: vi.fn() }))

const event = {
  context: {
    cloudflare: { env: {} },
    link: { id: 'link-id' },
  },
} as unknown as H3Event

const query = {} as Compilable

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('writeAccessLog', () => {
  it('keeps the explicit link ID and event type when writing creation events', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const writeDataPoint = vi.fn()
    const creationEvent = {
      context: {
        cloudflare: { env: { ANALYTICS: { writeDataPoint } } },
      },
    } as unknown as H3Event
    writeAccessLog(creationEvent, { eventType: 'create', slug: 'created' }, 'created-id')
    expect(writeDataPoint).toHaveBeenCalledWith(expect.objectContaining({
      indexes: ['created-id'],
      blobs: expect.arrayContaining(['created', 'create']),
    }))
    expect(writeDataPoint.mock.calls[0][0].blobs[16]).toBe('create')
  })

  it('does not let an analytics error fail a successful link creation', () => {
    vi.stubGlobal('getHeader', () => {
      throw new Error('analytics unavailable')
    })
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => useCreateLog(event, { id: 'id', slug: 'slug', url: 'https://example.com' })).not.toThrow()
    expect(errorLog).toHaveBeenCalled()
    errorLog.mockRestore()
  })

  it('silently skips production writes without an Analytics Engine binding', () => {
    vi.stubEnv('NODE_ENV', 'production')

    expect(() => writeAccessLog(event, {})).not.toThrow()
  })
})

describe('useWAE', () => {
  it.each([
    { cfAccountId: '', cfApiToken: 'token' },
    { cfAccountId: 'account', cfApiToken: '' },
  ])('returns empty data without requesting when credentials are incomplete', (config) => {
    const fetchMock = vi.fn()
    vi.stubGlobal('useRuntimeConfig', () => config)
    vi.stubGlobal('$fetch', fetchMock)

    expect(useWAE(event, query)).toEqual({ data: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('preserves requests and propagates errors when credentials are complete', async () => {
    const error = new Error('forbidden')
    const fetchMock = vi.fn().mockRejectedValue(error)
    vi.stubGlobal('useRuntimeConfig', () => ({
      cfAccountId: 'account',
      cfApiToken: 'token',
    }))
    vi.stubGlobal('compileAnalyticsQuery', () => 'select * from sink')
    vi.stubGlobal('$fetch', fetchMock)

    await expect(useWAE(event, query)).rejects.toBe(error)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/account/analytics_engine/sql',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
        body: 'select * from sink',
        retry: 1,
        retryDelay: 100,
      },
    )
  })
})

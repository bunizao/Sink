import type { H3Event } from 'h3'
import type { FilterQuery, Query } from '../../shared/schemas/query'
import { describe, expect, it, vi } from 'vitest'
import {
  buildAccessExportQuery,
  buildCountersQuery,
  buildEventsQuery,
  buildHeatmapQuery,
  buildLocationsQuery,
  buildMetricsQuery,
  buildViewsQuery,
} from '../../server/utils/analytics-queries'
import { compileAnalyticsQuery } from '../../server/utils/analytics-sql'

vi.hoisted(() => {
  Object.assign(globalThis, {
    useRuntimeConfig: () => ({ dataset: 'sink', listQueryLimit: '500' }),
  })
})

vi.mock('#shared/schemas/query', async () => import('../../shared/schemas/query'))

vi.mock('../../server/utils/access-log', async () => {
  const blobsMap = {
    blob1: 'slug',
    blob2: 'url',
    blob3: 'ua',
    blob4: 'ip',
    blob5: 'referer',
    blob6: 'country',
    blob7: 'region',
    blob8: 'city',
    blob9: 'timezone',
    blob10: 'language',
    blob11: 'os',
    blob12: 'browser',
    blob13: 'browserType',
    blob14: 'device',
    blob15: 'deviceType',
    blob16: 'COLO',
  }
  const doublesMap = {
    double1: 'latitude',
    double2: 'longitude',
  }
  return {
    blobsMap,
    doublesMap,
    logsMap: Object.fromEntries([
      ...Object.entries(blobsMap),
      ...Object.entries(doublesMap),
    ].map(([column, name]) => [name, column])),
  }
})

const event = {} as H3Event
const filters: FilterQuery = { slug: 'abc' }

describe('analytics query builders', () => {
  it('excludes creation events from every access analytics query while retaining legacy records', () => {
    const statements = [
      buildCountersQuery({}, event),
      buildViewsQuery({ unit: 'day', clientTimezone: 'Etc/UTC' }, event),
      buildMetricsQuery({ type: 'browser', limit: 10 }, event),
      buildHeatmapQuery({ clientTimezone: 'Etc/UTC' }, event),
      buildAccessExportQuery({}, event),
      buildEventsQuery({ limit: 10 }, event),
      buildLocationsQuery({ limit: 10 }, event),
    ]
    for (const statement of statements) {
      const compiled = compileAnalyticsQuery(statement)
      expect(compiled).toContain('(blob17 = \'access\' or blob17 = \'\')')
      expect(compiled).not.toContain('blob17 = \'create\'')
    }
  })

  it('compiles counters without a LIMIT clause', () => {
    expect(compileAnalyticsQuery(buildCountersQuery(filters, event)))
      .toBe('select SUM(_sample_interval) as visits, ROUND(COUNT(DISTINCT blob4) * SUM(_sample_interval) / COUNT()) as visitors, ROUND(COUNT(DISTINCT blob5) * SUM(_sample_interval) / COUNT()) as referers from sink where (blob17 = \'access\' or blob17 = \'\') and blob1 in (\'abc\')')
  })

  it('compiles views buckets with the client timezone and no LIMIT', () => {
    const compiled = compileAnalyticsQuery(buildViewsQuery({ ...filters, unit: 'hour', clientTimezone: 'Asia/Shanghai' }, event))

    expect(compiled).toContain('formatDateTime(timestamp, \'%Y-%m-%d %H\', \'Asia/Shanghai\') as time')
    expect(compiled).toContain('group by time')
    expect(compiled).not.toContain('limit')
  })

  it('falls back to Etc/UTC for an unknown client timezone', () => {
    const compiled = compileAnalyticsQuery(buildViewsQuery({ unit: 'day', clientTimezone: 'Not/A-Zone' }, event))

    expect(compiled).toContain('\'Etc/UTC\'')
  })

  it('compiles the heatmap without a LIMIT clause', () => {
    const compiled = compileAnalyticsQuery(buildHeatmapQuery({ clientTimezone: 'Etc/UTC' }, event))

    expect(compiled).toContain('group by weekday, hour')
    expect(compiled).not.toContain('limit')
  })

  it('inlines the validated row limit for metrics', () => {
    const query: Query & { type: 'browser' } = { type: 'browser', limit: 25 }
    const compiled = compileAnalyticsQuery(buildMetricsQuery(query, event))

    expect(compiled).toContain('group by name order by count desc limit 25')
  })

  it('builds filter-only queries without any parameters', () => {
    for (const compiled of [
      compileAnalyticsQuery(buildCountersQuery({}, event)),
      compileAnalyticsQuery(buildViewsQuery({ unit: 'minute', clientTimezone: 'Etc/UTC' }, event)),
      compileAnalyticsQuery(buildHeatmapQuery({ clientTimezone: 'Etc/UTC' }, event)),
    ]) {
      expect(compiled).toContain('from sink')
      expect(compiled).toContain('where (blob17 = \'access\' or blob17 = \'\')')
      expect(compiled).not.toContain('?')
    }
  })
})

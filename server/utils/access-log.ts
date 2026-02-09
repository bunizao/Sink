import type { H3Event } from 'h3'
import { parseAcceptLanguage } from 'intl-parse-accept-language'
import { UAParser } from 'ua-parser-js'
import {
  CLIs,
  Crawlers,
  Emails,
  ExtraDevices,
  Fetchers,
  InApps,
  MediaPlayers,
  Vehicles,
} from 'ua-parser-js/extensions'
import { parseURL } from 'ufo'
import { getFlag } from '@/utils/flag'

function toBlobNumber(blob: string) {
  return +blob.replace(/\D/g, '')
}

export const blobsMap = {
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
  blob17: 'eventType',
} as const

export const doublesMap = {
  double1: 'latitude',
  double2: 'longitude',
} as const

export type BlobsMap = typeof blobsMap
export type BlobsKey = keyof BlobsMap

export type DoublesMap = typeof doublesMap
export type DoublesKey = keyof DoublesMap

export type LogsKey = BlobsMap[BlobsKey] | DoublesMap[DoublesKey]
export type LogsMap = {
  [key in BlobsMap[BlobsKey]]: string | undefined
} & {
  [key in DoublesMap[DoublesKey]]?: number | undefined
}

export const logsMap = Object.fromEntries([
  ...Object.entries(blobsMap).map(([k, v]) => [v, k]),
  ...Object.entries(doublesMap).map(([k, v]) => [v, k]),
]) as LogsMap

export function logs2blobs(logs: LogsMap) {
  return (Object.keys(blobsMap) as BlobsKey[])
    .sort((a, b) => toBlobNumber(a) - toBlobNumber(b))
    .map(key => String(logs[blobsMap[key] as LogsKey] || ''))
}

export function blobs2logs(blobs: string[]) {
  const logsList = Object.keys(blobsMap)

  return blobs.reduce((logs, blob, i) => {
    const key = blobsMap[logsList[i] as BlobsKey]
    logs[key] = blob
    return logs
  }, {} as Partial<LogsMap>)
}

export function logs2doubles(logs: LogsMap) {
  return (Object.keys(doublesMap) as DoublesKey[])
    .sort((a, b) => toBlobNumber(a) - toBlobNumber(b))
    .map(key => Number(logs[doublesMap[key] as LogsKey] || 0))
}

export function doubles2logs(doubles: number[]) {
  const logsList = Object.keys(doublesMap)

  return doubles.reduce((logs, double, i) => {
    const key = doublesMap[logsList[i] as DoublesKey]
    logs[key] = double
    return logs
  }, {} as Partial<LogsMap>)
}

type LogEventType = 'access' | 'create'

interface LogLinkContext {
  id?: string
  slug?: string
  url?: string
}

interface RequestLogContext {
  cf: IncomingRequestCfProperties | undefined
  ip: string | undefined
  language: string | undefined
  referer: string | undefined
  uaInfo: ReturnType<UAParser['getResult']>
  userAgent: string
}

function getRequestLogContext(event: H3Event): RequestLogContext {
  const ip = getHeader(event, 'cf-connecting-ip') || getHeader(event, 'x-real-ip') || getRequestIP(event, { xForwardedFor: true })
  const { host: referer } = parseURL(getHeader(event, 'referer'))

  const acceptLanguage = getHeader(event, 'accept-language') || ''
  const language = (parseAcceptLanguage(acceptLanguage) || [])[0]

  const userAgent = getHeader(event, 'user-agent') || ''
  const uaInfo = (new UAParser(userAgent, {

    // @ts-expect-error
    browser: [Crawlers.browser || [], CLIs.browser || [], Emails.browser || [], Fetchers.browser || [], InApps.browser || [], MediaPlayers.browser || [], Vehicles.browser || []].flat(),

    // @ts-expect-error
    device: [ExtraDevices.device || []].flat(),
  })).getResult()

  const { cloudflare } = event.context
  const { request: { cf } } = cloudflare

  return {
    cf,
    ip,
    language,
    referer,
    uaInfo,
    userAgent,
  }
}

function createRequestLogs(event: H3Event, link: LogLinkContext, request: RequestLogContext, eventType: LogEventType): LogsMap {
  const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
  const countryName = regionNames.of(request.cf?.country || 'WD') // fallback to "Worldwide"

  return {
    url: link.url,
    slug: link.slug,
    ua: request.userAgent,
    ip: request.ip,
    referer: request.referer,
    country: request.cf?.country,
    region: `${getFlag(request.cf?.country)} ${[request.cf?.region, countryName].filter(Boolean).join(',')}`,
    city: `${getFlag(request.cf?.country)} ${[request.cf?.city, countryName].filter(Boolean).join(',')}`,
    timezone: request.cf?.timezone,
    language: request.language,
    os: request.uaInfo?.os?.name,
    browser: request.uaInfo?.browser?.name,
    browserType: request.uaInfo?.browser?.type,
    device: request.uaInfo?.device?.model,
    deviceType: request.uaInfo?.device?.type,
    COLO: request.cf?.colo,
    eventType,

    // For RealTime Globe
    latitude: Number(request.cf?.latitude || getHeader(event, 'cf-iplatitude') || 0),
    longitude: Number(request.cf?.longitude || getHeader(event, 'cf-iplongitude') || 0),
  }
}

export function useAccessLog(event: H3Event) {
  const requestLogContext = getRequestLogContext(event)
  const { cloudflare } = event.context
  const { env } = cloudflare
  const link = event.context.link || {}

  const isBot = requestLogContext.cf?.botManagement?.verifiedBot
    || ['crawler', 'fetcher'].includes(requestLogContext.uaInfo?.browser?.type || '')
    || ['spider', 'bot'].includes(requestLogContext.uaInfo?.browser?.name?.toLowerCase() || '')

  const { disableBotAccessLog } = useRuntimeConfig(event)
  if (isBot && disableBotAccessLog) {
    console.log('bot access log disabled:', requestLogContext.userAgent)
    return Promise.resolve()
  }

  const accessLogs = createRequestLogs(event, link, requestLogContext, 'access')

  if (process.env.NODE_ENV === 'production') {
    return env.ANALYTICS.writeDataPoint({
      indexes: [link.id], // only one index
      blobs: logs2blobs(accessLogs),
      doubles: logs2doubles(accessLogs),
    })
  }

  console.log('access logs:', accessLogs, logs2blobs(accessLogs), logs2doubles(accessLogs), { ...blobs2logs(logs2blobs(accessLogs)), ...doubles2logs(logs2doubles(accessLogs)) })
  return Promise.resolve()
}

export function useCreateLog(event: H3Event, link: Required<LogLinkContext>) {
  const requestLogContext = getRequestLogContext(event)
  const { cloudflare } = event.context
  const { env } = cloudflare
  const createLogs = createRequestLogs(event, link, requestLogContext, 'create')

  if (process.env.NODE_ENV === 'production') {
    return env.ANALYTICS.writeDataPoint({
      indexes: [link.id],
      blobs: logs2blobs(createLogs),
      doubles: logs2doubles(createLogs),
    })
  }

  console.log('create logs:', createLogs, logs2blobs(createLogs), logs2doubles(createLogs), { ...blobs2logs(logs2blobs(createLogs)), ...doubles2logs(logs2doubles(createLogs)) })
  return Promise.resolve()
}

import {
  FirstPartyApiAnalytics,
  FirstPartyApiErrorReporter,
  type AnalyticsEventName,
  type AnalyticsEventProperties,
  type ClientErrorReport,
} from "@hoodna/shared"

import api from "@/lib/api"

const transport = {
  post: async <T,>(endpoint: string, body: unknown): Promise<T> => {
    const response = await api.post<T>(endpoint, body)
    return response.data
  },
}

const analytics = new FirstPartyApiAnalytics(transport, 1)
const errorReporter = new FirstPartyApiErrorReporter(transport)

export function track<K extends AnalyticsEventName>(
  event: K,
  properties: AnalyticsEventProperties[K] = {} as AnalyticsEventProperties[K],
) {
  void analytics.track(event, {
    platform: "web",
    ...properties,
  }).catch(() => undefined)
}

function fingerprint(error: unknown) {
  const value = error instanceof Error ? `${error.name}:${error.stack || error.message}` : String(error)
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash).toString(36)
}

export function reportError(
  error: unknown,
  details: Partial<Pick<ClientErrorReport, "error_kind" | "route" | "request_id" | "status_code">> = {},
) {
  const report: ClientErrorReport = {
    error_code: error instanceof Error ? error.name.slice(0, 100) : "unknown_error",
    error_kind: details.error_kind || "unknown",
    occurred_at: new Date().toISOString(),
    platform: "web",
    environment: process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_RELEASE,
    route: details.route || (typeof window !== "undefined" ? window.location.pathname : undefined),
    request_id: details.request_id,
    status_code: details.status_code,
    stack_fingerprint: fingerprint(error),
  }
  void errorReporter.capture(report).catch(() => undefined)
}

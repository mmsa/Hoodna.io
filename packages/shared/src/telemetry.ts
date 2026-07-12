import {
  AnalyticsEvent,
  AnalyticsEventBatch,
  AnalyticsEventName,
  AnalyticsEventProperties,
  ClientErrorReport,
  sanitizeAnalyticsProperties,
} from "./schemas/analytics";

export interface TelemetryTransport {
  post<TResponse = unknown>(endpoint: string, body: unknown): Promise<TResponse>;
}

export interface Analytics {
  track<K extends AnalyticsEventName>(
    event: K,
    properties?: AnalyticsEventProperties[K],
  ): Promise<void>;
  flush?(): Promise<void>;
}

export interface ErrorReporter {
  capture(report: ClientErrorReport): Promise<void>;
}

export class NoopAnalytics implements Analytics {
  async track<K extends AnalyticsEventName>(
    _event: K,
    _properties?: AnalyticsEventProperties[K],
  ): Promise<void> {}
}

export class NoopErrorReporter implements ErrorReporter {
  async capture(_report: ClientErrorReport): Promise<void> {}
}

export class FirstPartyApiAnalytics implements Analytics {
  private queue: AnalyticsEvent[] = [];

  constructor(
    private readonly transport: TelemetryTransport,
    private readonly batchSize = 20,
  ) {}

  async track<K extends AnalyticsEventName>(
    event: K,
    properties: AnalyticsEventProperties[K] = {} as AnalyticsEventProperties[K],
  ): Promise<void> {
    this.queue.push({
      event,
      properties: sanitizeAnalyticsProperties(
        event,
        properties as Record<string, unknown>,
        "reject",
      ),
      occurred_at: new Date().toISOString(),
    });
    if (this.queue.length >= this.batchSize) await this.flush();
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch: AnalyticsEventBatch = { events: this.queue.splice(0, this.batchSize) };
    try {
      await this.transport.post("/api/telemetry/events", batch);
    } catch (error) {
      this.queue.unshift(...batch.events);
      throw error;
    }
  }
}

export class FirstPartyApiErrorReporter implements ErrorReporter {
  constructor(private readonly transport: TelemetryTransport) {}

  async capture(report: ClientErrorReport): Promise<void> {
    await this.transport.post("/api/telemetry/errors", report);
  }
}

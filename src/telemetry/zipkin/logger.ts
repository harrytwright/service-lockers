import zipkin from 'zipkin'
import { timing } from '@harrytwright/logger'

export class Logger {
  logger: (namespace: string, ctx: {}, format: string, ...args: any[]) => void

  constructor() {
    this.logger = timing
  }

  /* istanbul ignore next */
  logSpan(span: zipkin.model.Span) {
    this.logger(
      'zipkin',
      { ...span, trace: span.id },
      'took %d for %s',
      span.duration ?? 0,
      span.name ?? 'span'
    )
  }
}

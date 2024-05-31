import { hostname } from 'os'

import log from '@harrytwright/logger'
import CLSContext from 'zipkin-context-cls'
import { Config } from '@harrytwright/cli-config'
import { HttpLogger } from 'zipkin-transport-http'
import zipkin, { BatchRecorder, Tracer, jsonEncoder } from 'zipkin'
import {
  register,
  WillBootstrap,
  UsesConfig,
  Inject,
} from '@harrytwright/api/dist/core'

import { Logger } from './logger'
import type { AppConfig } from '../../config'

const JSON_V2 = jsonEncoder.JSON_V2

let tracer: Tracer

@register('singleton')
export class Zipkin implements UsesConfig, WillBootstrap {
  // We need to grab the zipkin value
  @Inject('config')
  config: Config<AppConfig>

  /* istanbul ignore next */
  get tracer(): Tracer | undefined {
    if (!this.recorder || !this.localService) return

    if (!tracer) {
      tracer = new Tracer({
        recorder: this.recorder,
        ctxImpl: new CLSContext(this.localService, true),
        localServiceName: this.localService,
        defaultTags: {
          hostname: hostname(),
        },
      })
    }

    return tracer
  }

  localService?: string

  recorder?: zipkin.Recorder

  url?: string

  bootstrap() {
    this.localService = this.config.get('name')

    const zipkin = this.config.get('zipkin')

    if (!zipkin) {
      log.warn('zipkin', {}, 'Zipkin will not be initialised')
      log.warn('zipkin', {}, 'If you wish to use zipkin run with --zipkin')
      log.warn('zipkin', {}, `Or use '${this.localService}:zipkin'`)
      return // Just exit here
    }

    if (typeof zipkin === 'string') this.url = zipkin

    /* istanbul ignore next */
    this.recorder = new BatchRecorder({
      logger:
        typeof zipkin !== 'string'
          ? new Logger()
          : new HttpLogger({
              endpoint: `${zipkin}/api/v2/spans`,
              jsonEncoder: JSON_V2, // JSON encoder to use. Optional (defaults to JSON_V1)
              httpInterval: 1000,
              timeout: 1000,
              agent: new (require('http').Agent)({ keepAlive: true }),
            }),
    })
  }
}

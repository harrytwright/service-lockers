import log from '@harrytwright/logger'
import Axios, { AxiosInstance } from 'axios'
import { Config } from '@harrytwright/cli-config'
import {
  Inject,
  register,
  UsesConfig,
  WillBootstrap,
} from '@harrytwright/api/dist/core'

import { AppConfig } from '../../../config'
import { Request } from '../../../telemetry/zipkin/request/request.service'

/**
 * Wrapper for the axios HTTP-client.
 *
 */
@register()
export class TokenService implements UsesConfig, WillBootstrap {
  @Inject('config')
  config: Config<AppConfig>

  axios: AxiosInstance

  constructor(private readonly request: Request) {}

  bootstrap() {
    log.info('tokens-service:bootstrap', 'Creating Axios instance')

    this.axios = Axios.create({
      baseURL:
        this.config.get('services-token-url') || 'http://localhost:15678',
    })

    this.request.updateInterceptors(this.axios)
  }
}

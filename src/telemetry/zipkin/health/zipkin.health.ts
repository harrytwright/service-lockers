import Axios from 'axios'
import { Config } from '@harrytwright/cli-config'

import { register, UsesConfig, Inject } from '@harrytwright/api/dist/core'

import { Request } from '../request/request.service'
import { HealthIndicator } from '../../../utils/health/types/health-indicator.type'
import { AppConfig } from '../../../config'
import { Zipkin } from '../index'

@register('transient')
export class ZipkinHealth implements UsesConfig {
  @Inject('config')
  config: Config<AppConfig>

  constructor(
    private readonly request: Request,
    private readonly zipkin: Zipkin
  ) {}

  public async checkConnection(key: string): Promise<HealthIndicator> {
    /* istanbul ignore if */
    if (!this.zipkin.url)
      return Promise.resolve({
        error: new Error('Not using Zipkin'),
        key,
      })

    const axios = Axios.create({
      baseURL: this.zipkin.url,
    })

    this.request.updateInterceptors(axios)

    try {
      const response = await axios.get<{ status: string }>('/health', {
        timeout: 300,
      })

      /* istanbul ignore next */
      if (response.data.status !== 'UP' || !response.data)
        return { error: new Error('`zipkin` service is not yet ready'), key }

      return { status: 'healthy', key }
    } catch (err) /* istanbul ignore next */ {
      return { error: err instanceof Error ? err : new Error(String(err)), key }
    }
  }
}

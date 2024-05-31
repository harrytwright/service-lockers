import { register } from '@harrytwright/api/dist/core'

import { HealthIndicator } from '../../../utils/health/types/health-indicator.type'
import { TokenModule } from '../token.module'

@register('transient')
export class TokenHealth {
  constructor(private readonly module: TokenModule) {}

  public async checkConnection(key: string): Promise<HealthIndicator> {
    try {
      const response = await this.module.createNewToken({
        permissions: [],
        audience: 'self',
        service: 'self',
      })

      /* istanbul ignore next */
      if (typeof response !== 'string')
        return { error: new Error('`tokens` service is not yet ready'), key }

      return { status: 'healthy', key }
    } catch (err) /* istanbul ignore next */ {
      return { error: err instanceof Error ? err : new Error(String(err)), key }
    }
  }
}

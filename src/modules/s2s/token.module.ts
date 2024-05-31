import { Config } from '@harrytwright/cli-config'
import {
  Inject,
  register,
  UsesConfig,
  WillBootstrap,
} from '@harrytwright/api/dist/core'
// import jwt from 'supertokens-node/recipe/jwt'

import { AppConfig } from '../../config'
import { TokenService } from './services/token.service'

export interface JWTBody {
  permissions: string[]
  audience: string
  service: string
}

@register('singleton')
export class TokenModule implements UsesConfig, WillBootstrap {
  @Inject('config')
  config: Config<AppConfig>

  constructor(private readonly service: TokenService) {}

  bootstrap() {
    /* istanbul ignore next */
    if (this.config.get('services-token-url') === undefined) {
      throw new Error('Token service cannot be mocked, it is needed')
    }
  }

  async createNewToken(jwt: JWTBody) {
    return (
      await this.service.axios.post<string>('/tokens', jwt, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': this.config.get('token-api-key'),
        },
      })
    ).data
  }
}

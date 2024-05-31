import express from 'express'
import { Config } from '@harrytwright/cli-config'
import {
  controller,
  UsesConfig,
  path,
  Inject,
} from '@harrytwright/api/dist/core'

import { AppConfig } from '../config'

@controller('/')
export class InfoController implements UsesConfig {
  @Inject('config')
  config: Config<AppConfig>

  @path('/')
  getServerInfo(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    return res.status(200).json({
      version: this.config.get('version'),
    })
  }
}

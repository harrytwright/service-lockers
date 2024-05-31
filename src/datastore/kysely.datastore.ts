import { createPool } from 'mysql2'
import type { Config } from '@harrytwright/cli-config'
import {
  Kysely,
  MysqlDialect,
  CamelCasePlugin,
  DeduplicateJoinsPlugin,
  TableExpression,
} from 'kysely'

import {
  register,
  WillBootstrap,
  UsesConfig,
  Inject,
} from '@harrytwright/api/dist/core'

import { AppConfig } from '../config'
import { DB } from './kysely.database.types'
import { MysqlModule } from '../modules/mysql/mysql.module'

@register('singleton')
export class KyselyDatastore implements UsesConfig, WillBootstrap {
  @Inject('config')
  config: Config<AppConfig>

  database: Kysely<DB>

  uri: string

  constructor(private readonly mysql: MysqlModule) {}

  async bootstrap(): Promise<void> {
    this.uri = this.config.get('database-url')

    const dialect = new MysqlDialect({
      pool: this.mysql.mysql2().createPool({
        uri: this.uri,
      }),
    })

    this.database = new Kysely<DB>({
      dialect,
      // log: ['query', 'error'],
      plugins: [new DeduplicateJoinsPlugin()],
    })
  }
}

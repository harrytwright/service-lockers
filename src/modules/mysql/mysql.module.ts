import { register } from '@harrytwright/api/dist/core'
import { PoolOptions, Pool } from 'mysql2'

import { Zipkin } from '../../telemetry/zipkin'
import { createZipkinPool } from './mysql2/pool'

export interface MysqlInterface {
  createPool(config: PoolOptions): Pool
  createPool(connectionUri: string): Pool
}

@register()
export class MysqlModule {
  constructor(private readonly zipkin: Zipkin) {}

  mysql2(): MysqlInterface {
    let zipkin = this.zipkin
    return Object.assign({}, require('mysql2'), {
      createPool: createZipkinPool(zipkin),
    })
  }
}

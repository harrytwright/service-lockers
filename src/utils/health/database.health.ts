import { register } from '@harrytwright/api/dist/core'

import { KyselyDatastore } from '../../datastore/kysely.datastore'
import { HealthIndicator } from './types/health-indicator.type'
import { sql } from 'kysely'
import e from 'express'

// TODO: Have these errors look better with more info being passed to the error message
class TimeoutError extends Error {}

/* istanbul ignore next */
const promiseTimeout = async <T = void>(
  ms: number,
  promise: Promise<any>
): Promise<T> => {
  const timeout = setTimeout(() => {
    throw new TimeoutError()
  }, ms)

  let value: Promise<T>
  try {
    value = await promise
  } catch (err) {
    throw err
  } finally {
    clearTimeout(timeout)
  }

  return value
}

const getSizeOfDatabase = (database: string) => sql`
SELECT TABLE_NAME AS \`Table Name\`,
       ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024) AS \`Size ( in MB)\`
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = ${database}
ORDER BY (DATA_LENGTH + INDEX_LENGTH)
        DESC;
`

@register('transient')
export class DatabaseHealth {
  constructor(private readonly database: KyselyDatastore) {}

  public async ping(
    key: string,
    options: { timeout?: number }
  ): Promise<HealthIndicator> {
    let check: Promise<any>
    let details: string | undefined

    try {
      check = getSizeOfDatabase(
        new URL(this.database.uri).pathname.replace('/', '')
      ).execute(this.database.database)
      details = await promiseTimeout(options.timeout || 1000, check)
    } catch (err) {
      /* istanbul ignore next */
      if (err instanceof TimeoutError) {
        return {
          error: new Error(
            `${key} failed with a timeout - ${
              options.timeout || 1000
            }ms exceeded`
          ),
          key,
        }
      } else if (err instanceof AggregateError) {
        return {
          error: new Error(`Failed to connect ${err.errors.length} times`),
          key,
        }
      }

      /* istanbul ignore next */
      if (err instanceof Error) {
        return { error: err, key }
      }
    }

    return {
      status: 'healthy',
      details,
      key,
    }
  }
}

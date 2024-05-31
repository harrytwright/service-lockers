const buildDate = new Date()

import path from 'path'
import { Config } from '@harrytwright/cli-config'

const { version, name } = require(path.resolve(process.cwd(), './package.json'))

import {
  AuthConfig,
  types as authTypes,
  defaults as authDefaults,
} from './modules/auth/config'
import {
  S2SConfig,
  types as s2sTypes,
  defaults as s2sDefaults,
} from './modules/s2s/config'

export interface AppConfig extends Record<string, any>, AuthConfig, S2SConfig {
  'database-url': StringConstructor
  date: [DateConstructor, StringConstructor]
  cors: StringConstructor
  loglevel: [
    'silent',
    'error',
    'warn',
    'notice',
    'http',
    'timing',
    'info',
    'verbose',
    'silly',
  ]
  name: StringConstructor
  'node-env': [null, StringConstructor]
  production: BooleanConstructor
  proxy: BooleanConstructor
  port: [NumberConstructor, StringConstructor]
  'rabbit-mq': StringConstructor
  route: StringConstructor
  test: BooleanConstructor
  version: StringConstructor
  zipkin: [null, StringConstructor, BooleanConstructor]
}

/**
 * Any important values from `process.env` related to itself
 *
 * Mainly for the production or testing
 * */
const environment: Record<string, any> = {}

/* istanbul ignore next */
const NODE_ENV = process.env.NODE_ENV || 'development'
const isProduction = NODE_ENV === 'production'

/* istanbul ignore next */
const isTest = NODE_ENV === 'test' || NODE_ENV === 'testing'

environment['node-env'] = NODE_ENV
environment.production = isProduction
environment.test = isTest

const defaults = {
  ...environment,
  ...authDefaults,
  ...s2sDefaults,
  date: buildDate,
  cors: '*',
  loglevel: 'info',
  name,
  proxy: true,
  port: 3000,
  'rabbit-mq': 'amqp://localhost:5672',
  route: '/',
  version,
  zipkin: false,
}

const types: AppConfig = {
  ...authTypes,
  ...s2sTypes,
  'database-url': String,
  date: [Date, String],
  cors: String,
  loglevel: [
    'silent',
    'error',
    'warn',
    'notice',
    'http',
    'timing',
    'info',
    'verbose',
    'silly',
  ],
  name: String,
  'node-env': [null, String],
  production: Boolean,
  proxy: Boolean,
  port: [Number, String],
  'rabbit-mq': String,
  route: String,
  test: Boolean,
  version: String,
  zipkin: [null, String, Boolean],
}

// Automatically add the types to the envMap, since most of these will run inside docker
// will help set more values via `-e '...=...'` or docker-compose
const envFromTypes = Object.keys(types).reduce(
  (curr, key) => ({
    ...curr,
    [key.replace(/-/g, '_').toUpperCase()]: key,
  }),
  {}
)

const envMap = {
  ...envFromTypes,
  PORT: 'port',
}

const shorthand = {
  verbose: ['--loglevel', 'verbose'],
}

export const config = new Config<AppConfig>({
  defaults,
  types,
  shorthand,
  envMap,
  env: process.env,
  argv: process.argv,
  cwd: process.cwd(),
})

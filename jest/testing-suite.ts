// Very, very, jammy, but it works lmao

/* istanbul ignore next */

import { afterAll, beforeAll, expect, test } from '@jest/globals'

import util from 'util'
import { WriteStream } from 'tty'

import supertest from 'supertest'
import {
  API,
  BodyParser,
  http,
  NotFound,
  useController,
  useErrorHandler,
  useMiddleware,
} from '@harrytwright/api/dist/core'
import JsonWebToken from 'jsonwebtoken'
import { Config } from '@harrytwright/cli-config'
import { Constructable } from '@harrytwright/api/dist/common/interfaces'
import { BuilderContext } from '@harrytwright/api/dist/builders/builder'

import { AppConfig } from '../src/config'
import setupLog from '../src/utils/setup-log'
import handler from '../src/middleware/error-handler'
import { KyselyDatastore } from '../src/datastore/kysely.datastore'
import { isValidPrivateKey, Auth } from '../src/modules/auth/auth.module'
import { Authentication } from '../src/modules/auth/middleware/authentication'
import { Container as BaseContainer } from '@harrytwright/api/dist/injection'
import { Container } from '@harrytwright/api/dist/core/injection/container'

export {
  ITestingSuite,
  __unsafe_TestingSuite as TestingSuite,
} from '@harrytwright/api/dist/test/testing-suite'

// Add logging here if we need it
let _logger: (msg: string, ...items: any[]) => unknown
const debug = (msg: string, ...items: any[]) => {
  if (_logger !== undefined) return _logger(msg, ...items)

  _logger = require('util').debug('testing-suite')
}

/* istanbul ignore next */
export function generateApplet(controller: Constructable<any>) {
  // Try and keep this as close to real as possible
  @http()
  @useController(controller)
  @useMiddleware(Authentication)
  @BodyParser.json({ type: ['application/*+json', 'application/json'] })
  @NotFound()
  @useErrorHandler(handler)
  class App {}

  return App
}

/* istanbul ignore next */
export function errorMessageShouldBe(message: any) {
  return function (res: supertest.Response) {
    expect(res.body).toBeDefined()
    expect(res.body.error).toBeDefined()

    if (message instanceof RegExp) {
      expect(res.body.error.message).toMatch(message)
    } else {
      expect(res.body.error.message).toStrictEqual(message)
    }
  }
}

export function handle<A extends any>(
  fn: Promise<A> | undefined,
  callback: (err?: Error) => void
): Promise<void> {
  if (!fn) {
    return Promise.resolve(callback(undefined))
  }

  return fn!
    .then((value) => {
      expect(value).toBeUndefined()
    })
    .catch((err) => {
      if ('matcherResult' in err) throw err
      return callback(err)
    })
}

const hasOwnProperty = (obj: object, property: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(obj, property)

export function flatten(obj: Record<any, any>, deliminator: string = '.') {
  const result: Record<any, any> = {}

  for (const key in obj) {
    if (!hasOwnProperty(obj, key)) continue

    if (typeof obj[key] === 'object' && !!obj[key]) {
      const child = flatten(obj[key])
      for (const childKey in child) {
        if (!hasOwnProperty(child, childKey)) continue
        result[key + deliminator + childKey] = child[childKey]
      }
    } else {
      result[key] = obj[key]
    }
  }

  return result
}
export function fatten(obj: Record<any, any>, deliminator: string = '.') {
  const result: Record<any, any> = {}
  for (const flattenedKey in obj) {
    const keys = flattenedKey.split(deliminator)
    keys.reduce(function (r, e, j) {
      return (
        r[e] ||
        (r[e] = isNaN(Number(keys[j + 1]))
          ? keys.length - 1 === j
            ? obj[flattenedKey]
            : {}
          : [])
      )
    }, result)
  }
  return result
}

const interpolationRegex = /\${{\s?([^{}]+)\s?}}/g

export type Methods = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export type Exporter = {
  path: string

  regex?: string

  default?: string
}

export interface WorkFlow {
  route: string
  method: Methods
  body?: any
  auth?: boolean | string
  headers?: Record<string, any>
  tests?: { [key: 'status' | 'content-type' | 'body' | string]: any }[]
  exports?: Record<string, string | Exporter>
  name?: string
  host?: string
  wait?: number
  timeout?: number
}

export type WorkFlows = {
  [key: string]: WorkFlow[]
}

export async function handleFlow(
  workflow: WorkFlow[],
  base: any,
  runnerCtx: Record<string, any>
) {
  let applet: BuilderContext | undefined
  let ctx: Record<string, Record<string, any>>
  let request: supertest.SuperAgentTest
  let authHeader: string

  beforeAll(async () => {
    try {
      ctx = {
        suite: {
          started: new Date().getTime(),
        },
        runner: runnerCtx,
        cookies: {},
        exports: {},
        env: process.env,
      }

      const { config } = await import('../src/config')
      if (!config.loaded) config.load()

      ctx['config'] = config
      setupLog(config)

      if (typeof base !== 'string') {
        applet = API.create(<Constructable<any>>base, config)
        await applet?.listen()
      }

      const privateKey = process.env['TEST_JWT_PRIVATE_KEY']
      if (privateKey) {
        const priv = await Auth.parseKSAKey(privateKey)
        debug('Running with a private key for signing - %s', priv)

        authHeader = await sign(ctx.runner.jwt, priv)
      } else if (config.get('token-api-key')) {
        // Create a new admin style JWT, so ignore the one from the runnerCtx
        authHeader = await (
          await fetch('http://localhost:15678/tokens', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-KEY': config.get('token-api-key'),
            },
            body: JSON.stringify(ctx.runner.jwt),
          })
        ).text()
      } else {
        throw new Error('Cannot run tests without a private key or api-key')
      }
      debug('Created an auth header - %o', authHeader)

      request = supertest.agent(applet ? applet.server : base)
    } catch (err) {
      await cleanup(applet)
      return Promise.reject(err)
    }
  })

  afterAll(async () => (applet ? cleanup(applet) : {}))

  for (const flow of workflow) {
    test(
      flow.name ?? `${flow.method} - ${flow.route}`,
      async function () {
        await handler(flow, ctx, request)
      },
      flow.timeout || 5000
    )
  }

  async function handler(
    flow: WorkFlow,
    ctx: Record<string, Record<string, any>>,
    request: supertest.SuperAgentTest
  ) {
    // Allow for other hosts to be used during the flow, may we need to call an external service etc
    const curr = flow.host ? supertest.agent(flow.host) : request

    if (flow.wait) {
      debug('Waiting %sms', flow.wait)
      await sleep(flow.wait)
    }

    // Get the method
    const method = <Lowercase<Methods>>flow.method.toLowerCase()

    debug('Running %o with %o', flow.name || flow.route, {
      ...ctx,
      config: 'AppConfig',
      env: 'process.env',
    })

    const route = parseInterpolation(flow.route, { ...ctx })
    debug('Creating %s request for %s', flow.method, route)

    // Generate the `request.(get|post|put|*)`
    let req = curr[method](route)

    // Add the body
    if (flow.body) {
      const body = parseBody(flow.body, { ...ctx })
      debug('Sending %o', body)
      req = req.send(body)
    }

    // Move over any headers
    //
    // Maybe add checks here to see if they're valid or not??
    if (flow.headers) {
      debug('Adding headers %o', flow.headers)
      for (const [header, value] of Object.entries(flow.headers)) {
        req = req.set(header, parseInterpolation(value, { ...ctx }))
      }
    }

    // This is not ideal, but will work for now, jwt technically can be created w/ a DI as it only depends
    // on config, in the test file, but would need describe to be async
    if (flow.auth) {
      if (!authHeader) throw new Error('Unable to find an auth header')

      req = req.auth(authHeader!, { type: 'bearer' })
    }

    const res = await req

    if (res.headers['st-access-token'] && !authHeader) {
      authHeader = res.headers['st-access-token']
    }

    if (flow.tests) {
      debug('Received %j', /text\/.*/.test(res.type) ? res.text : res.body)

      for (const [test, value] of Object.entries(flow.tests)) {
        switch (test) {
          case 'status':
            expect(res.status).toEqual(value)
            break
          case 'content-type':
            expect(res.type).toEqual(value)
            break
          case 'body':
            expect(res.body).toMatchObject(value)
            break
          default:
            throw new Error('Not yet implemented')
        }
      }
    }

    if (flow.exports) {
      for (const [key, value] of Object.entries(flow.exports)) {
        switch (value) {
          case 'status':
            ctx.exports[key] = res.status
            break
          case 'body':
            ctx.exports[key] = /text\/.*/.test(res.type) ? res.text : res.body
            break
          default:
            if (typeof value !== 'string' && 'path' in value) {
              if (value.regex) {
                const data = <string>require('lodash.get')(res.body, value.path)
                const regex = new RegExp(`(?<${key}>${value.regex})`)
                debug('exporting %s with %o from %s', key, regex, value.path)

                const groups = data.match(regex)?.groups || {
                  [key]: value.default,
                }
                ctx.exports[key] = groups[key]
              } else {
                ctx.exports[key] =
                  require('lodash.get')(res, value.path) || value.default
              }
            } else {
              ctx.exports[key] = require('lodash.get')(res, value)
            }
        }
      }
    }
  }
}

function parseBody(
  body: Array<Record<string, any>> | Record<string, any>,
  context: Record<string, any>
): Array<Record<string, any>> | Record<string, any> {
  if (Array.isArray(body)) return body.map((el) => parseBody(el, context))

  const flattened = flatten(body)
  for (const [key, value] of Object.entries(flattened)) {
    flattened[key] = parseInterpolation(value, context)
  }
  return fatten(flattened)
}

function parseInterpolation(value: any, context: Record<string, any>) {
  if (!interpolationRegex.test(value) || typeof value !== 'string') return value
  interpolationRegex.lastIndex = 0

  const itr = value.replaceAll(interpolationRegex, '%s')
  const matches = Array.from(value.matchAll(interpolationRegex))
    .map((el) => el[1].trim()) // Need to trim
    .map((el) => {
      const path = el.split('.')
      if (path[0] === 'config' && context.config) {
        return (<Config<AppConfig>>context.config).get(path[1])
      }

      return require('lodash.get')(context, path)
    })

  debug('interpolating %o with %o', value, matches)
  return util.format(itr, ...matches)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function sign(payload: object, priv: string): Promise<string> {
  // const header = { alg: 'RS256' };
  const opts: Record<any, any> = {}

  const isPrivKey = isValidPrivateKey(priv)
  if (isPrivKey) opts.header = { alg: 'RS256' }

  return new Promise((resolve, reject) => {
    JsonWebToken.sign(payload, priv, opts, (error, encoded) => {
      if (error) return reject(error)

      resolve(encoded!)
    })
  })
}

export async function cleanup(
  applet?:
    | BuilderContext
    | BaseContainer
    | Container
    | { get: (v: any) => any },
  container?: BaseContainer | Container | { get: (v: any) => any }
) {
  if (!container && applet && applet instanceof BuilderContext) {
    container = applet.container
    await applet?.server?.close()
  }

  // These are the given values, used by everything
  return Promise.allSettled([
    container?.get<KyselyDatastore>(KyselyDatastore)?.database?.destroy(),
  ])
}

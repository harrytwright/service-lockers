import { App } from './app'

// This entire script is ignored by `npm run test` instead only being tested by `npm run test:docker` as that
// tests the entire built image, so it's safe to ignore from coverage

/* istanbul ignore next */
export default async function (): Promise<void> {
  // Load any .env files
  require('./env')

  const path = require('path')

  // This is needed loading of the config
  const { name, version } = require(
    path.resolve(process.cwd(), './package.json')
  )
  process.title = name

  // Get the logger and pause it for now
  const log = require('@harrytwright/logger')
  log.pause()

  // Log some very basic info
  log.verbose('cli', { agv: safeArgs(process.argv) }, safeArgs(process.argv))
  log.info('using', '%s@%s', name, version)
  log.info('using', 'node@%s', process.version)

  // Load the configuration
  const { config } = require('./config')
  config.load()

  // Log the default values to the console
  log.info(
    'init',
    { port: config.get('port'), pid: process.pid },
    '%s starting',
    name
  )

  // Set up the logging and resume
  require('./utils/setup-log').default(config)

  const { API } = require('@harrytwright/api/dist/core')

  const [applet] = await API.register(App).load(config).listen()

  log.notice('service', '%s listening @ %s', name, applet.port)
}

/**
 * Redact any important info i.e passwords from args for logging
 *
 * TODO: work on...
 *
 * @param {[string]} args
 * */
function safeArgs(args: string[]) {
  const mut = [...args]
  for (let i = 0; i < mut.length; i++) {
    const key = mut[i]
    if (/(password|username)/.test(key) && !mut[i + 1].startsWith('--')) {
      mut[i + 1] = 'redacted'
    }
  }
  return mut
}

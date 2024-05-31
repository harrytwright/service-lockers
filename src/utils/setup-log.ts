import os from 'os'
import log from '@harrytwright/logger'
import type { Config } from '@harrytwright/cli-config'

import type { AppConfig } from '../config'

export default function (config: Config<AppConfig>) {
  // Set the log level
  log.level = config.get('loglevel')

  // Set the app name
  log.app = config.get('name') || os.hostname()

  // Resume the logger
  log.resume()
}
